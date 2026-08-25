import "server-only"

import { createHash, randomUUID } from "node:crypto"
import type { Readable } from "node:stream"

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, writeAudit, writeAuditStandalone } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/authz"
import { createDecryptStream, encryptBytes, type EnvelopeMetadata } from "@/lib/crypto"
import { prisma } from "@/lib/db"
import { toAuthzResource } from "@/lib/documents/authz-resource"
import { isTerminal } from "@/lib/documents/state-machine"
import { getSystemSettings } from "@/lib/settings"
import { detectFileType, isMimeConsistent, storage } from "@/lib/storage"

import type { ServiceContext } from "../context"
import { assertPermission, ServiceError } from "./errors"

// ไฟล์แนบ (D8 · spec §8.2 · §8.3 · §8.4)
//
// การเข้ารหัส (P3 · D18 ปิดแล้ว): เข้ารหัสเฉพาะไฟล์ของเอกสาร**ชั้นความลับ 1–3** ตาม §8.2
// เอกสารชั้น 0 เก็บเป็นไฟล์ธรรมดาเหมือนเดิม — ตัดสินไว้ว่าไม่เข้ารหัสทุกไฟล์เพราะ
// ชั้น 0 คือหนังสือทั่วไปที่ไม่ได้ต้องการความลับ และการเข้ารหัสทุกไฟล์ทำให้กู้ระบบยากขึ้นโดยไม่จำเป็น
//
// ⚠️ ผลที่ตามมาคือ **การปรับชั้นความลับขึ้นทีหลังต้องไล่เข้ารหัสไฟล์เดิมด้วย**
// ไม่งั้นเอกสารจะขึ้นว่า "ลับ" ทั้งที่ไฟล์ยังนอนเป็น plaintext อยู่บนดิสก์
// → `encryptDocumentAttachments()` ที่ล่างสุดของไฟล์นี้ และ document.service เรียกก่อนบันทึกทุกครั้ง

export interface UploadAttachmentInput {
  documentId: string
  fileName: string
  /** mime ที่เบราว์เซอร์แจ้งมา — ใช้เป็นแค่ "คำกล่าวอ้าง" ต้องเทียบกับเนื้อไฟล์อีกที */
  mimeType: string
  bytes: Uint8Array
  /** เหตุผล — บังคับกรอกเมื่อเอกสารออกเลขไปแล้ว (§6.4) */
  note?: string | null
}

