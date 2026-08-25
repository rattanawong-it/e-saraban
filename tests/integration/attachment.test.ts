import "dotenv/config"

import { createHash } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { PERMISSIONS, type GrantedPermissions } from "@/lib/authz"
import { prisma } from "@/lib/db"
import { storage } from "@/lib/storage"
import type { ServiceContext } from "@/server/context"
import {
  deleteAttachment,
  encryptDocumentAttachments,
  listAttachments,
  openAttachment,
  uploadAttachment,
} from "@/server/services/attachment.service"
import {
  createDocument,
  submitDocument,
  closeDocument,
  updateDocument,
} from "@/server/services/document.service"
import { issueNumber } from "@/server/services/numbering.service"

// ไฟล์แนบ (D8 · spec §8.2–8.4)
// เทสต์นี้ยิงผ่าน service ตัวจริงและเขียนไฟล์ลงดิสก์จริง แล้วเก็บกวาดให้หมด
//
// P3 เปิดการเข้ารหัสแล้ว — เข้ารหัสเฉพาะเอกสารชั้นความลับ 1–3 · ชั้น 0 ยังเป็นไฟล์ธรรมดา

const PREFIX = "[integration-attachment]"
const BOOK_CODE = "TESTFILE"

/** PDF ที่เล็กที่สุดที่ยัง "เป็น PDF จริง" — magic number %PDF ต้องผ่าน */
const PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a,
])

/** PNG หนึ่ง pixel — ใช้ทดสอบไฟล์ลับที่แปะลายน้ำไม่ได้เพราะไม่ใช่ PDF */
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
])

/** ไฟล์ที่อ้างว่าเป็น PDF แต่เนื้อในเป็น zip — ต้องถูกปฏิเสธที่ด่าน magic number */
const FAKE_PDF_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])

interface Fixture {
  ctx: ServiceContext
  tenantId: string
  documentTypeId: string
  documentId: string
}

let fixture: Fixture
const createdDocumentIds: string[] = []
const storageKeys: string[] = []

const ALL_PERMISSIONS = {
  [PERMISSIONS.DOCUMENT_CREATE]: "ORG",
  [PERMISSIONS.DOCUMENT_READ]: "ORG",
  [PERMISSIONS.DOCUMENT_SUBMIT]: "ORG",
  [PERMISSIONS.DOCUMENT_UPDATE]: "ORG",
  [PERMISSIONS.DOCUMENT_NUMBER_ISSUE]: "ORG",
  [PERMISSIONS.DOCUMENT_CLOSE]: "ORG",
  [PERMISSIONS.ATTACHMENT_UPLOAD]: "ORG",
  [PERMISSIONS.ATTACHMENT_DOWNLOAD]: "ORG",
  [PERMISSIONS.CONFIDENTIAL_ACCESS]: "ORG",
} as GrantedPermissions

beforeAll(async () => {
  const tenant = await prisma.tenant.findUnique({ where: { code: "KRIRK" } })
  const orgUnit = await prisma.orgUnit.findFirst({ where: { code: "510000" } })
  const user = await prisma.user.findFirst({ where: { username: "registrar" } })
  if (!tenant || !orgUnit || !user) throw new Error("ยังไม่ได้ seed — รัน pnpm db:seed ก่อน")

  const documentType = await prisma.documentType.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "TEST_FILE_MEMO" } },
    update: { defaultBookCode: BOOK_CODE },
    create: {
      tenantId: tenant.id,
      code: "TEST_FILE_MEMO",
      nameTh: "ประเภททดสอบไฟล์แนบ",
      direction: "INTERNAL",
      defaultBookCode: BOOK_CODE,
    },
  })

  const ctx: ServiceContext = {
    userId: user.id,
    tenantId: tenant.id,
    isActive: true,
    activeOrgUnitId: orgUnit.id,
    activeOrgUnitPath: orgUnit.path,
    orgUnitIds: [orgUnit.id],
    roleCodes: ["CENTRAL_REGISTRAR"],
    permissions: ALL_PERMISSIONS,
    clearanceLevel: 3,
    sessionId: "integration-test",
    ip: "127.0.0.1",
    userAgent: "vitest",
  }

  const document = await createDocument(ctx, {
    documentTypeId: documentType.id,
    subject: `${PREFIX} เอกสารสำหรับทดสอบไฟล์แนบ`,
    confidentialityLevel: 0,
    urgencyLevel: 0,
    recipients: [],
  })

  createdDocumentIds.push(document.id)

  fixture = {
    ctx,
    tenantId: tenant.id,
    documentTypeId: documentType.id,
    documentId: document.id,
  }
})

