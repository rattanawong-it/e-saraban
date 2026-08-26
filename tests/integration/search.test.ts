import "dotenv/config"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { PERMISSIONS, type GrantedPermissions } from "@/lib/authz"
import { prisma } from "@/lib/db"
import type { ServiceContext } from "@/server/context"
import { grantDocumentAcl } from "@/server/services/acl.service"
import { createDocument, submitDocument } from "@/server/services/document.service"
import { issueNumber } from "@/server/services/numbering.service"
import { searchDocuments } from "@/server/services/search.service"

// ค้นหาขั้นสูง (spec §10.1 · §9.2)
//
// Definition of Done ของ P4 คือ "ค้นภาษาไทยเจอ" — ชุดนี้จึงเน้นสองเรื่อง
//   1. ค้น**คำกลางประโยค**ภาษาไทยต้องเจอ (ILIKE + pg_trgm · tsvector ตัดคำไทยไม่ได้)
//   2. ⚠️ ด่านขอบเขตสิทธิ์ต้องยังอยู่ครบเมื่อมีคำค้นและตัวกรอง — บั๊กแบบเดียวกับ §20 ข้อ 1
//      ที่เคยทำให้ผู้ใช้ scope OWN เห็นเอกสารทั้งองค์กร
//   3. ⚠️ เอกสารลับต้องไม่โผล่ในผลค้นหาของคนที่เปิดมันไม่ได้ — ชื่อเรื่องของหนังสือลับ
//      คือตัวความลับเอง ("ผลการสอบสวนทางวินัยของ...") อ่านชื่อเรื่องจบก็ได้ข้อมูลครบแล้ว

const PREFIX = "[integration-search]"
const CONF_PREFIX = "[integration-search-conf]"
const BOOK_CODE = "TESTSRCH"

interface Fixture {
  owner: ServiceContext
  /** อ่านได้เฉพาะของตัวเอง — ต้องไม่เห็นเอกสารของ owner เลยไม่ว่าจะค้นด้วยอะไร */
  outsider: ServiceContext
  /** เห็นทั้งองค์กรตาม scope แต่ไม่มี ACL บนเอกสารลับสักฉบับ — ตัวเอกของชุดที่ 3 */
  colleague: ServiceContext
  tenantId: string
  orgUnitId: string
  memoTypeId: string
}

let fixture: Fixture
const createdDocumentIds: string[] = []

/** เอกสารชั้น 0 ที่ใช้ทดสอบ DENY — ต้องเห็นได้ก่อน แล้วหายไปหลังถูกห้ามสิทธิ์ */
let purchaseId = ""
/** เอกสารลับที่ไม่มีใครนอกจากเจ้าของเรื่องได้ ACL */
let secretId = ""
/** เอกสารลับที่จะถูกให้สิทธิ์ระหว่างทาง */
let grantableId = ""
/** เอกสารลับที่ ACL หมดอายุไปแล้ว */
let expiredAclId = ""

const FULL_PERMISSIONS = {
  [PERMISSIONS.DOCUMENT_CREATE]: "ORG",
  [PERMISSIONS.DOCUMENT_READ]: "ORG",
  [PERMISSIONS.DOCUMENT_SUBMIT]: "ORG",
  [PERMISSIONS.DOCUMENT_NUMBER_ISSUE]: "ORG",
  [PERMISSIONS.CONFIDENTIAL_ACCESS]: "ORG",
  [PERMISSIONS.ATTACHMENT_GRANT]: "ORG",
} as GrantedPermissions

const OWN_SCOPE_PERMISSIONS = {
  [PERMISSIONS.DOCUMENT_READ]: "OWN",
} as GrantedPermissions

/** สิทธิ์กว้างสุดที่บทบาททั่วไปมีได้ — กว้างพอจะเห็นทั้งองค์กร แต่ไม่ใช่ใบเบิกทางสู่เอกสารลับ */
const ORG_SCOPE_PERMISSIONS = {
  [PERMISSIONS.DOCUMENT_READ]: "ORG",
  [PERMISSIONS.CONFIDENTIAL_ACCESS]: "ORG",
} as GrantedPermissions

async function makeDocument(subject: string, extra: Record<string, unknown> = {}) {
  const document = await createDocument(fixture.owner, {
    documentTypeId: fixture.memoTypeId,
    subject: `${PREFIX} ${subject}`,
    confidentialityLevel: 0,
    urgencyLevel: 0,
    recipients: [],
    ...extra,
  })

  createdDocumentIds.push(document.id)
  return document
}

