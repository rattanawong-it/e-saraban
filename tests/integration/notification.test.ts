import "dotenv/config"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { NOTIFICATION_TEXT } from "@/constants"
import { PERMISSIONS, type GrantedPermissions } from "@/lib/authz"
import { prisma } from "@/lib/db"
import { NOTIFICATION_TYPES } from "@/lib/notification"
import type { ServiceContext } from "@/server/context"
import {
  circulateDocument,
  createDocument,
  returnDocument,
  submitDocument,
} from "@/server/services/document.service"
import { issueNumber } from "@/server/services/numbering.service"

// การแจ้งเตือน in-app (D10 · spec §11.2) — ยิงผ่าน service ตัวจริงบน Postgres จริง
//
// สิ่งที่ชุดนี้เฝ้าอยู่สามข้อ:
//   1. เหตุการณ์ที่ตกลงไว้ต้องเขียนแถวจริง และเขียนถึง "คนที่ต้องลงมือทำต่อ"
//   2. ผู้ลงมือต้องไม่ได้รับแจ้งเตือนของตัวเอง
//   3. ⚠️ ชื่อเรื่องของเอกสารชั้น 1-3 ต้องไม่หลุดออกมาทางการแจ้งเตือน (§22.2)

const TEST_PREFIX = "[integration-notify]"
const BOOK_CODE = "TESTNOTI"

interface Fixture {
  /** เจ้าของเรื่องของทุกฉบับในชุดนี้ */
  ctx: ServiceContext
  /** อีกคนหนึ่ง ใช้เป็น "ผู้ลงมือ" เวลาต้องการให้เจ้าของเรื่องได้รับแจ้งเตือน */
  otherCtx: ServiceContext
  ownerUserId: string
  otherUserId: string
  recipientUserId: string
  tenantId: string
  orgUnitId: string
  memoTypeId: string
}

let fixture: Fixture
const createdDocumentIds: string[] = []

const ALL_DOCUMENT_PERMISSIONS = {
  [PERMISSIONS.DOCUMENT_CREATE]: "ORG",
  [PERMISSIONS.DOCUMENT_READ]: "ORG",
  [PERMISSIONS.DOCUMENT_UPDATE]: "ORG",
  [PERMISSIONS.DOCUMENT_SUBMIT]: "ORG",
  [PERMISSIONS.DOCUMENT_NUMBER_ISSUE]: "ORG",
  [PERMISSIONS.DOCUMENT_RETURN]: "ORG",
  [PERMISSIONS.DOCUMENT_CIRCULATE]: "ORG",
  [PERMISSIONS.DOCUMENT_ACKNOWLEDGE]: "ORG",
  [PERMISSIONS.DOCUMENT_CLOSE]: "ORG",
  [PERMISSIONS.CONFIDENTIAL_ACCESS]: "ORG",
} as GrantedPermissions

async function draft(subject: string, confidentialityLevel = 0, recipients: unknown[] = []) {
  const document = await createDocument(fixture.ctx, {
    documentTypeId: fixture.memoTypeId,
    subject: `${TEST_PREFIX} ${subject}`,
    confidentialityLevel,
    urgencyLevel: 0,
    recipients: recipients as never,
  })

  createdDocumentIds.push(document.id)
  return document
}

function notificationsOf(documentId: string, type?: string) {
  return prisma.notification.findMany({
    where: { refType: "DOCUMENT", refId: documentId, ...(type ? { type } : {}) },
    select: { userId: true, type: true, title: true, body: true, readAt: true },
  })
}

