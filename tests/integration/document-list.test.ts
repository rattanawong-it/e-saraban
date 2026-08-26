import "dotenv/config"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { PERMISSIONS, type GrantedPermissions } from "@/lib/authz"
import { prisma } from "@/lib/db"
import type { ServiceContext } from "@/server/context"
import {
  createDocument,
  registerIncoming,
  submitDocument,
} from "@/server/services/document.service"
import {
  countPendingNumber,
  getDocumentDetail,
  listDocuments,
} from "@/server/services/document-list.service"
import { issueNumber } from "@/server/services/numbering.service"

// เทสต์ของ listDocuments — เน้นสองเรื่องที่พังแล้วไม่มีใครเห็น:
//
//   1. **ขอบเขตสิทธิ์ต้องอยู่ครบเมื่อมีคำค้น** — เดิมประกอบ where ด้วย spread
//      ทำให้ `OR` ของด่านสิทธิ์ถูก `OR` ของคำค้นทับ ผู้ใช้ scope OWN ที่พิมพ์ค้นหา
//      จึงเห็นเอกสารทั้ง tenant · นี่คือเทสต์ที่กันไม่ให้กลับมาอีก
//   2. **ตัวกรองของผู้ใช้ต้อง "ตัดกับ" นิยามของกล่อง ไม่ใช่เขียนทับ** — ทะเบียนส่ง
//      ต้องไม่มีหนังสือรับโผล่มา แม้ผู้ใช้จะส่ง direction=INCOMING เข้ามาเอง

const TEST_PREFIX = "[integration-list]"
const BOOK_CODE = "TESTLIST"

interface Fixture {
  /** สารบรรณ — สร้างเอกสารทั้งหมดในเทสต์นี้ และมองเห็นทั้งองค์กร */
  owner: ServiceContext
  /** คนอื่นที่สิทธิ์อ่านเป็น scope OWN — ต้องไม่เห็นเอกสารของ owner เลย */
  outsider: ServiceContext
  tenantId: string
  orgUnitId: string
  otherUnitId: string
  memoTypeId: string
  incomingTypeId: string
}

let fixture: Fixture
const createdDocumentIds: string[] = []

const ALL_DOCUMENT_PERMISSIONS = {
  [PERMISSIONS.DOCUMENT_CREATE]: "ORG",
  [PERMISSIONS.DOCUMENT_READ]: "ORG",
  [PERMISSIONS.DOCUMENT_SUBMIT]: "ORG",
  [PERMISSIONS.DOCUMENT_NUMBER_ISSUE]: "ORG",
  [PERMISSIONS.CONFIDENTIAL_ACCESS]: "ORG",
} as GrantedPermissions

/** อ่านได้เฉพาะของตัวเอง — ชุดสิทธิ์ที่บั๊กเดิมทำให้ทะลุ */
const OWN_SCOPE_PERMISSIONS = {
  [PERMISSIONS.DOCUMENT_READ]: "OWN",
} as GrantedPermissions

async function makeType(tenantId: string, code: string, direction: "INTERNAL" | "INCOMING") {
  const numberPattern = direction === "INCOMING" ? "รับ {seq}/{year}" : null

  const documentType = await prisma.documentType.upsert({
    where: { tenantId_code: { tenantId, code } },
    update: { defaultBookCode: BOOK_CODE, numberPattern },
    create: {
      tenantId,
      code,
      nameTh: `ประเภททดสอบรายการ ${code}`,
      direction,
      defaultBookCode: BOOK_CODE,
      numberPattern,
    },
  })

  return documentType.id
}

async function draft(subject: string) {
  const document = await createDocument(fixture.owner, {
    documentTypeId: fixture.memoTypeId,
    subject: `${TEST_PREFIX} ${subject}`,
    confidentialityLevel: 0,
    urgencyLevel: 0,
    recipients: [],
  })

  createdDocumentIds.push(document.id)
  return document
}

/** ชื่อเรื่องของทุกแถวที่ได้ — ใช้เทียบว่าฉบับไหนอยู่/ไม่อยู่ในกล่อง */
async function subjectsOf(ctx: ServiceContext, filter: Parameters<typeof listDocuments>[1]) {
  const result = await listDocuments(ctx, { ...filter, q: TEST_PREFIX, pageSize: 100 })
  return result.rows.map((row) => row.subject)
}