export async function uploadAttachment(ctx: ServiceContext, input: UploadAttachmentInput) {
  const document = await loadDocument(ctx, input.documentId)

  assertPermission(ctx, PERMISSIONS.ATTACHMENT_UPLOAD, toAuthzResource(document))
  assertClearance(ctx, document.confidentialityLevel)

  if (isTerminal(document.status)) {
    throw new ServiceError("เอกสารที่ปิดเรื่องหรือยกเลิกแล้วแนบไฟล์เพิ่มไม่ได้", "VALIDATION")
  }

  const settings = await getSystemSettings(ctx.tenantId)
  const maxBytes = settings.file.maxSizeMb * 1024 * 1024

  if (input.bytes.byteLength === 0) throw new ServiceError("ไฟล์ว่างเปล่า", "VALIDATION")

  if (input.bytes.byteLength > maxBytes) {
    throw new ServiceError(
      `ไฟล์ใหญ่เกิน ${settings.file.maxSizeMb} MB (ปรับได้ที่ /admin/settings)`,
      "VALIDATION",
    )
  }

  if (!settings.file.allowedMimeTypes.includes(input.mimeType)) {
    throw new ServiceError(`ไม่รองรับไฟล์ชนิด ${input.mimeType}`, "VALIDATION")
  }

  // §8.4 — ตรวจจากเนื้อไฟล์จริง เพราะนามสกุลกับ Content-Type ปลอมได้ทั้งคู่
  const detected = detectFileType(input.bytes)
  if (!isMimeConsistent(input.mimeType, detected)) {
    throw new ServiceError(
      `เนื้อไฟล์ไม่ตรงกับชนิดที่แจ้ง (แจ้ง ${input.mimeType} · อ่านได้ ${detected?.label ?? "ไม่รู้จัก"})`,
      "VALIDATION",
    )
  }

  const sha256 = createHash("sha256").update(input.bytes).digest("hex")
  const storageKey = randomUUID()

  const latest = await prisma.attachment.findFirst({
    where: { documentId: document.id },
    orderBy: { version: "desc" },
    select: { version: true },
  })

  const version = (latest?.version ?? 0) + 1

  // §8.2 — ไฟล์ของเอกสารชั้นความลับเข้ารหัสก่อนลงดิสก์ · ชั้น 0 เก็บตรง ๆ
  const envelope = document.confidentialityLevel > 0 ? encryptBytes(input.bytes) : null
  const payload = envelope?.ciphertext ?? input.bytes

  // เขียนไฟล์ก่อนแล้วค่อยบันทึกฐานข้อมูล — ถ้าฐานข้อมูลพัง ต้องเก็บไฟล์กำพร้าทิ้งเอง
  const { bytesWritten } = await storage.put(storageKey, payload)

  // AES-GCM ไม่ยืดความยาว ciphertext จึงเท่าไฟล์ต้นฉบับเสมอ — ถ้าไม่เท่าแปลว่าดิสก์เขียนไม่ครบ
  if (bytesWritten !== payload.byteLength) {
    await storage.delete(storageKey).catch(() => undefined)
    throw new ServiceError("เขียนไฟล์ลงที่เก็บได้ไม่ครบ กรุณาลองใหม่", "VALIDATION")
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const attachment = await tx.attachment.create({
        data: {
          documentId: document.id,
          version,
          fileName: input.fileName,
          mimeType: input.mimeType,
          // ขนาดของไฟล์ **ต้นฉบับ** — ใช้เป็น Content-Length ตอนส่งไฟล์ที่ถอดรหัสแล้วกลับไป
          sizeBytes: input.bytes.byteLength,
          // sha256 ของต้นฉบับเช่นกัน — ใช้ตรวจว่าไฟล์ที่ถอดออกมาครบถ้วนตรงกับที่อัปโหลด
          sha256,
          storageKey,
          isEncrypted: envelope !== null,
          encAlgo: envelope?.meta.encAlgo ?? null,
          encryptedDek: envelope?.meta.encryptedDek ?? null,
          iv: envelope?.meta.iv ?? null,
          authTag: envelope?.meta.authTag ?? null,
          keyVersion: envelope?.meta.keyVersion ?? null,
          uploadedById: ctx.userId,
        },
      })

      await tx.documentAction.create({
        data: {
          documentId: document.id,
          actorUserId: ctx.userId,
          actorUnitId: ctx.activeOrgUnitId,
          actionType: "ATTACHMENT_ADDED",
          fromStatus: document.status,
          toStatus: document.status,
          note: input.note || null,
        },
      })

      await writeAudit(tx, {
        tenantId: ctx.tenantId,
        action: AUDIT_ACTIONS.ATTACHMENT_UPLOADED,
        entityType: AUDIT_ENTITY_TYPES.ATTACHMENT,
        entityId: attachment.id,
        actorUserId: ctx.userId,
        actorOrgUnitId: ctx.activeOrgUnitId,
        sessionId: ctx.sessionId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        severity: "INFO",
        metadata: {
          documentId: document.id,
          docNo: document.docNo,
          fileName: attachment.fileName,
          sizeBytes: attachment.sizeBytes,
          version,
          sha256,
          isEncrypted: attachment.isEncrypted,
        },
      })

      return attachment
    })
  } catch (error) {
    // ไฟล์ที่เขียนไปแล้วต้องไม่ค้างอยู่บนดิสก์โดยไม่มีแถวในฐานข้อมูลอ้างถึง
    await storage.delete(storageKey).catch(() => undefined)
    throw error
  }
}