beforeAll(async () => {
  const tenant = await prisma.tenant.findUnique({ where: { code: "KRIRK" } })
  if (!tenant) throw new Error("ยังไม่ได้ seed — รัน pnpm db:seed ก่อน")

  const orgUnit = await prisma.orgUnit.findFirst({
    where: { tenantId: tenant.id, code: "510000", canIssueNumber: true },
  })

  // owner = เจ้าของเรื่อง · other = ผู้ลงมือคนอื่น · recipient = ผู้รับที่ชั้นความลับถึง
  const owner = await prisma.user.findFirst({ where: { username: "registrar" } })
  const other = await prisma.user.findFirst({ where: { username: "rattana.wong" } })
  const recipient = await prisma.user.findFirst({ where: { username: "dean.eng" } })

  if (!orgUnit || !owner || !other || !recipient) throw new Error("ข้อมูล seed ไม่ครบ")

  const base = {
    tenantId: tenant.id,
    isActive: true,
    activeOrgUnitId: orgUnit.id,
    activeOrgUnitPath: orgUnit.path,
    orgUnitIds: [orgUnit.id],
    roleCodes: ["CENTRAL_REGISTRAR"] as const,
    permissions: ALL_DOCUMENT_PERMISSIONS,
    clearanceLevel: 3 as const,
    sessionId: "integration-test",
    ip: "127.0.0.1",
    userAgent: "vitest",
  }

  const documentType = await prisma.documentType.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "TEST_NOTI_MEMO" } },
    update: { defaultBookCode: BOOK_CODE },
    create: {
      tenantId: tenant.id,
      code: "TEST_NOTI_MEMO",
      nameTh: "ประเภททดสอบการแจ้งเตือน",
      direction: "INTERNAL",
      defaultBookCode: BOOK_CODE,
    },
  })

  // §22.3 — เอกสารชั้นความลับส่งให้ออกเลขไม่ได้เลยถ้าหน่วยงานยังไม่มีนายทะเบียนหนังสือลับ
  // ตั้งให้ชั่วคราวเพื่อให้เคสเอกสารลับเดินได้ แล้วถอนคืนใน afterAll
  await prisma.confidentialRegistrar.upsert({
    where: { orgUnitId_userId: { orgUnitId: orgUnit.id, userId: other.id } },
    update: {},
    create: { orgUnitId: orgUnit.id, userId: other.id, assignedById: owner.id },
  })

  fixture = {
    ctx: { ...base, userId: owner.id },
    otherCtx: { ...base, userId: other.id },
    ownerUserId: owner.id,
    otherUserId: other.id,
    recipientUserId: recipient.id,
    tenantId: tenant.id,
    orgUnitId: orgUnit.id,
    memoTypeId: documentType.id,
  }
})

afterAll(async () => {
  if (!fixture) return

  await prisma.confidentialRegistrar.deleteMany({
    where: { orgUnitId: fixture.orgUnitId, userId: fixture.otherUserId },
  })
  await prisma.notification.deleteMany({ where: { refId: { in: createdDocumentIds } } })
  await prisma.documentAcl.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  await prisma.documentRecipient.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  await prisma.documentAction.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  await prisma.document.deleteMany({ where: { id: { in: createdDocumentIds } } })
  await prisma.numberSequence.deleteMany({
    where: { tenantId: fixture.tenantId, bookCode: BOOK_CODE },
  })
  await prisma.documentType.deleteMany({
    where: { tenantId: fixture.tenantId, code: "TEST_NOTI_MEMO" },
  })
  await prisma.$disconnect()
})

describe("ส่งให้สารบรรณ (SUBMITTED)", () => {
  it("แจ้งคนที่ออกเลขให้หน่วยงานนั้นได้ และไม่แจ้งผู้ลงมือเอง", async () => {
    const document = await draft("ส่งให้สารบรรณ")
    await submitDocument(fixture.ctx, document.id)

    const rows = await notificationsOf(document.id, NOTIFICATION_TYPES.documentSubmitted)

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.title === NOTIFICATION_TEXT.submittedTitle)).toBe(true)

    // ผู้ถือบทบาทที่ให้สิทธิ์ออกเลข **ที่ผูกกับหน่วยงานเจ้าของเรื่อง** ต้องได้รับ
    expect(rows.map((row) => row.userId)).toContain(fixture.otherUserId)

    // ⚠️ คนกดปุ่มเองต้องไม่ได้รับ — เขารู้อยู่แล้วว่าเพิ่งทำอะไรไป
    expect(rows.map((row) => row.userId)).not.toContain(fixture.ownerUserId)
  })
})