/** ใช้คำนำหน้าคนละตัวกับเอกสารทั่วไป เพื่อไม่ให้ไปกวนจำนวนที่ชุดเทสต์เดิมนับไว้ */
async function makeConfidentialDocument(subject: string, extra: Record<string, unknown> = {}) {
  const document = await createDocument(fixture.owner, {
    documentTypeId: fixture.memoTypeId,
    subject: `${CONF_PREFIX} ${subject}`,
    confidentialityLevel: 2,
    urgencyLevel: 0,
    recipients: [],
    ...extra,
  })

  createdDocumentIds.push(document.id)
  return document
}

async function subjectsOf(ctx: ServiceContext, filter: Parameters<typeof searchDocuments>[1]) {
  const result = await searchDocuments(ctx, { ...filter, pageSize: 100 })
  return result.rows.map((row) => row.subject)
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

  if (!orgUnit || !otherUnit || !registrar || !outsider || !colleague) {
    throw new Error("ข้อมูล seed ไม่ครบ")
  }

  const documentType = await prisma.documentType.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "TEST_SEARCH_MEMO" } },
    update: { defaultBookCode: BOOK_CODE },
    create: {
      tenantId: tenant.id,
      code: "TEST_SEARCH_MEMO",
      nameTh: "ประเภททดสอบการค้นหา",
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
      // ชั้นความลับถึง — พิสูจน์ว่าที่กันไว้คือ "ไม่มี ACL" ไม่ใช่ "ชั้นไม่พอ"
      clearanceLevel: 3,
    },
    tenantId: tenant.id,
    orgUnitId: orgUnit.id,
    memoTypeId: documentType.id,
  }

  // เอกสารสำหรับค้น — ชื่อเรื่องยาวแบบไทยจริงที่ไม่มีเว้นวรรคระหว่างคำสำคัญ
  const purchase = await makeDocument("ขออนุมัติจัดซื้อครุภัณฑ์คอมพิวเตอร์ประจำปีงบประมาณ", {
    summary: "รายละเอียดการจัดซื้อเครื่องคอมพิวเตอร์ 20 เครื่อง",
    urgencyLevel: 2,
  })
  purchaseId = purchase.id

  await makeDocument("ขอเชิญประชุมคณะกรรมการบริหารวิชาการ", { urgencyLevel: 0 })

  const registered = await makeDocument("รายงานผลการดำเนินงานประจำไตรมาส")
  await submitDocument(fixture.owner, registered.id)
  await issueNumber(fixture.owner, registered.id)

  // เอกสารลับ — ชื่อเรื่องกับสาระสำคัญตั้งใจให้ "อ่านแล้วรู้เรื่อง" เพื่อให้เห็นว่าการรั่ว
  // ระดับชื่อเรื่องอย่างเดียวก็เสียหายจริง
  secretId = (
    await makeConfidentialDocument("ผลการสอบสวนทางวินัยของเจ้าหน้าที่", {
      summary: "สรุปสำนวนการสอบสวนและบทลงโทษที่เสนอ",
    })
  ).id

  grantableId = (await makeConfidentialDocument("ขอบเขตการตรวจสอบภายในรอบครึ่งปี")).id
  expiredAclId = (await makeConfidentialDocument("บัญชีรายชื่อผู้ถูกกล่าวหา")).id
})

afterAll(async () => {
  if (!fixture) return

  await prisma.documentAcl.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  await prisma.documentRecipient.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  await prisma.documentAction.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  await prisma.document.deleteMany({ where: { id: { in: createdDocumentIds } } })
  await prisma.numberSequence.deleteMany({
    where: { tenantId: fixture.tenantId, bookCode: BOOK_CODE },
  })
  await prisma.documentType.deleteMany({
    where: { tenantId: fixture.tenantId, code: "TEST_SEARCH_MEMO" },
  })
  await prisma.$disconnect()
})