export async function listAttachments(ctx: ServiceContext, documentId: string) {
  const document = await loadDocument(ctx, documentId)

  assertPermission(ctx, PERMISSIONS.DOCUMENT_READ, toAuthzResource(document))

  return prisma.attachment.findMany({
    where: { documentId, deletedAt: null },
    orderBy: [{ version: "desc" }],
    select: {
      id: true,
      version: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      uploadedAt: true,
      uploadedBy: { select: { firstName: true, lastName: true } },
    },
  })
}

export interface AttachmentDownload {
  stream: Readable
  fileName: string
  mimeType: string
  sizeBytes: number
  /** เอกสารลับต้องเปิดในเบราว์เซอร์เท่านั้น ห้ามให้บันทึกลงเครื่อง (§8.3) */
  inlineOnly: boolean
}

/**
 * เตรียมไฟล์ให้ Route Handler `/api/files/[id]` ส่งกลับ (spec §8.3)
 *
 * ⚠️ **ไม่มี URL ตรงถึงไฟล์** ทุกการเข้าถึงต้องผ่านที่นี่ เพราะต้องผ่าน can() + เขียน audit
 * ทุกครั้ง — การเปิดไฟล์แนบคือจุดที่ข้อมูลรั่วได้จริง จึงต้องรู้เสมอว่าใครเปิดเมื่อไร
 */
export async function openAttachment(
  ctx: ServiceContext,
  attachmentId: string,
): Promise<AttachmentDownload> {
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, deletedAt: null, document: { tenantId: ctx.tenantId } },
    include: {
      document: {
        include: {
          ownerUnit: { select: { path: true } },
          recipients: { select: { orgUnitId: true, userId: true } },
          acls: {
            select: {
              principalType: true,
              principalId: true,
              permission: true,
              effect: true,
              expiresAt: true,
            },
          },
        },
      },
    },
  })

  if (!attachment) throw new ServiceError("ไม่พบไฟล์แนบที่ระบุ", "NOT_FOUND")

  const document = attachment.document

  assertPermission(ctx, PERMISSIONS.ATTACHMENT_DOWNLOAD, toAuthzResource(document))

  assertClearance(ctx, document.confidentialityLevel)

  const raw = await storage.get(attachment.storageKey)

  // ถอดรหัสแบบ stream — ไฟล์ 50MB ห้ามโหลดขึ้น memory ทั้งก้อนเพื่อรอส่ง
  const stream = attachment.isEncrypted ? createDecryptStream(raw, toEnvelope(attachment)) : raw

  // เขียน audit นอกทรานแซกชัน — การอ่านไฟล์ไม่ควรล็อกอะไรไว้ระหว่างส่ง stream
  await writeAuditStandalone({
    tenantId: ctx.tenantId,
    action: AUDIT_ACTIONS.ATTACHMENT_DOWNLOADED,
    entityType: AUDIT_ENTITY_TYPES.ATTACHMENT,
    entityId: attachment.id,
    actorUserId: ctx.userId,
    actorOrgUnitId: ctx.activeOrgUnitId,
    sessionId: ctx.sessionId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    // เอกสารลับที่ถูกเปิดคือเหตุการณ์ที่ผู้ตรวจสอบต้องเห็นชัด
    severity: document.confidentialityLevel > 0 ? "NOTICE" : "INFO",
    metadata: {
      documentId: document.id,
      docNo: document.docNo,
      fileName: attachment.fileName,
      confidentialityLevel: document.confidentialityLevel,
      isEncrypted: attachment.isEncrypted,
    },
  })

  return {
    stream,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    inlineOnly: document.confidentialityLevel > 0,
  }
}

/**
 * ลบไฟล์แนบ
 *
 * soft delete เท่านั้น — ไฟล์บนดิสก์ยังอยู่ เพราะทะเบียนที่ออกเลขแล้วต้องตรวจย้อนหลังได้
 * การลบไฟล์จริงต้องเป็นงานเก็บกวาดที่มีนโยบายกำกับ ไม่ใช่ผลข้างเคียงของปุ่มลบ
 */
