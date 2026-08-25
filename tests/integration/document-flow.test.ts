import "dotenv/config"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { PERMISSIONS, type GrantedPermissions } from "@/lib/authz"
import { prisma } from "@/lib/db"
import type { ServiceContext } from "@/server/context"
import {
  acknowledgeDocument,
  cancelDocument,
  circulateDocument,
  closeDocument,
  createDocument,
  markSentDocument,
  registerIncoming,
  returnDocument,
  submitDocument,
  updateDocument,
} from "@/server/services/document.service"
import { issueNumber } from "@/server/services/numbering.service"

// Definition of Done ของ P2 (spec §13): "ทำ flow บันทึกข้อความและหนังสือส่งได้ครบ
// ตั้งแต่ร่างถึงปิดเรื่อง" · A1 เพิ่มหนังสือรับเข้ามาด้วย (ผู้ใช้ยืนยัน 25 ส.ค. 2569)
//
// เทสต์ชุดนี้เดินทั้งสามเส้นทางบน Postgres จริง ผ่าน service ตัวจริง ไม่ mock

const TEST_PREFIX = "[integration-flow]"
const BOOK_CODE = "TESTFLOW"

interface Fixture {
  ctx: ServiceContext
  tenantId: string
  orgUnitId: string
  workUnitId: string
  memoTypeId: string
  outgoingTypeId: string
  incomingTypeId: string
}

let fixture: Fixture
const createdDocumentIds: string[] = []

/** ทุกสิทธิ์ระดับทั้งองค์กร — เทสต์นี้ตรวจ state machine ไม่ใช่ตรวจ can() ซึ่งมีชุดของตัวเองแล้ว */
const ALL_DOCUMENT_PERMISSIONS = {
  [PERMISSIONS.DOCUMENT_CREATE]: "ORG",
  [PERMISSIONS.DOCUMENT_READ]: "ORG",
  [PERMISSIONS.DOCUMENT_UPDATE]: "ORG",
  [PERMISSIONS.DOCUMENT_DELETE]: "ORG",
  [PERMISSIONS.DOCUMENT_SUBMIT]: "ORG",
  [PERMISSIONS.DOCUMENT_NUMBER_ISSUE]: "ORG",
  [PERMISSIONS.DOCUMENT_RETURN]: "ORG",
  [PERMISSIONS.DOCUMENT_SEND_EXTERNAL]: "ORG",
  [PERMISSIONS.DOCUMENT_CIRCULATE]: "ORG",
  [PERMISSIONS.DOCUMENT_ACKNOWLEDGE]: "ORG",
  [PERMISSIONS.DOCUMENT_CLOSE]: "ORG",
  [PERMISSIONS.CONFIDENTIAL_ACCESS]: "ORG",
} as GrantedPermissions

async function makeType(
  tenantId: string,
  code: string,
  direction: "INTERNAL" | "OUTGOING" | "INCOMING",
) {
  // ใช้ pattern ชุดเดียวกับที่ seed จริงตั้งไว้ให้แต่ละทิศทาง (§7.1)
  const numberPattern = direction === "INCOMING" ? "รับ {seq}/{year}" : null

  const documentType = await prisma.documentType.upsert({
    where: { tenantId_code: { tenantId, code } },
    update: { defaultBookCode: BOOK_CODE, numberPattern },
    create: {
      tenantId,
      code,
      nameTh: `ประเภททดสอบ ${code}`,
      direction,
      defaultBookCode: BOOK_CODE,
      numberPattern,
    },
  })

  return documentType.id
}

/** สร้างร่างแล้วจำ id ไว้เก็บกวาดตอนจบ */
async function draft(documentTypeId: string, subject: string) {
  const document = await createDocument(fixture.ctx, {
    documentTypeId,
    subject: `${TEST_PREFIX} ${subject}`,
    confidentialityLevel: 0,
    urgencyLevel: 0,
    recipients: [],
  })

  createdDocumentIds.push(document.id)
  return document
}

beforeAll(async () => {
  const tenant = await prisma.tenant.findUnique({ where: { code: "KRIRK" } })
  if (!tenant) throw new Error("ยังไม่ได้ seed — รัน pnpm db:seed ก่อน")

  const orgUnit = await prisma.orgUnit.findFirst({
    where: { tenantId: tenant.id, code: "510000", canIssueNumber: true },
  })
  const workUnit = await prisma.orgUnit.findFirst({
    where: { tenantId: tenant.id, code: "010103" },
  })
  const user = await prisma.user.findFirst({ where: { username: "registrar" } })

  if (!orgUnit || !workUnit || !user) throw new Error("ข้อมูล seed ไม่ครบ")

  fixture = {
    ctx: {
      userId: user.id,
      tenantId: tenant.id,
      isActive: true,
      activeOrgUnitId: orgUnit.id,
      activeOrgUnitPath: orgUnit.path,
      orgUnitIds: [orgUnit.id, workUnit.id],
      roleCodes: ["CENTRAL_REGISTRAR"],
      permissions: ALL_DOCUMENT_PERMISSIONS,
      clearanceLevel: 3,
      sessionId: "integration-test",
      ip: "127.0.0.1",
      userAgent: "vitest",
    },
    tenantId: tenant.id,
    orgUnitId: orgUnit.id,
    workUnitId: workUnit.id,
    memoTypeId: await makeType(tenant.id, "TEST_FLOW_MEMO", "INTERNAL"),
    outgoingTypeId: await makeType(tenant.id, "TEST_FLOW_OUT", "OUTGOING"),
    incomingTypeId: await makeType(tenant.id, "TEST_FLOW_IN", "INCOMING"),
  }
})

