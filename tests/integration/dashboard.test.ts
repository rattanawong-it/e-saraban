import "dotenv/config"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { PERMISSIONS, type GrantedPermissions } from "@/lib/authz"
import { prisma } from "@/lib/db"
import type { ServiceContext } from "@/server/context"
import { getAwaitingAcknowledgement, getDocumentStats } from "@/server/services/dashboard.service"
import {
  circulateDocument,
  createDocument,
  returnDocument,
  submitDocument,
} from "@/server/services/document.service"
import { issueNumber } from "@/server/services/numbering.service"

// สถิติฝั่งเอกสารบนหน้าภาพรวม (spec §10.1)
//
// ⚠️ ตัวเลขบนหน้าภาพรวมก็คือการเปิดเผยข้อมูลรูปแบบหนึ่ง — "มีหนังสือรอออกเลข 3 ฉบับ"
// บอกอะไรกับคนที่ไม่ควรรู้ได้มากกว่าที่คิด · ชุดนี้จึงตรวจว่าทุกตัวเลขเคารพขอบเขตสิทธิ์

const PREFIX = "[integration-dashboard]"
const BOOK_CODE = "TESTDASH"

interface Fixture {
  owner: ServiceContext
  /** อ่านได้เฉพาะของตัวเอง — ตัวเลขทุกช่องต้องเป็น 0 */
  outsider: ServiceContext
  /** เห็นทั้งองค์กรตาม scope แต่ไม่มี ACL บนเอกสารลับ — ตัวเลขต้องไม่นับเอกสารลับให้เขา */
  colleague: ServiceContext
  tenantId: string
  memoTypeId: string
}

let fixture: Fixture
const createdDocumentIds: string[] = []

const FULL_PERMISSIONS = {
  [PERMISSIONS.DOCUMENT_CREATE]: "ORG",
  [PERMISSIONS.DOCUMENT_READ]: "ORG",
  [PERMISSIONS.DOCUMENT_SUBMIT]: "ORG",
  [PERMISSIONS.DOCUMENT_RETURN]: "ORG",
  [PERMISSIONS.DOCUMENT_NUMBER_ISSUE]: "ORG",
  [PERMISSIONS.DOCUMENT_CIRCULATE]: "ORG",
  [PERMISSIONS.CONFIDENTIAL_ACCESS]: "ORG",
} as GrantedPermissions

const OWN_SCOPE_PERMISSIONS = {
  [PERMISSIONS.DOCUMENT_READ]: "OWN",
} as GrantedPermissions

const ORG_SCOPE_PERMISSIONS = {
  [PERMISSIONS.DOCUMENT_READ]: "ORG",
  [PERMISSIONS.CONFIDENTIAL_ACCESS]: "ORG",
} as GrantedPermissions

async function makeDocument(subject: string) {
  const document = await createDocument(fixture.owner, {
    documentTypeId: fixture.memoTypeId,
    subject: `${PREFIX} ${subject}`,
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
  const otherUnit = await prisma.orgUnit.findFirst({
    where: { tenantId: tenant.id, code: "010103" },
  })
  const registrar = await prisma.user.findFirst({ where: { username: "registrar" } })
  const outsider = await prisma.user.findFirst({ where: { username: "somchai.j" } })
  const colleague = await prisma.user.findFirst({ where: { username: "dean.eng" } })
  const confidentialRegistrar = await prisma.user.findFirst({
    where: { username: "rattana.wong" },
  })

  if (!orgUnit || !otherUnit || !registrar || !outsider || !colleague || !confidentialRegistrar) {
    throw new Error("ข้อมูล seed ไม่ครบ")
  }

  // เอกสารลับส่งเข้าคิวไม่ได้ถ้าหน่วยงานไม่มีนายทะเบียนหนังสือลับ (ดู confidential-registrar.test.ts)
  // ตั้งเป็นคนที่ไม่ใช่ colleague โดยตั้งใจ — ไม่งั้นเขาจะ "เห็น" เอกสารลับได้ตามสิทธิ์จริง
  await prisma.confidentialRegistrar.upsert({
    where: { orgUnitId_userId: { orgUnitId: orgUnit.id, userId: confidentialRegistrar.id } },
    update: {},
    create: { orgUnitId: orgUnit.id, userId: confidentialRegistrar.id, assignedById: registrar.id },
  })

  const documentType = await prisma.documentType.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "TEST_DASH_MEMO" } },
    update: { defaultBookCode: BOOK_CODE },
    create: {
      tenantId: tenant.id,
      code: "TEST_DASH_MEMO",
      nameTh: "ประเภททดสอบภาพรวม",
      direction: "INTERNAL",
      defaultBookCode: BOOK_CODE,
    },
  })

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
      permissions: FULL_PERMISSIONS,
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
    colleague: {
      ...base,
      userId: colleague.id,
      activeOrgUnitId: otherUnit.id,
      activeOrgUnitPath: otherUnit.path,
      orgUnitIds: [otherUnit.id],
      roleCodes: ["DEPT_OFFICER"],
      permissions: ORG_SCOPE_PERMISSIONS,
      clearanceLevel: 3,
    },
    tenantId: tenant.id,
    memoTypeId: documentType.id,
  }
})