afterAll(async () => {
  if (!fixture) return

  for (const key of storageKeys) {
    await storage.delete(key).catch(() => undefined)
  }

  await prisma.documentAcl.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  await prisma.attachment.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  await prisma.documentAction.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  await prisma.document.deleteMany({ where: { id: { in: createdDocumentIds } } })
  await prisma.numberSequence.deleteMany({
    where: { tenantId: fixture.tenantId, bookCode: BOOK_CODE },
  })
  await prisma.documentType.deleteMany({
    where: { tenantId: fixture.tenantId, code: "TEST_FILE_MEMO" },
  })
  await prisma.$disconnect()
})

async function readStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

describe("อัปโหลดไฟล์แนบ", () => {
  it("แนบ PDF ได้ · เก็บ sha256 · เขียนไฟล์ลงที่เก็บจริง", async () => {
    const attachment = await uploadAttachment(fixture.ctx, {
      documentId: fixture.documentId,
      fileName: "หนังสือนำส่ง.pdf",
      mimeType: "application/pdf",
      bytes: PDF_BYTES,
    })

    storageKeys.push(attachment.storageKey)

    expect(attachment.version).toBe(1)
    expect(attachment.sizeBytes).toBe(PDF_BYTES.byteLength)
    expect(attachment.sha256).toBe(createHash("sha256").update(PDF_BYTES).digest("hex"))
    expect(attachment.isEncrypted).toBe(false) // เอกสารชั้น 0 ไม่เข้ารหัสตามที่ตัดสินไว้
    expect(await storage.exists(attachment.storageKey)).toBe(true)
  })

  it("แนบไฟล์ซ้ำได้เป็นเวอร์ชันถัดไป", async () => {
    const attachment = await uploadAttachment(fixture.ctx, {
      documentId: fixture.documentId,
      fileName: "หนังสือนำส่ง-แก้ไข.pdf",
      mimeType: "application/pdf",
      bytes: PDF_BYTES,
    })

    storageKeys.push(attachment.storageKey)
    expect(attachment.version).toBe(2)
  })

  it("⚠️ ไฟล์ที่อ้างว่าเป็น PDF แต่เนื้อในเป็น zip ต้องถูกปฏิเสธ (§8.4)", async () => {
    await expect(
      uploadAttachment(fixture.ctx, {
        documentId: fixture.documentId,
        fileName: "ปลอมนามสกุล.pdf",
        mimeType: "application/pdf",
        bytes: FAKE_PDF_BYTES,
      }),
    ).rejects.toThrow(/เนื้อไฟล์ไม่ตรงกับชนิดที่แจ้ง/)
  })

  it("ชนิดไฟล์ที่ไม่อยู่ในรายการที่อนุญาตต้องถูกปฏิเสธ", async () => {
    await expect(
      uploadAttachment(fixture.ctx, {
        documentId: fixture.documentId,
        fileName: "script.js",
        mimeType: "text/javascript",
        bytes: PDF_BYTES,
      }),
    ).rejects.toThrow(/ไม่รองรับไฟล์ชนิด/)
  })

  it("ไฟล์ใหญ่เกินค่าที่ตั้งไว้ที่ /admin/settings ต้องถูกปฏิเสธ", async () => {
    const settings = await prisma.systemSetting.findFirst({
      where: { tenantId: fixture.tenantId, key: "file" },
    })
    const maxSizeMb = (settings?.value as { maxSizeMb?: number })?.maxSizeMb ?? 50

    // สร้างไฟล์ที่ใหญ่เกินหนึ่ง byte โดยยังขึ้นต้นด้วย %PDF เพื่อให้ตกที่ด่านขนาดจริง ๆ
    const oversize = new Uint8Array(maxSizeMb * 1024 * 1024 + 1)
    oversize.set(PDF_BYTES, 0)

    await expect(
      uploadAttachment(fixture.ctx, {
        documentId: fixture.documentId,
        fileName: "ใหญ่เกินไป.pdf",
        mimeType: "application/pdf",
        bytes: oversize,
      }),
    ).rejects.toThrow(/ใหญ่เกิน/)
  })

  it("ไฟล์ว่างเปล่าต้องถูกปฏิเสธ", async () => {
    await expect(
      uploadAttachment(fixture.ctx, {
        documentId: fixture.documentId,
        fileName: "ว่าง.pdf",
        mimeType: "application/pdf",
        bytes: new Uint8Array(),
      }),
    ).rejects.toThrow(/ว่างเปล่า/)
  })
})