describe("ค้นภาษาไทย (§9.2)", () => {
  it("⚠️ ค้นคำที่อยู่กลางประโยคได้ — tsvector ตัดคำไทยไม่ได้ ต้องพึ่ง pg_trgm", async () => {
    const subjects = await subjectsOf(fixture.owner, { q: "ครุภัณฑ์" })

    expect(subjects.some((subject) => subject.includes("จัดซื้อครุภัณฑ์"))).toBe(true)
  })

  it("ค้นจากสาระสำคัญได้ ไม่ใช่แค่ชื่อเรื่อง", async () => {
    const subjects = await subjectsOf(fixture.owner, { q: "20 เครื่อง" })

    expect(subjects.some((subject) => subject.includes("จัดซื้อครุภัณฑ์"))).toBe(true)
  })

  it("ค้นด้วยเลขที่หนังสือที่ออกแล้วเจอ", async () => {
    const registered = await prisma.document.findFirstOrThrow({
      where: { id: { in: createdDocumentIds }, docNo: { not: null } },
      select: { docNo: true },
    })

    const subjects = await subjectsOf(fixture.owner, { q: registered.docNo ?? "" })

    expect(subjects.some((subject) => subject.includes("ไตรมาส"))).toBe(true)
  })

  it("คำที่ไม่มีในเอกสารไหนเลยต้องไม่คืนอะไร", async () => {
    expect(await subjectsOf(fixture.owner, { q: "ไม่มีคำนี้อยู่จริงในระบบ" })).toEqual([])
  })
})

describe("ตัวกรอง", () => {
  it("กรองตามความเร่งด่วนได้", async () => {
    const urgent = await subjectsOf(fixture.owner, { q: PREFIX, urgencyLevel: 2 })

    expect(urgent).toHaveLength(1)
    expect(urgent[0]).toContain("จัดซื้อครุภัณฑ์")
  })

  it("กรองตามสถานะได้ — ร่างกับที่ออกเลขแล้วต้องแยกกัน", async () => {
    const drafts = await subjectsOf(fixture.owner, { q: PREFIX, status: "DRAFT" })
    const registered = await subjectsOf(fixture.owner, { q: PREFIX, status: "REGISTERED" })

    expect(drafts).toHaveLength(2)
    expect(registered).toHaveLength(1)
    expect(registered[0]).toContain("ไตรมาส")
  })

  it("กรองตามหน่วยงานเจ้าของเรื่องได้", async () => {
    const mine = await subjectsOf(fixture.owner, { q: PREFIX, ownerUnitId: fixture.orgUnitId })

    expect(mine).toHaveLength(3)
  })

  it("เรียงตามเลขที่หนังสือแล้วฉบับที่ยังไม่มีเลขต้องไปอยู่ท้าย", async () => {
    const result = await searchDocuments(fixture.owner, {
      q: PREFIX,
      sort: "docNo",
      pageSize: 100,
    })

    expect(result.rows[0]?.docNo).not.toBeNull()
    expect(result.rows.at(-1)?.docNo).toBeNull()
  })

  it("ไม่ใส่เงื่อนไขอะไรเลยต้องไม่คืนอะไร — หน้าค้นหาไม่ใช่ที่เทข้อมูลทั้งองค์กร", async () => {
    const result = await searchDocuments(fixture.owner, {})

    expect(result.empty).toBe(true)
    expect(result.rows).toEqual([])
    expect(result.total).toBe(0)
  })
})

describe("⚠️ ขอบเขตสิทธิ์ต้องอยู่ครบทุกเส้นทาง", () => {
  it("ผู้ใช้ scope OWN ค้นด้วยคำค้นแล้วต้องไม่เห็นเอกสารของคนอื่น", async () => {
    expect(await subjectsOf(fixture.outsider, { q: PREFIX })).toEqual([])
    expect(await subjectsOf(fixture.outsider, { q: "ครุภัณฑ์" })).toEqual([])
  })

  it("ใส่ตัวกรองหน่วยงานของคนอื่นก็ยังทะลุขอบเขตตัวเองไม่ได้", async () => {
    const subjects = await subjectsOf(fixture.outsider, {
      q: PREFIX,
      ownerUnitId: fixture.orgUnitId,
    })

    expect(subjects).toEqual([])
  })

  it("นับ total ตามขอบเขตของผู้ค้น ไม่ใช่ตามทั้งฐาน", async () => {
    const owner = await searchDocuments(fixture.owner, { q: PREFIX, pageSize: 100 })
    const outsider = await searchDocuments(fixture.outsider, { q: PREFIX, pageSize: 100 })

    expect(owner.total).toBe(3)
    expect(outsider.total).toBe(0)
  })
})