afterAll(async () => {
  if (!fixture) return

  await prisma.confidentialRegistrar.deleteMany({
    where: { orgUnit: { code: "510000" }, user: { username: "rattana.wong" } },
  })
  await prisma.documentAcl.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  await prisma.documentRecipient.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  await prisma.documentAction.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  // การแจ้งเตือนอ้างเอกสารด้วย refId ที่ไม่มี FK — ลบเอกสารเฉย ๆ จะเหลือแถวกำพร้าค้างฐาน
  await prisma.notification.deleteMany({ where: { refId: { in: createdDocumentIds } } })
  await prisma.document.deleteMany({ where: { id: { in: createdDocumentIds } } })
  await prisma.numberSequence.deleteMany({
    where: { tenantId: fixture.tenantId, bookCode: BOOK_CODE },
  })
  await prisma.documentType.deleteMany({
    where: { tenantId: fixture.tenantId, code: "TEST_DASH_MEMO" },
  })
  await prisma.$disconnect()
})

describe("สถิติงานหนังสือ", () => {
  it("นับร่างของตัวเองและฉบับที่ถูกตีกลับแยกกัน", async () => {
    const before = await getDocumentStats(fixture.owner)

    await makeDocument("ร่างที่ยังไม่ส่ง")

    const returned = await makeDocument("ร่างที่จะถูกตีกลับ")
    await submitDocument(fixture.owner, returned.id)
    await returnDocument(fixture.owner, returned.id, "แก้ชื่อเรื่องให้ตรงระเบียบ")

    const after = await getDocumentStats(fixture.owner)

    expect(after.myDrafts).toBe(before.myDrafts + 1)
    expect(after.myReturned).toBe(before.myReturned + 1)
  })

  it("นับคิวรอออกเลขตามที่มีจริง", async () => {
    const before = await getDocumentStats(fixture.owner)

    const queued = await makeDocument("ฉบับที่รอออกเลข")
    await submitDocument(fixture.owner, queued.id)

    const after = await getDocumentStats(fixture.owner)

    expect(after.pendingNumber).toBe(before.pendingNumber + 1)
  })

  it("นับหนังสือที่ออกเลขในเดือนนี้ แยกตามทิศทาง", async () => {
    const before = await getDocumentStats(fixture.owner)

    const issued = await makeDocument("ฉบับที่ออกเลขแล้ว")
    await submitDocument(fixture.owner, issued.id)
    await issueNumber(fixture.owner, issued.id)

    const after = await getDocumentStats(fixture.owner)

    expect(after.thisMonth.internal).toBe(before.thisMonth.internal + 1)
  })

  it("⚠️ ผู้ใช้ scope OWN ต้องไม่เห็นตัวเลขของเอกสารคนอื่น", async () => {
    // เทียบก่อน-หลัง ไม่ใช่เทียบกับศูนย์ เพราะฐาน dev มีเอกสารของเดิมที่ผู้ใช้คนนี้
    // มีสิทธิ์เห็นอยู่แล้ว · สิ่งที่ต้องพิสูจน์คือเอกสารที่ **คนอื่นเพิ่งสร้าง** ต้องไม่ถูกนับให้เขา
    const before = await getDocumentStats(fixture.outsider)

    const queued = await makeDocument("ฉบับของคนอื่นที่รอออกเลข")
    await submitDocument(fixture.owner, queued.id)

    const issued = await makeDocument("ฉบับของคนอื่นที่ออกเลขแล้ว")
    await submitDocument(fixture.owner, issued.id)
    await issueNumber(fixture.owner, issued.id)

    const after = await getDocumentStats(fixture.outsider)

    expect(after.pendingNumber).toBe(before.pendingNumber)
    expect(after.myDrafts).toBe(before.myDrafts)
    expect(after.myReturned).toBe(before.myReturned)
    expect(after.thisMonth.internal).toBe(before.thisMonth.internal)

    // ส่วนเจ้าของเห็นทั้งสองฉบับที่เพิ่งสร้าง
    const ownerStats = await getDocumentStats(fixture.owner)
    expect(ownerStats.pendingNumber).toBeGreaterThan(0)
  })

  it("⚠️ ไม่นับเอกสารลับที่ผู้ดูเปิดไม่ได้ — ตัวเลขบนหน้าภาพรวมก็บอกความลับได้", async () => {
    const before = await getDocumentStats(fixture.colleague)

    const secret = await createDocument(fixture.owner, {
      documentTypeId: fixture.memoTypeId,
      subject: `${PREFIX} ฉบับลับที่รอออกเลข`,
      confidentialityLevel: 2,
      urgencyLevel: 0,
      recipients: [],
    })
    createdDocumentIds.push(secret.id)
    await submitDocument(fixture.owner, secret.id)

    const after = await getDocumentStats(fixture.colleague)

    // "หน่วยงานบุคคลมีหนังสือลับรอออกเลขเพิ่มอีกฉบับ" คือข้อมูลที่ไม่ควรรั่วผ่านตัวเลข
    expect(after.pendingNumber).toBe(before.pendingNumber)

    const ownerAfter = await getDocumentStats(fixture.owner)
    expect(ownerAfter.pendingNumber).toBeGreaterThan(0)
  })
})