let draftId = ""
let queuedSubject = ""
let registeredSubject = ""
let registeredId = ""
let incomingSubject = ""

beforeAll(async () => {
  const tenant = await prisma.tenant.findUnique({ where: { code: "KRIRK" } })
  if (!tenant) throw new Error("ยังไม่ได้ seed — รัน pnpm db:seed ก่อน")

  const orgUnit = await prisma.orgUnit.findFirst({
    where: { tenantId: tenant.id, code: "510000", canIssueNumber: true },
  })
  const otherUnit = await prisma.orgUnit.findFirst({
    where: { tenantId: tenant.id, code: "010103" },
  })
  const registrar = await prisma.user.findFirst({ where: { username: "registrar" } })
  const outsider = await prisma.user.findFirst({ where: { username: "somchai.j" } })

  if (!orgUnit || !otherUnit || !registrar || !outsider) throw new Error("ข้อมูล seed ไม่ครบ")

  // `satisfies` ไม่ใช่ `:` — ต้องให้ clearanceLevel คงชนิดเป็น literal 3
  // ไม่ถูกขยายเป็น number ไม่งั้นประกอบเป็น ServiceContext ไม่ผ่าน
  const base = {
    tenantId: tenant.id,
    isActive: true,
    clearanceLevel: 3,
    sessionId: "integration-test",
    ip: "127.0.0.1",
    userAgent: "vitest",
  } satisfies Partial<ServiceContext>

  fixture = {
    owner: {
      ...base,
      userId: registrar.id,
      activeOrgUnitId: orgUnit.id,
      activeOrgUnitPath: orgUnit.path,
      orgUnitIds: [orgUnit.id],
      roleCodes: ["CENTRAL_REGISTRAR"],
      permissions: ALL_DOCUMENT_PERMISSIONS,
    },
    outsider: {
      ...base,
      userId: outsider.id,
      activeOrgUnitId: otherUnit.id,
      activeOrgUnitPath: otherUnit.path,
      orgUnitIds: [otherUnit.id],
      roleCodes: ["USER"],
      permissions: OWN_SCOPE_PERMISSIONS,
    },
    tenantId: tenant.id,
    orgUnitId: orgUnit.id,
    otherUnitId: otherUnit.id,
    memoTypeId: await makeType(tenant.id, "TEST_LIST_MEMO", "INTERNAL"),
    incomingTypeId: await makeType(tenant.id, "TEST_LIST_IN", "INCOMING"),
  }

  // ── เอกสารตั้งต้น หนึ่งฉบับต่อหนึ่งสถานะที่กล่องต่าง ๆ สนใจ ──────────
  const draftDoc = await draft("ฉบับร่าง")
  draftId = draftDoc.id

  const queuedDoc = await draft("ฉบับรอออกเลข")
  await submitDocument(fixture.owner, queuedDoc.id)
  queuedSubject = queuedDoc.subject

  const registeredDoc = await draft("ฉบับออกเลขแล้ว")
  await submitDocument(fixture.owner, registeredDoc.id)
  await issueNumber(fixture.owner, registeredDoc.id)
  registeredSubject = registeredDoc.subject
  registeredId = registeredDoc.id

  const incoming = await registerIncoming(fixture.owner, {
    documentTypeId: fixture.incomingTypeId,
    subject: `${TEST_PREFIX} หนังสือรับจากภายนอก`,
    externalSenderName: "กระทรวงการอุดมศึกษาฯ",
    confidentialityLevel: 0,
    urgencyLevel: 0,
  })

  createdDocumentIds.push(incoming.document.id)
  incomingSubject = incoming.document.subject
})

afterAll(async () => {
  if (!fixture) return

  await prisma.documentRecipient.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  await prisma.documentAction.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  // การแจ้งเตือนอ้างเอกสารด้วย refId ที่ไม่มี FK — ลบเอกสารเฉย ๆ จะเหลือแถวกำพร้าค้างฐาน
  await prisma.notification.deleteMany({ where: { refId: { in: createdDocumentIds } } })
  await prisma.document.deleteMany({ where: { id: { in: createdDocumentIds } } })
  await prisma.numberSequence.deleteMany({
    where: { tenantId: fixture.tenantId, bookCode: BOOK_CODE },
  })
  await prisma.documentType.deleteMany({
    where: { tenantId: fixture.tenantId, code: { startsWith: "TEST_LIST_" } },
  })
  await prisma.$disconnect()
})