describe("ออกเลขทะเบียน (NUMBER_ISSUED)", () => {
  it("แจ้งเจ้าของเรื่องพร้อมเลขที่เพิ่งได้ ไม่ใช่ค่า null ที่โหลดมาก่อนออกเลข", async () => {
    const document = await draft("ออกเลขแล้วแจ้งเจ้าของ")
    await submitDocument(fixture.ctx, document.id)

    // ให้ "คนอื่น" เป็นผู้ออกเลข ไม่งั้นเจ้าของเรื่องคือผู้ลงมือแล้วจะถูกกรองออก
    const issued = await issueNumber(fixture.otherCtx, document.id)

    const rows = await notificationsOf(document.id, NOTIFICATION_TYPES.documentNumberIssued)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.userId).toBe(fixture.ownerUserId)
    expect(rows[0]?.body).toContain(issued.docNo)
    expect(rows[0]?.body).not.toContain(NOTIFICATION_TEXT.noDocNo)
  })
})

describe("ตีกลับให้แก้ (RETURNED)", () => {
  it("แจ้งเจ้าของเรื่องพร้อมเหตุผลที่ผู้ตีกลับเขียนไว้", async () => {
    const document = await draft("ตีกลับให้แก้")
    await submitDocument(fixture.ctx, document.id)
    await returnDocument(fixture.otherCtx, document.id, "กรอกเลขที่อ้างถึงผิด")

    const rows = await notificationsOf(document.id, NOTIFICATION_TYPES.documentReturned)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.userId).toBe(fixture.ownerUserId)
    expect(rows[0]?.body).toContain("กรอกเลขที่อ้างถึงผิด")
  })
})

describe("เวียนหนังสือ (CIRCULATED)", () => {
  it("แจ้งผู้รับที่ระบุไว้ในคำสั่งนี้", async () => {
    const document = await draft("เวียนถึงผู้รับ")
    await submitDocument(fixture.ctx, document.id)
    await issueNumber(fixture.ctx, document.id)
    await circulateDocument(fixture.ctx, document.id, [
      { userId: fixture.recipientUserId, kind: "TO" },
    ])

    const rows = await notificationsOf(document.id, NOTIFICATION_TYPES.documentCirculated)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.userId).toBe(fixture.recipientUserId)
    expect(rows[0]?.title).toBe(NOTIFICATION_TEXT.circulatedTitle)
    expect(rows[0]?.readAt).toBeNull()
  })
})

describe("⚠️ เอกสารลับ — ชื่อเรื่องต้องไม่หลุดออกทางการแจ้งเตือน (§22.2)", () => {
  it("ชั้น 1 ขึ้นไปใช้ข้อความแทน ไม่ใช่ชื่อเรื่องจริง", async () => {
    const secret = "ผลการสอบสวนทางวินัยที่ต้องไม่หลุด"
    const document = await draft(secret, 1, [{ userId: fixture.recipientUserId, kind: "TO" }])

    await submitDocument(fixture.ctx, document.id)
    await issueNumber(fixture.otherCtx, document.id)
    await circulateDocument(fixture.ctx, document.id, [
      { userId: fixture.recipientUserId, kind: "TO" },
    ])

    const rows = await notificationsOf(document.id)

    expect(rows.length).toBeGreaterThan(0)

    for (const row of rows) {
      // การแจ้งเตือนถูกอ่านจากกระดิ่งโดยไม่ผ่านด่าน can() ของเอกสาร
      expect(row.body).not.toContain(secret)
      expect(row.body).toContain(NOTIFICATION_TEXT.confidentialSubject)
    }
  })

  it("ชั้น 0 แสดงชื่อเรื่องได้ตามปกติ", async () => {
    const document = await draft("เอกสารทั่วไปแสดงชื่อเรื่องได้")
    await submitDocument(fixture.ctx, document.id)

    const rows = await notificationsOf(document.id, NOTIFICATION_TYPES.documentSubmitted)

    expect(rows[0]?.body).toContain("เอกสารทั่วไปแสดงชื่อเรื่องได้")
  })
})