export async function deleteAttachment(ctx: ServiceContext, attachmentId: string, note?: string) {
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, deletedAt: null, document: { tenantId: ctx.tenantId } },
    include: {
      document: {
        include: {
          ownerUnit: { select: { path: true } },
          recipients: { select: { orgUnitId: true, userId: true } },
          acls: {
            select: {
              principalType: true,
              principalId: true,
              permission: true,
              effect: true,
              expiresAt: true,
            },
          },
        },
      },
    },
  })

  if (!attachment) throw new ServiceError("ไม่พบไฟล์แนบที่ระบุ", "NOT_FOUND")

  const document = attachment.document

  assertPermission(ctx, PERMISSIONS.ATTACHMENT_UPLOAD, toAuthzResource(document))

  return prisma.$transaction(async (tx) => {
    const deleted = await tx.attachment.update({
      where: { id: attachment.id },
      data: { deletedAt: new Date() },
    })

    await tx.documentAction.create({
      data: {
        documentId: document.id,
        actorUserId: ctx.userId,
        actorUnitId: ctx.activeOrgUnitId,
        actionType: "ATTACHMENT_REMOVED",
        fromStatus: document.status,
        toStatus: document.status,
        note: note || null,
      },
    })

    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      action: AUDIT_ACTIONS.ATTACHMENT_DELETED,
      entityType: AUDIT_ENTITY_TYPES.ATTACHMENT,
      entityId: attachment.id,
      actorUserId: ctx.userId,
      actorOrgUnitId: ctx.activeOrgUnitId,
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      severity: "NOTICE",
      metadata: { documentId: document.id, fileName: attachment.fileName },
    })

    return deleted
  })
}

export interface EncryptionSweepResult {
  /** จำนวนไฟล์ที่เข้ารหัสสำเร็จในรอบนี้ */
  encrypted: number
  /** ไฟล์ที่หายไปจากที่เก็บ — มีแถวใน DB แต่ไม่มีตัวไฟล์ */
  missing: number
}

/**
 * ไล่เข้ารหัสไฟล์แนบของเอกสารที่ยังเป็น plaintext (spec §8.2)
 *
 * ใช้สองที่: ตอนปรับชั้นความลับของเอกสารขึ้นเป็น 1–3 และตอน backfill ไฟล์เก่าจาก P2
 *
 * ⚠️ **ต้องเรียกก่อนบันทึกชั้นความลับใหม่เสมอ** ลำดับนี้จงใจ — ถ้าเข้ารหัสสำเร็จแต่บันทึกเอกสารพัง
 * ผลที่ได้คือไฟล์เข้ารหัสของเอกสารชั้น 0 ซึ่งไม่มีอันตรายอะไร (อ่านได้ปกติผ่าน `isEncrypted`)
 * แต่ถ้าสลับลำดับกัน เอกสารจะขึ้นว่า "ลับ" ทั้งที่ไฟล์ยังเปลือยอยู่บนดิสก์
 *
 * ไฟล์ที่ถูก soft delete แล้วก็เข้ารหัสด้วย — ตัวไฟล์ยังอยู่บนดิสก์และอ่านได้เหมือนเดิม
 */
