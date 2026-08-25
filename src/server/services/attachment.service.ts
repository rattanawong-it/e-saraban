import "server-only"

import { createHash, randomUUID } from "node:crypto"
import type { Readable } from "node:stream"

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, writeAudit, writeAuditStandalone } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/authz"
import { prisma } from "@/lib/db"
import { isTerminal } from "@/lib/documents/state-machine"
import { getSystemSettings } from "@/lib/settings"
import { detectFileType, isMimeConsistent, storage } from "@/lib/storage"

import type { ServiceContext } from "../context"
import { assertPermission, ServiceError } from "./errors"

// ไฟล์แนบ (D8 · spec §8.2 · §8.3 · §8.4)
//
// ⚠️ P2 เก็บเป็นไฟล์ธรรมดา **ไม่เข้ารหัส** ตาม D18 — ฟิลด์กุญแจใน Attachment
// (`isEncrypted` `encAlgo` `encryptedDek` `iv` `authTag` `keyVersion`) มีอยู่ในฐานข้อมูลแล้ว
// แต่ยังเป็น null · การเข้ารหัส envelope เลื่อนไป P3 พร้อมนโยบายเอกสารลับ (§15 ข้อ 6)
//
// ที่ทำแล้วใน P2: ตรวจสิทธิ์ · ตรวจ magic number · จำกัดขนาด/ชนิด · audit ทุกครั้งที่เปิดไฟล์

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

  // เขียนไฟล์ก่อนแล้วค่อยบันทึกฐานข้อมูล — ถ้าฐานข้อมูลพัง ต้องเก็บไฟล์กำพร้าทิ้งเอง
  const { bytesWritten } = await storage.put(storageKey, input.bytes)

  try {
    return await prisma.$transaction(async (tx) => {
      const attachment = await tx.attachment.create({
        data: {
          documentId: document.id,
          version,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: bytesWritten,
          sha256,
          storageKey,
          isEncrypted: false,
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

  assertPermission(ctx, PERMISSIONS.ATTACHMENT_DOWNLOAD, {
    ownerUnitId: document.ownerUnitId,
    ownerUnitPath: document.ownerUnit.path,
    createdById: document.createdById,
    confidentialityLevel: document.confidentialityLevel,
    status: document.status,
    recipientUnitIds: document.recipients
      .map((recipient) => recipient.orgUnitId)
      .filter((value): value is string => value !== null),
    recipientUserIds: document.recipients
      .map((recipient) => recipient.userId)
      .filter((value): value is string => value !== null),
    acl: document.acls,
  })

  assertClearance(ctx, document.confidentialityLevel)

  const stream = await storage.get(attachment.storageKey)

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
    include: { document: { include: { ownerUnit: { select: { path: true } } } } },
  })

  if (!attachment) throw new ServiceError("ไม่พบไฟล์แนบที่ระบุ", "NOT_FOUND")

  const document = attachment.document

  assertPermission(ctx, PERMISSIONS.ATTACHMENT_UPLOAD, {
    ownerUnitId: document.ownerUnitId,
    ownerUnitPath: document.ownerUnit.path,
    createdById: document.createdById,
    confidentialityLevel: document.confidentialityLevel,
    status: document.status,
  })

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

type LoadedDocument = Awaited<ReturnType<typeof loadDocument>>

function toAuthzResource(document: LoadedDocument) {
  return {
    ownerUnitId: document.ownerUnitId,
    ownerUnitPath: document.ownerUnit.path,
    createdById: document.createdById,
    confidentialityLevel: document.confidentialityLevel,
    status: document.status,
    recipientUnitIds: document.recipients
      .map((recipient) => recipient.orgUnitId)
      .filter((value): value is string => value !== null),
    recipientUserIds: document.recipients
      .map((recipient) => recipient.userId)
      .filter((value): value is string => value !== null),
    acl: document.acls,
  }
}

function assertClearance(ctx: ServiceContext, confidentialityLevel: number) {
  if (ctx.clearanceLevel < confidentialityLevel) {
    throw new ServiceError("ชั้นความลับของคุณไม่พอสำหรับเอกสารระดับนี้", "FORBIDDEN")
  }
}