describe("⚠️ เอกสารลับต้องไม่โผล่ในผลค้นหาของคนที่เปิดไม่ได้ (§4.3 ข้อ 5)", () => {
  it("เพื่อนร่วมองค์กรที่ scope กว้างพอ แต่ไม่มี ACL ต้องค้นไม่เจอทั้งชื่อเรื่องและยอดรวม", async () => {
    expect(await subjectsOf(fixture.colleague, { q: "สอบสวนทางวินัย" })).toEqual([])

    const result = await searchDocuments(fixture.colleague, { q: CONF_PREFIX, pageSize: 100 })

    expect(result.rows).toEqual([])
    expect(result.total).toBe(0)
  })

  it("ค้นด้วยคำในสาระสำคัญก็ต้องไม่เจอ — ไม่งั้นเดาคำทีละคำจนได้เนื้อหาโดยไม่ต้องเปิดไฟล์", async () => {
    expect(await subjectsOf(fixture.colleague, { q: "บทลงโทษที่เสนอ" })).toEqual([])
  })

  it("กรองชั้นความลับตรง ๆ ต้องไม่กลายเป็นช่องกวาดรายชื่อเอกสารลับทั้งองค์กร", async () => {
    const byLevel = await subjectsOf(fixture.colleague, {
      q: CONF_PREFIX,
      confidentialityLevel: 2,
    })

    expect(byLevel).toEqual([])
  })

  it("เอกสารทั่วไปยังค้นเจอตามปกติ — ด่านนี้ต้องไม่กวาดของที่ควรเห็นไปด้วย", async () => {
    const subjects = await subjectsOf(fixture.colleague, { q: PREFIX })

    expect(subjects).toHaveLength(3)
  })

  it("เจ้าของเรื่องยังค้นเอกสารลับของตัวเองเจอครบ — ACL อัตโนมัติที่ออกให้ตอนสร้าง", async () => {
    const subjects = await subjectsOf(fixture.owner, { q: CONF_PREFIX })

    expect(subjects).toHaveLength(3)
  })

  it("ACL ที่หมดอายุแล้วต้องไม่ทำให้ค้นเจอ", async () => {
    await prisma.documentAcl.create({
      data: {
        documentId: expiredAclId,
        principalType: "USER",
        principalId: fixture.colleague.userId,
        permission: "VIEW",
        effect: "ALLOW",
        expiresAt: new Date(Date.now() - 60_000),
        reason: "ทดสอบสิทธิ์ที่หมดอายุ",
        grantedById: fixture.owner.userId,
      },
    })

    expect(await subjectsOf(fixture.colleague, { q: CONF_PREFIX })).toEqual([])
  })

  it("ได้ ACL รายบุคคลแล้วจึงค้นเจอ — เห็นเฉพาะฉบับที่ได้รับสิทธิ์ ไม่ใช่ทั้งกอง", async () => {
    await grantDocumentAcl(fixture.owner, {
      documentId: grantableId,
      userId: fixture.colleague.userId,
      permission: "VIEW",
      effect: "ALLOW",
      reason: "ผู้ตรวจสอบภายในขอดูขอบเขตการตรวจ",
    })

    const result = await searchDocuments(fixture.colleague, { q: CONF_PREFIX, pageSize: 100 })
    const ids = result.rows.map((row) => row.id)

    expect(ids).toEqual([grantableId])
    // ฉบับที่ไม่ได้ให้สิทธิ์ต้องยังมองไม่เห็น — ให้สิทธิ์ทีละฉบับ ไม่ใช่เปิดทั้งกอง
    expect(ids).not.toContain(secretId)
  })

  it("ถูกห้ามสิทธิ์ (DENY) ไว้ เอกสารต้องหายจากผลค้นหาด้วย ไม่ใช่หายแค่ตอนกดเปิด", async () => {
    const hasPurchase = async () =>
      (await subjectsOf(fixture.colleague, { q: PREFIX })).some((subject) =>
        subject.includes("จัดซื้อครุภัณฑ์"),
      )

    expect(await hasPurchase()).toBe(true)

    await grantDocumentAcl(fixture.owner, {
      documentId: purchaseId,
      userId: fixture.colleague.userId,
      permission: "VIEW",
      effect: "DENY",
      reason: "มีส่วนได้เสียกับการจัดซื้อรอบนี้",
    })

    expect(await hasPurchase()).toBe(false)
  })
})