export async function encryptDocumentAttachments(
  documentId: string,
  ctx?: ServiceContext | null,
): Promise<EncryptionSweepResult> {
  const pending = await prisma.attachment.findMany({
    where: { documentId, isEncrypted: false },
    orderBy: { version: "asc" },
    select: {
      id: true,
      storageKey: true,
      fileName: true,
      sha256: true,
      document: { select: { tenantId: true, docNo: true, confidentialityLevel: true } },
    },
  })

  const result: EncryptionSweepResult = { encrypted: 0, missing: 0 }

  for (const attachment of pending) {
    if (!(await storage.exists(attachment.storageKey))) {
      result.missing += 1
      continue
    }

    // อ่านทั้งไฟล์ขึ้น memory — ยอมได้เพราะเป็นงานกวาดครั้งเดียวต่อไฟล์ ไม่ใช่เส้นทางที่ผู้ใช้รอ
    const plain = await readAll(await storage.get(attachment.storageKey))
    const digest = createHash("sha256").update(plain).digest("hex")
    const { ciphertext, meta } = encryptBytes(plain)

    // เขียนไฟล์ใหม่คนละ key แล้วค่อยสลับ — ถ้าพังกลางทาง ไฟล์เดิมยังอยู่ครบ เปิดได้เหมือนเดิม
    const nextKey = randomUUID()
    await storage.put(nextKey, ciphertext)

    try {
      await prisma.attachment.update({
        where: { id: attachment.id },
        data: {
          storageKey: nextKey,
          isEncrypted: true,
          encAlgo: meta.encAlgo,
          encryptedDek: meta.encryptedDek,
          iv: meta.iv,
          authTag: meta.authTag,
          keyVersion: meta.keyVersion,
        },
      })
    } catch (error) {
      await storage.delete(nextKey).catch(() => undefined)
      throw error
    }

    // ลบ plaintext ทิ้งได้ก็ต่อเมื่อฐานข้อมูลชี้ไปที่ไฟล์เข้ารหัสแล้วเท่านั้น
    await storage.delete(attachment.storageKey).catch(() => undefined)
    result.encrypted += 1

    await writeAuditStandalone({
      tenantId: attachment.document.tenantId,
      action: AUDIT_ACTIONS.ATTACHMENT_ENCRYPTED,
      entityType: AUDIT_ENTITY_TYPES.ATTACHMENT,
      entityId: attachment.id,
      actorUserId: ctx?.userId ?? null,
      actorOrgUnitId: ctx?.activeOrgUnitId ?? null,
      sessionId: ctx?.sessionId ?? null,
      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent ?? null,
      // sha256 ไม่ตรงแปลว่าไฟล์บนดิสก์ถูกแก้ตั้งแต่ก่อนเข้ารหัส — ต้องให้ผู้ตรวจสอบเห็น
      severity: digest === attachment.sha256 ? "NOTICE" : "WARNING",
      metadata: {
        documentId,
        docNo: attachment.document.docNo,
        fileName: attachment.fileName,
        confidentialityLevel: attachment.document.confidentialityLevel,
        keyVersion: meta.keyVersion,
        integrityOk: digest === attachment.sha256,
      },
    })
  }

  return result
}

// ---------------------------------------------------------------------------
// ภายใน
// ---------------------------------------------------------------------------

async function loadDocument(ctx: ServiceContext, documentId: string) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, tenantId: ctx.tenantId, deletedAt: null },
    include: {
      ownerUnit: { select: { path: true } },
      recipients: { select: { orgUnitId: true, userId: true } },
      acls: {
        select: {
          principalType: true,
          principalId: true,
          permission: true,
          effect: true,
          expiresAt: true,
        },
      },
    },
  })

  if (!document) throw new ServiceError("ไม่พบเอกสารที่ระบุ", "NOT_FOUND")

  return document
}

function assertClearance(ctx: ServiceContext, confidentialityLevel: number) {
  if (ctx.clearanceLevel < confidentialityLevel) {
    throw new ServiceError("ชั้นความลับของคุณไม่พอสำหรับเอกสารระดับนี้", "FORBIDDEN")
  }
}

/** อ่าน stream ทั้งก้อน — ใช้เฉพาะงานกวาดที่ต้องมีไฟล์เต็มอยู่ในมือ */
async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

/** รวมฟิลด์กุญแจจากแถว Attachment ให้เป็นรูปที่ src/lib/crypto รับ */
function toEnvelope(attachment: {
  encAlgo: string | null
  encryptedDek: string | null
  iv: string | null
  authTag: string | null
  keyVersion: number | null
}): EnvelopeMetadata {
  const { encAlgo, encryptedDek, iv, authTag, keyVersion } = attachment

  if (!encAlgo || !encryptedDek || !iv || !authTag || keyVersion === null) {
    throw new ServiceError(
      "ไฟล์แนบถูกทำเครื่องหมายว่าเข้ารหัสไว้ แต่ข้อมูลกุญแจในฐานข้อมูลไม่ครบ — เปิดไฟล์ไม่ได้",
      "VALIDATION",
    )
  }

  return { encAlgo, encryptedDek, iv, authTag, keyVersion }
}