afterAll(async () => {
  if (!fixture) return

  await prisma.documentRecipient.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  await prisma.documentAction.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  await prisma.document.deleteMany({ where: { id: { in: createdDocumentIds } } })
  await prisma.numberSequence.deleteMany({
    where: { tenantId: fixture.tenantId, bookCode: BOOK_CODE },
  })
  await prisma.documentType.deleteMany({
    where: { tenantId: fixture.tenantId, code: { startsWith: "TEST_FLOW_" } },
  })
  await prisma.$disconnect()
})

describe("บันทึกข้อความภายใน — ร่างถึงปิดเรื่อง (spec §6.1)", () => {
  it("ร่าง → ส่ง → ออกเลข → เวียน → รับทราบ → ปิดเรื่อง", async () => {
    const document = await draft(fixture.memoTypeId, "บันทึกข้อความครบวงจร")
    expect(document.status).toBe("DRAFT")

    const submitted = await submitDocument(fixture.ctx, document.id)
    expect(submitted.status).toBe("PENDING_NUMBER")

    const issued = await issueNumber(fixture.ctx, document.id)
    expect(issued.status).toBe("REGISTERED")
    expect(issued.docNo).toMatch(/^510000\/\d{4}$/)

    const circulated = await circulateDocument(fixture.ctx, document.id, [
      { orgUnitId: fixture.workUnitId, kind: "TO" },
    ])
    expect(circulated.status).toBe("CIRCULATING")

    const acknowledged = await acknowledgeDocument(fixture.ctx, document.id)
    expect(acknowledged.allAcknowledged).toBe(true)
    expect(acknowledged.status).toBe("CLOSED")

    // timeline ต้องเก็บครบทุกก้าวตาม §6.4
    const actions = await prisma.documentAction.findMany({
      where: { documentId: document.id },
      orderBy: { createdAt: "asc" },
      select: { actionType: true },
    })

    expect(actions.map((action) => action.actionType)).toEqual([
      "CREATED",
      "SUBMITTED",
      "NUMBER_ISSUED",
      "CIRCULATED",
      "ACKNOWLEDGED",
    ])
  })

  it("ตีกลับแล้วแก้ไขแล้วส่งใหม่ได้", async () => {
    const document = await draft(fixture.memoTypeId, "ฉบับที่ถูกตีกลับ")

    await submitDocument(fixture.ctx, document.id)
    const returned = await returnDocument(fixture.ctx, document.id, "ชื่อเรื่องไม่ตรงกับเนื้อหา")
    expect(returned.status).toBe("RETURNED")

    const updated = await updateDocument(fixture.ctx, {
      id: document.id,
      documentTypeId: fixture.memoTypeId,
      subject: `${TEST_PREFIX} ชื่อเรื่องที่แก้แล้ว`,
      confidentialityLevel: 0,
      urgencyLevel: 0,
    })
    expect(updated.subject).toContain("ชื่อเรื่องที่แก้แล้ว")

    const resubmitted = await submitDocument(fixture.ctx, document.id)
    expect(resubmitted.status).toBe("PENDING_NUMBER")
  })
})

describe("หนังสือส่งภายนอก (spec §6.2)", () => {
  it("ร่าง → ส่ง → ออกเลข → ส่งออก → ปิดเรื่อง", async () => {
    const document = await draft(fixture.outgoingTypeId, "หนังสือส่งภายนอก")

    await submitDocument(fixture.ctx, document.id)
    const issued = await issueNumber(fixture.ctx, document.id)
    expect(issued.status).toBe("REGISTERED")

    const sent = await markSentDocument(fixture.ctx, document.id, "ส่งไปรษณีย์ลงทะเบียน")
    expect(sent.status).toBe("SENT")

    const closed = await closeDocument(fixture.ctx, document.id)
    expect(closed.status).toBe("CLOSED")
  })

  it("หนังสือส่งภายนอกใช้ทะเบียนคนละชุดกับบันทึกข้อความ", async () => {
    const sequences = await prisma.numberSequence.findMany({
      where: { tenantId: fixture.tenantId, bookCode: BOOK_CODE },
      select: { direction: true, lastValue: true },
    })

    const directions = sequences.map((sequence) => sequence.direction).sort()
    expect(directions).toContain("INTERNAL")
    expect(directions).toContain("OUTGOING")
  })
})