describe("อ่านและลบไฟล์แนบ", () => {
  it("listAttachments เรียงเวอร์ชันล่าสุดขึ้นก่อน", async () => {
    const attachments = await listAttachments(fixture.ctx, fixture.documentId)

    expect(attachments).toHaveLength(2)
    expect(attachments[0]?.version).toBe(2)
  })

  it("เปิดไฟล์ได้เนื้อหาเดิมครบ และเขียน audit ทุกครั้งที่เปิด (§8.3)", async () => {
    const attachments = await listAttachments(fixture.ctx, fixture.documentId)
    const target = attachments[0]
    if (!target) throw new Error("ไม่มีไฟล์แนบให้ทดสอบ")

    const before = await prisma.auditLog.count({
      where: { tenantId: fixture.tenantId, action: "attachment.downloaded" },
    })

    const file = await openAttachment(fixture.ctx, target.id)
    const chunks: Buffer[] = []
    for await (const chunk of file.stream) chunks.push(chunk as Buffer)

    expect(Buffer.concat(chunks).equals(Buffer.from(PDF_BYTES))).toBe(true)
    expect(file.mimeType).toBe("application/pdf")
    expect(file.inlineOnly).toBe(false) // เอกสารชั้นปกติดาวน์โหลดได้

    const after = await prisma.auditLog.count({
      where: { tenantId: fixture.tenantId, action: "attachment.downloaded" },
    })
    expect(after).toBe(before + 1)
  })

  it("ลบเป็น soft delete — ไฟล์บนดิสก์ยังอยู่เพื่อให้ตรวจย้อนหลังได้", async () => {
    const attachments = await listAttachments(fixture.ctx, fixture.documentId)
    const target = attachments[0]
    if (!target) throw new Error("ไม่มีไฟล์แนบให้ทดสอบ")

    const deleted = await deleteAttachment(fixture.ctx, target.id, "แนบผิดฉบับ")

    expect(deleted.deletedAt).not.toBeNull()
    expect(await storage.exists(deleted.storageKey)).toBe(true)
    expect(await listAttachments(fixture.ctx, fixture.documentId)).toHaveLength(1)

    await expect(openAttachment(fixture.ctx, target.id)).rejects.toThrow(/ไม่พบไฟล์แนบ/)
  })
})

describe("กติกาตามสถานะเอกสาร (§6.4)", () => {
  it("เอกสารที่ออกเลขแล้วยังแนบไฟล์เวอร์ชันใหม่ได้", async () => {
    const document = await createDocument(fixture.ctx, {
      documentTypeId: fixture.documentTypeId,
      subject: `${PREFIX} เอกสารที่ออกเลขแล้ว`,
      confidentialityLevel: 0,
      urgencyLevel: 0,
      recipients: [],
    })
    createdDocumentIds.push(document.id)

    await submitDocument(fixture.ctx, document.id)
    await issueNumber(fixture.ctx, document.id)

    const attachment = await uploadAttachment(fixture.ctx, {
      documentId: document.id,
      fileName: "ฉบับแก้ไขหลังออกเลข.pdf",
      mimeType: "application/pdf",
      bytes: PDF_BYTES,
      note: "แก้ไขตามที่ผู้บริหารสั่งการ",
    })

    storageKeys.push(attachment.storageKey)
    expect(attachment.version).toBe(1)
  })

  it("เอกสารที่ปิดเรื่องแล้วแนบไฟล์เพิ่มไม่ได้", async () => {
    const document = await createDocument(fixture.ctx, {
      documentTypeId: fixture.documentTypeId,
      subject: `${PREFIX} เอกสารที่ปิดแล้ว`,
      confidentialityLevel: 0,
      urgencyLevel: 0,
      recipients: [],
    })
    createdDocumentIds.push(document.id)

    await submitDocument(fixture.ctx, document.id)
    await issueNumber(fixture.ctx, document.id)
    await closeDocument(fixture.ctx, document.id)

    await expect(
      uploadAttachment(fixture.ctx, {
        documentId: document.id,
        fileName: "แนบหลังปิดเรื่อง.pdf",
        mimeType: "application/pdf",
        bytes: PDF_BYTES,
      }),
    ).rejects.toThrow(/ปิดเรื่องหรือยกเลิกแล้ว/)
  })
})