describe("ขอบเขตสิทธิ์ต้องอยู่ครบเสมอ (spec §4.3)", () => {
  it("ผู้ใช้ scope OWN ไม่เห็นเอกสารของคนอื่น แม้จะค้นหาด้วยคำที่ตรงทุกฉบับ", async () => {
    // ยืนยันก่อนว่าคำค้นนี้ match จริง ไม่งั้นเทสต์ผ่านเพราะไม่มีข้อมูล
    const ownerRows = await subjectsOf(fixture.owner, { scope: "sent" })
    expect(ownerRows.length).toBeGreaterThan(0)

    const outsiderRows = await subjectsOf(fixture.outsider, { scope: "sent" })
    expect(outsiderRows).toEqual([])
  })

  it("ผู้ใช้ scope OWN ไม่เห็นเอกสารของคนอื่นในทะเบียนรับเช่นกัน", async () => {
    const rows = await subjectsOf(fixture.outsider, { scope: "registry", direction: "INCOMING" })
    expect(rows).toEqual([])
  })

  it("เปิดรายละเอียดเอกสารที่อยู่นอกขอบเขตไม่ได้", async () => {
    await expect(getDocumentDetail(fixture.outsider, registeredId)).rejects.toThrow()
  })
})

describe("ตัวกรองของผู้ใช้ต้องตัดกับนิยามของกล่อง ไม่ใช่เขียนทับ", () => {
  it("ทะเบียนส่งไม่มีหนังสือรับ แม้ผู้ใช้จะส่ง direction=INCOMING มาเอง", async () => {
    const rows = await subjectsOf(fixture.owner, { scope: "sent", direction: "INCOMING" })
    expect(rows).toEqual([])
  })

  it("ทะเบียนส่งมีหนังสือที่ออกเลขแล้ว แต่ไม่มีหนังสือรับ", async () => {
    const rows = await subjectsOf(fixture.owner, { scope: "sent" })

    expect(rows).toContain(registeredSubject)
    expect(rows).not.toContain(incomingSubject)
  })

  it("ทะเบียนรับมีเฉพาะหนังสือรับ", async () => {
    const rows = await subjectsOf(fixture.owner, { scope: "registry", direction: "INCOMING" })

    expect(rows).toContain(incomingSubject)
    expect(rows).not.toContain(registeredSubject)
  })
})

describe("นิยามของแต่ละกล่อง (spec §10.1)", () => {
  it("ร่างของฉัน = ที่ตัวเองสร้างและยังแก้ได้ ไม่รวมที่ส่งไปแล้ว", async () => {
    const rows = await subjectsOf(fixture.owner, { scope: "drafts" })

    expect(rows).toContain(`${TEST_PREFIX} ฉบับร่าง`)
    expect(rows).not.toContain(queuedSubject)
    expect(rows).not.toContain(registeredSubject)
  })

  it("คิวออกเลขมีเฉพาะฉบับที่รอออกเลข และนับจำนวนได้ตรงกัน", async () => {
    const rows = await subjectsOf(fixture.owner, { scope: "queue" })

    expect(rows).toContain(queuedSubject)
    expect(rows).not.toContain(registeredSubject)

    // badge บนเมนูใช้ตัวนับคนละ query กับตาราง — ต้องไม่หลุดจากกันเอง
    const pending = await countPendingNumber(fixture.owner)
    expect(pending).toBeGreaterThanOrEqual(rows.length)
  })

  it("ร่างที่ยังไม่ออกเลขไม่โผล่ในทะเบียน", async () => {
    const rows = await subjectsOf(fixture.owner, { scope: "sent" })
    const draftRow = await prisma.document.findUnique({ where: { id: draftId } })

    expect(draftRow?.docNo).toBeNull()
    expect(rows).not.toContain(draftRow?.subject)
  })
})