describe("หนังสือที่รอรับทราบ", () => {
  it("นับและแสดงเฉพาะผู้รับชั้น เรียน ที่ยังไม่กดรับทราบ", async () => {
    const before = await getDocumentStats(fixture.outsider)

    const document = await makeDocument("ฉบับที่เวียนถึงผู้รับ")
    await submitDocument(fixture.owner, document.id)
    await issueNumber(fixture.owner, document.id)
    await circulateDocument(fixture.owner, document.id, [
      { userId: fixture.outsider.userId, kind: "TO" },
      // สำเนาถึงไม่ใช่งานค้าง จึงต้องไม่ถูกนับ
      { userId: fixture.owner.userId, kind: "CC" },
    ])

    const after = await getDocumentStats(fixture.outsider)
    const list = await getAwaitingAcknowledgement(fixture.outsider)

    expect(after.awaitingMyAck).toBe(before.awaitingMyAck + 1)
    expect(list.some((row) => row.id === document.id)).toBe(true)

    const ownerStats = await getDocumentStats(fixture.owner)
    expect(ownerStats.awaitingMyAck).toBe(0)
  })

  it("ไม่มีสิทธิ์อ่านเอกสารเลยก็ต้องได้ศูนย์ ไม่ใช่ error", async () => {
    const noPermission: ServiceContext = { ...fixture.outsider, permissions: {} }

    const stats = await getDocumentStats(noPermission)

    expect(stats.pendingNumber).toBe(0)
    expect(await getAwaitingAcknowledgement(noPermission)).toEqual([])
  })
})