describe("การเข้ารหัสไฟล์แนบ (§8.2)", () => {
  /** สร้างเอกสารใหม่หนึ่งฉบับพร้อมไฟล์แนบหนึ่งไฟล์ */
  async function newDocumentWithFile(confidentialityLevel: number) {
    const document = await createDocument(fixture.ctx, {
      documentTypeId: fixture.documentTypeId,
      subject: `${PREFIX} เอกสารชั้น ${confidentialityLevel}`,
      confidentialityLevel,
      urgencyLevel: 0,
      recipients: [],
    })
    createdDocumentIds.push(document.id)

    const attachment = await uploadAttachment(fixture.ctx, {
      documentId: document.id,
      fileName: "ภาพประกอบ.png",
      mimeType: "image/png",
      bytes: PNG_BYTES,
    })
    storageKeys.push(attachment.storageKey)

    return { document, attachment }
  }

  it("ไฟล์ของเอกสารชั้นความลับต้องไม่เป็น plaintext บนดิสก์", async () => {
    const { attachment } = await newDocumentWithFile(2)

    expect(attachment.isEncrypted).toBe(true)
    expect(attachment.encAlgo).toBe("aes-256-gcm")
    expect(attachment.encryptedDek).not.toBeNull()
    expect(attachment.keyVersion).toBe(1)

    // ⚠️ ด่านที่แท้จริงของ §8.2 — คนที่เข้าถึงดิสก์ได้ต้องอ่านไม่ออก
    const onDisk = await readStream(await storage.get(attachment.storageKey))
    expect(onDisk.equals(Buffer.from(PNG_BYTES))).toBe(false)
    expect(onDisk.subarray(1, 4).toString()).not.toBe("PNG")

    // ขนาดยังเท่าเดิมเพราะ GCM ไม่ยืดความยาว — Content-Length จึงตรงเสมอ
    expect(attachment.sizeBytes).toBe(PNG_BYTES.byteLength)
  })

  it("เปิดไฟล์ที่เข้ารหัสแล้วได้เนื้อหาเดิมครบ และดาวน์โหลดไม่ได้ (§8.3)", async () => {
    const { attachment } = await newDocumentWithFile(2)

    const file = await openAttachment(fixture.ctx, attachment.id)

    expect((await readStream(file.stream)).equals(Buffer.from(PNG_BYTES))).toBe(true)
    expect(file.inlineOnly).toBe(true)
    expect(file.sizeBytes).toBe(PNG_BYTES.byteLength)
  })

  it("ไฟล์ของเอกสารชั้น 0 ยังอ่านตรงจากดิสก์ได้ — ตั้งใจให้เป็นแบบนั้น", async () => {
    const { attachment } = await newDocumentWithFile(0)

    expect(attachment.isEncrypted).toBe(false)
    const onDisk = await readStream(await storage.get(attachment.storageKey))
    expect(onDisk.equals(Buffer.from(PNG_BYTES))).toBe(true)
  })

  it("⚠️ ปรับชั้นความลับขึ้นทีหลัง ต้องไล่เข้ารหัสไฟล์เดิมด้วย ไม่ปล่อยค้างเป็น plaintext", async () => {
    const { document, attachment } = await newDocumentWithFile(0)
    expect(attachment.isEncrypted).toBe(false)

    await updateDocument(fixture.ctx, {
      id: document.id,
      documentTypeId: fixture.documentTypeId,
      subject: `${PREFIX} ปรับเป็นชั้นลับภายหลัง`,
      confidentialityLevel: 2,
      urgencyLevel: 0,
    })

    const after = await prisma.attachment.findUniqueOrThrow({ where: { id: attachment.id } })
    storageKeys.push(after.storageKey)

    expect(after.isEncrypted).toBe(true)
    // ย้ายไป key ใหม่แล้วลบของเดิม — ไฟล์ plaintext ต้องไม่เหลือบนดิสก์
    expect(after.storageKey).not.toBe(attachment.storageKey)
    expect(await storage.exists(attachment.storageKey)).toBe(false)

    const file = await openAttachment(fixture.ctx, attachment.id)
    expect((await readStream(file.stream)).equals(Buffer.from(PNG_BYTES))).toBe(true)
  })

  it("กวาดซ้ำแล้วต้องไม่แตะไฟล์ที่เข้ารหัสไปแล้ว", async () => {
    const { document, attachment } = await newDocumentWithFile(2)

    const result = await encryptDocumentAttachments(document.id, fixture.ctx)

    expect(result.encrypted).toBe(0)
    const after = await prisma.attachment.findUniqueOrThrow({ where: { id: attachment.id } })
    expect(after.storageKey).toBe(attachment.storageKey)
  })

  it("⚠️ ไฟล์เข้ารหัสที่ถูกแก้บนดิสก์ต้องเปิดไม่ผ่าน ไม่ใช่ส่งขยะให้ผู้ใช้", async () => {
    const { attachment } = await newDocumentWithFile(2)

    const onDisk = await readStream(await storage.get(attachment.storageKey))
    const tampered = Buffer.from(onDisk)
    tampered.writeUInt8(tampered.readUInt8(0) ^ 0xff, 0)
    await storage.put(attachment.storageKey, tampered)

    const file = await openAttachment(fixture.ctx, attachment.id)
    await expect(readStream(file.stream)).rejects.toThrow()
  })

  it("ฟิลด์กุญแจหายไปจากฐานข้อมูลต้องบอกให้ชัด ไม่ใช่ส่งไฟล์เข้ารหัสออกไปเฉย ๆ", async () => {
    const { attachment } = await newDocumentWithFile(2)

    await prisma.attachment.update({
      where: { id: attachment.id },
      data: { encryptedDek: null },
    })

    await expect(openAttachment(fixture.ctx, attachment.id)).rejects.toThrow(/ข้อมูลกุญแจ/)
  })
})