describe("หนังสือรับ (spec §6.3 · A1)", () => {
  it("ลงทะเบียนรับได้เลขทันที → ส่งต่อ → รับทราบ → ปิดเรื่อง", async () => {
    const registered = await registerIncoming(fixture.ctx, {
      documentTypeId: fixture.incomingTypeId,
      subject: `${TEST_PREFIX} หนังสือรับจากภายนอก`,
      externalSenderName: "สำนักงานปลัดกระทรวง",
      confidentialityLevel: 0,
      urgencyLevel: 0,
    })

    createdDocumentIds.push(registered.document.id)

    expect(registered.document.status).toBe("RECEIVED")
    expect(registered.docNo).toBe("รับ 1/2569")
    expect(registered.status).toBe("RECEIVED")

    const forwarded = await circulateOrForward(registered.document.id)
    expect(forwarded).toBe("FORWARDED")

    const acknowledged = await acknowledgeDocument(fixture.ctx, registered.document.id)
    expect(acknowledged.status).toBe("CLOSED")
  })

  it("สร้างหนังสือรับผ่าน createDocument ไม่ได้ — ต้องผ่านหน้าทะเบียนรับ", async () => {
    await expect(
      createDocument(fixture.ctx, {
        documentTypeId: fixture.incomingTypeId,
        subject: `${TEST_PREFIX} ไม่ควรสร้างได้`,
        confidentialityLevel: 0,
        urgencyLevel: 0,
        recipients: [],
      }),
    ).rejects.toThrow(/ทะเบียนรับ/)
  })
})

describe("กติกาที่ห้ามข้าม (spec §6.4)", () => {
  it("ร่างออกเลขเองไม่ได้ ต้องส่งให้สารบรรณก่อน", async () => {
    const document = await draft(fixture.memoTypeId, "ร่างที่ยังไม่ได้ส่ง")

    await expect(issueNumber(fixture.ctx, document.id)).rejects.toThrow()
  })

  it("เอกสารที่ออกเลขแล้วแก้ไขไม่ได้", async () => {
    const document = await draft(fixture.memoTypeId, "ฉบับที่ออกเลขแล้ว")
    await submitDocument(fixture.ctx, document.id)
    await issueNumber(fixture.ctx, document.id)

    await expect(
      updateDocument(fixture.ctx, {
        id: document.id,
        documentTypeId: fixture.memoTypeId,
        subject: `${TEST_PREFIX} พยายามแก้หลังออกเลข`,
        confidentialityLevel: 0,
        urgencyLevel: 0,
      }),
    ).rejects.toThrow()
  })

  it("ยกเลิกหลังออกเลข — เลขถูกจองไว้ ไม่นำกลับมาใช้ซ้ำ", async () => {
    const cancelledDoc = await draft(fixture.memoTypeId, "ฉบับที่จะยกเลิก")
    await submitDocument(fixture.ctx, cancelledDoc.id)
    const issued = await issueNumber(fixture.ctx, cancelledDoc.id)

    const cancelled = await cancelDocument(fixture.ctx, cancelledDoc.id, "ยกเลิกตามคำสั่งผู้บริหาร")
    expect(cancelled.status).toBe("CANCELLED")

    // เลขเดิมยังอยู่กับฉบับที่ยกเลิก — ทะเบียนต้องเห็นว่าเลขนี้ถูกใช้ไปแล้ว
    expect(cancelled.docNo).toBe(issued.docNo)

    // ฉบับถัดไปได้เลขใหม่ ไม่ใช่เลขที่เพิ่งยกเลิก
    const nextDoc = await draft(fixture.memoTypeId, "ฉบับถัดไปหลังยกเลิก")
    await submitDocument(fixture.ctx, nextDoc.id)
    const nextIssued = await issueNumber(fixture.ctx, nextDoc.id)

    expect(nextIssued.seqValue).toBe(issued.seqValue + 1)
  })

  it("ปิดเรื่องแล้วทำอะไรต่อไม่ได้", async () => {
    const document = await draft(fixture.memoTypeId, "ฉบับที่ปิดไปแล้ว")
    await submitDocument(fixture.ctx, document.id)
    await issueNumber(fixture.ctx, document.id)
    await closeDocument(fixture.ctx, document.id)

    await expect(cancelDocument(fixture.ctx, document.id)).rejects.toThrow()
    await expect(
      circulateDocument(fixture.ctx, document.id, [{ orgUnitId: fixture.workUnitId, kind: "TO" }]),
    ).rejects.toThrow()
  })
})

/** ส่งต่อหนังสือรับแล้วคืนสถานะที่ได้ — แยกออกมาให้เทสต์อ่านง่าย */
async function circulateOrForward(documentId: string) {
  const { forwardDocument } = await import("@/server/services/document.service")
  const forwarded = await forwardDocument(fixture.ctx, documentId, [
    { orgUnitId: fixture.workUnitId, kind: "TO" },
  ])

  return forwarded.status
}
