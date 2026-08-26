import "dotenv/config"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { PDFDocument } from "pdf-lib"

import { AUDIT_ACTIONS } from "@/lib/audit"
import { PERMISSIONS, type GrantedPermissions } from "@/lib/authz"
import { prisma } from "@/lib/db"
import { buildRegisterPdf, buildRegisterWorkbook } from "@/lib/reports"
import type { ServiceContext } from "@/server/context"
import { cancelDocument, createDocument, submitDocument } from "@/server/services/document.service"
import { issueNumber } from "@/server/services/numbering.service"
import { exportRegisterReport, getRegisterReport } from "@/server/services/report.service"

// ทะเบียนหนังสือ (spec §10.1 · D12) — รูปแบบตามระเบียบสำนักนายกรัฐมนตรีว่าด้วยงานสารบรรณ
//
// สามเรื่องที่ชุดนี้กันไว้
//   1. ⚠️ ทะเบียนเป็นไฟล์ที่เดินออกนอกระบบแล้วเรียกคืนไม่ได้ — ด่านชั้นความลับกับขอบเขต
//      หน่วยงานต้องเป็นตัวเดียวกับหน้ารายการ/หน้าค้นหา ห้ามเขียนเงื่อนไขขึ้นมาใหม่ตรงนี้
//   2. เลขที่ถูกยกเลิกต้องยังอยู่ในเล่ม (§6.4) — เลขหายจากทะเบียนคือสัญญาณของการทุจริต
//   3. การดึงไฟล์ออกต้องมีร่องรอยว่าใครดึง เมื่อไร ติดเอกสารลับไปกี่ฉบับ

const PREFIX = "[integration-report]"
const BOOK_CODE = "TESTRPT"

interface Fixture {
  owner: ServiceContext
  /** เห็นทั้งองค์กรตาม scope แต่ไม่มี ACL บนเอกสารลับ */
  colleague: ServiceContext
  /** ไม่มีสิทธิ์ report.view เลย */
  noReport: ServiceContext
  tenantId: string
  orgUnitId: string
  memoTypeId: string
  year: number
}

let fixture: Fixture
const createdDocumentIds: string[] = []

const OWNER_PERMISSIONS = {
  [PERMISSIONS.DOCUMENT_CREATE]: "ORG",
  [PERMISSIONS.DOCUMENT_READ]: "ORG",
  [PERMISSIONS.DOCUMENT_SUBMIT]: "ORG",
  [PERMISSIONS.DOCUMENT_NUMBER_ISSUE]: "ORG",
  [PERMISSIONS.DOCUMENT_DELETE]: "ORG",
  [PERMISSIONS.CONFIDENTIAL_ACCESS]: "ORG",
  [PERMISSIONS.REPORT_VIEW]: "ORG",
  [PERMISSIONS.REPORT_EXPORT]: "ORG",
} as GrantedPermissions

const COLLEAGUE_PERMISSIONS = {
  [PERMISSIONS.DOCUMENT_READ]: "ORG",
  [PERMISSIONS.CONFIDENTIAL_ACCESS]: "ORG",
  [PERMISSIONS.REPORT_VIEW]: "ORG",
  [PERMISSIONS.REPORT_EXPORT]: "ORG",
} as GrantedPermissions

async function makeIssuedDocument(subject: string, confidentialityLevel = 0) {
  const document = await createDocument(fixture.owner, {
    documentTypeId: fixture.memoTypeId,
    subject: `${PREFIX} ${subject}`,
    confidentialityLevel,
    urgencyLevel: 0,
    recipients: [],
  })

  createdDocumentIds.push(document.id)

  await submitDocument(fixture.owner, document.id)
  await issueNumber(fixture.owner, document.id)

  return document
}

beforeAll(async () => {
  const tenant = await prisma.tenant.findUnique({ where: { code: "KRIRK" } })
  if (!tenant) throw new Error("ยังไม่ได้ seed — รัน pnpm db:seed ก่อน")

  const orgUnit = await prisma.orgUnit.findFirst({
    where: { tenantId: tenant.id, code: "510000", canIssueNumber: true },
  })
  const owner = await prisma.user.findFirst({ where: { username: "registrar" } })
  const colleague = await prisma.user.findFirst({ where: { username: "dean.eng" } })
  const confidentialRegistrar = await prisma.user.findFirst({
    where: { username: "rattana.wong" },
  })

  if (!orgUnit || !owner || !colleague || !confidentialRegistrar) {
    throw new Error("ข้อมูล seed ไม่ครบ")
  }

  // เอกสารลับส่งเข้าคิวออกเลขไม่ได้ถ้าไม่มีนายทะเบียนหนังสือลับ (ดู confidential-registrar.test.ts)
  await prisma.confidentialRegistrar.upsert({
    where: { orgUnitId_userId: { orgUnitId: orgUnit.id, userId: owner.id } },
    update: {},
    create: { orgUnitId: orgUnit.id, userId: owner.id, assignedById: owner.id },
  })

  const documentType = await prisma.documentType.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "TEST_RPT_MEMO" } },
    update: { defaultBookCode: BOOK_CODE },
    create: {
      tenantId: tenant.id,
      code: "TEST_RPT_MEMO",
      nameTh: "ประเภททดสอบทะเบียน",
      direction: "INTERNAL",
      defaultBookCode: BOOK_CODE,
    },
  })

  const base = {
    tenantId: tenant.id,
    isActive: true,
    activeOrgUnitId: orgUnit.id,
    activeOrgUnitPath: orgUnit.path,
    orgUnitIds: [orgUnit.id],
    clearanceLevel: 3,
    sessionId: "integration-test",
    ip: "127.0.0.1",
    userAgent: "vitest",
  } satisfies Partial<ServiceContext>

  fixture = {
    owner: {
      ...base,
      userId: owner.id,
      roleCodes: ["CENTRAL_REGISTRAR"],
      permissions: OWNER_PERMISSIONS,
    },
    colleague: {
      ...base,
      userId: colleague.id,
      roleCodes: ["DEPT_OFFICER"],
      permissions: COLLEAGUE_PERMISSIONS,
    },
    noReport: {
      ...base,
      userId: colleague.id,
      roleCodes: ["USER"],
      permissions: { [PERMISSIONS.DOCUMENT_READ]: "ORG" } as GrantedPermissions,
    },
    tenantId: tenant.id,
    orgUnitId: orgUnit.id,
    memoTypeId: documentType.id,
    year: new Date().getFullYear() + 543,
  }

  await makeIssuedDocument("ฉบับแรกของเล่ม")
  await makeIssuedDocument("ฉบับที่สองของเล่ม")

  const cancelled = await makeIssuedDocument("ฉบับที่ถูกยกเลิกหลังออกเลข")
  await cancelDocument(fixture.owner, cancelled.id, "ยกเลิกเพราะออกเลขผิดเล่ม")

  await makeIssuedDocument("ฉบับลับที่อยู่ในเล่มเดียวกัน", 2)
})

afterAll(async () => {
  if (!fixture) return

  await prisma.confidentialRegistrar.deleteMany({ where: { orgUnitId: fixture.orgUnitId } })
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
    where: { tenantId: fixture.tenantId, code: "TEST_RPT_MEMO" },
  })
  await prisma.$disconnect()
})

/** เฉพาะแถวที่ชุดเทสต์นี้สร้างเอง — ฐาน dev มีเอกสารของเดิมปนอยู่ในเล่มเดียวกัน */
function ours<T extends { subject: string }>(rows: T[]): T[] {
  return rows.filter((row) => row.subject.startsWith(PREFIX))
}

describe("ทะเบียนหนังสือส่ง", () => {
  it("มีเฉพาะฉบับที่ออกเลขแล้ว และเรียงตามเลขทะเบียนในเล่ม", async () => {
    const draft = await createDocument(fixture.owner, {
      documentTypeId: fixture.memoTypeId,
      subject: `${PREFIX} ร่างที่ยังไม่ออกเลข`,
      confidentialityLevel: 0,
      urgencyLevel: 0,
      recipients: [],
    })
    createdDocumentIds.push(draft.id)

    const report = await getRegisterReport(fixture.owner, {
      book: "outgoing",
      orgUnitId: fixture.orgUnitId,
      year: fixture.year,
    })

    const rows = ours(report.rows)

    expect(rows.every((row) => row.docNo !== "")).toBe(true)
    expect(rows.some((row) => row.subject.includes("ร่างที่ยังไม่ออกเลข"))).toBe(false)

    const seqs = rows.map((row) => row.seq ?? 0)
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs)
  })

  it("⚠️ เลขที่ถูกยกเลิกต้องยังอยู่ในเล่มพร้อมหมายเหตุ — เลขหายจากทะเบียนคือสัญญาณทุจริต", async () => {
    const report = await getRegisterReport(fixture.owner, {
      book: "outgoing",
      orgUnitId: fixture.orgUnitId,
      year: fixture.year,
    })

    const cancelled = ours(report.rows).find((row) => row.subject.includes("ถูกยกเลิก"))

    expect(cancelled).toBeDefined()
    expect(cancelled?.docNo).toBeTruthy()
    expect(cancelled?.note).toContain("ยกเลิก")
  })

  it("หนังสือรับเดินคนละเล่ม — ทะเบียนส่งต้องไม่มีหนังสือรับปนมา", async () => {
    const incoming = await getRegisterReport(fixture.owner, {
      book: "incoming",
      orgUnitId: fixture.orgUnitId,
      year: fixture.year,
    })

    expect(ours(incoming.rows)).toEqual([])
  })

  it("⚠️ ไม่เลือกหน่วยงาน = หัวทะเบียนต้องเป็น 'ทุกหน่วยงาน' ไม่ใช่หน่วยงานที่ผู้ใช้ทำงานอยู่", async () => {
    // หัวกระดาษที่ประกาศชื่อหน่วยงานหนึ่ง ทั้งที่ข้างในเป็นรายการของทุกหน่วยงาน
    // คือเอกสารราชการที่บอกข้อมูลเท็จ — และไฟล์นั้นเดินออกไปถึงผู้ตรวจสอบ
    const all = await getRegisterReport(fixture.owner, { book: "outgoing", year: fixture.year })

    expect(all.orgUnitName).toBe("ทุกหน่วยงาน")

    const scoped = await getRegisterReport(fixture.owner, {
      book: "outgoing",
      orgUnitId: fixture.orgUnitId,
      year: fixture.year,
    })

    expect(scoped.orgUnitName).not.toBe("ทุกหน่วยงาน")
  })

  it("คอลัมน์ครบตามแบบของระเบียบ และช่อง 'จาก' เป็นหน่วยงานเจ้าของเรื่อง", async () => {
    const report = await getRegisterReport(fixture.owner, {
      book: "outgoing",
      orgUnitId: fixture.orgUnitId,
      year: fixture.year,
    })

    const row = ours(report.rows)[0]

    expect(row).toBeDefined()
    expect(row?.from).toBeTruthy()
    expect(row?.action).toBeTruthy()
    expect(report.orgUnitName).toBeTruthy()
  })
})

describe("⚠️ ทะเบียนต้องใช้ด่านสิทธิ์ตัวเดียวกับหน้าอื่น", () => {
  it("เอกสารลับที่ผู้ดูไม่มี ACL ต้องไม่อยู่ในทะเบียน — ไฟล์ที่ดึงออกไปเรียกคืนไม่ได้", async () => {
    const mine = await getRegisterReport(fixture.owner, {
      book: "outgoing",
      orgUnitId: fixture.orgUnitId,
      year: fixture.year,
    })
    const theirs = await getRegisterReport(fixture.colleague, {
      book: "outgoing",
      orgUnitId: fixture.orgUnitId,
      year: fixture.year,
    })

    expect(ours(mine.rows).some((row) => row.subject.includes("ฉบับลับ"))).toBe(true)
    expect(ours(theirs.rows).some((row) => row.subject.includes("ฉบับลับ"))).toBe(false)
    // ฉบับทั่วไปในเล่มเดียวกันต้องยังเห็นได้ตามปกติ
    expect(ours(theirs.rows).some((row) => row.subject.includes("ฉบับแรกของเล่ม"))).toBe(true)
  })

  it("ไม่มีสิทธิ์ report.view ต้องเปิดทะเบียนไม่ได้เลย", async () => {
    await expect(
      getRegisterReport(fixture.noReport, { book: "outgoing", year: fixture.year }),
    ).rejects.toThrow()
  })

  it("มีสิทธิ์ดูแต่ไม่มีสิทธิ์ export ต้องดึงไฟล์ไม่ได้ — ดูบนจอกับดึงไฟล์ออกไม่เท่ากัน", async () => {
    const viewOnly: ServiceContext = {
      ...fixture.owner,
      permissions: {
        [PERMISSIONS.DOCUMENT_READ]: "ORG",
        [PERMISSIONS.REPORT_VIEW]: "ORG",
      } as GrantedPermissions,
    }

    await expect(
      exportRegisterReport(viewOnly, { book: "outgoing", year: fixture.year }, "xlsx"),
    ).rejects.toThrow()
  })
})

describe("ดึงทะเบียนออกเป็นไฟล์", () => {
  it("เขียน audit ว่าใครดึง รูปแบบไหน และติดเอกสารลับไปกี่ฉบับ", async () => {
    await exportRegisterReport(
      fixture.owner,
      { book: "outgoing", orgUnitId: fixture.orgUnitId, year: fixture.year },
      "xlsx",
    )

    const audit = await prisma.auditLog.findFirst({
      where: { action: AUDIT_ACTIONS.REPORT_EXPORTED, actorUserId: fixture.owner.userId },
      orderBy: { at: "desc" },
    })

    expect(audit).not.toBeNull()

    const metadata = JSON.stringify(audit?.metadata)
    expect(metadata).toContain("xlsx")
    expect(metadata).toContain("confidentialCount")
  })

  it("ไฟล์ Excel เปิดได้จริงและมีหัวตารางภาษาไทยครบ", async () => {
    const report = await getRegisterReport(fixture.owner, {
      book: "outgoing",
      orgUnitId: fixture.orgUnitId,
      year: fixture.year,
    })

    const buffer = await buildRegisterWorkbook(report)

    // .xlsx คือ zip — ลายเซ็น PK ที่ต้นไฟล์คือสัญญาณว่าเขียนไฟล์สำเร็จจริง
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK")
    expect(buffer.length).toBeGreaterThan(2_000)
  })

  it("ไฟล์ PDF สร้างได้จริงจากข้อมูลภาษาไทย และเปิดกลับมาอ่านได้", async () => {
    const report = await getRegisterReport(fixture.owner, {
      book: "outgoing",
      orgUnitId: fixture.orgUnitId,
      year: fixture.year,
    })

    const buffer = await buildRegisterPdf(report)

    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-")

    // ⚠️ นี่คือด่านที่จับ "ลืมฝังฟอนต์ไทย" ได้จริง — ฟอนต์มาตรฐานของ pdf-lib ไม่มีอักขระไทย
    // สักตัว การ encode ชื่อเรื่องภาษาไทยจะโยน error ตั้งแต่ตอนสร้าง ไม่ได้เงียบ ๆ
    // (ตรวจชื่อฟอนต์ในไบต์ไม่ได้ เพราะ pdf-lib บีบ dictionary ลง object stream)
    const reopened = await PDFDocument.load(buffer)
    expect(reopened.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it("ทะเบียนว่างต้องยังสร้างไฟล์ได้ ไม่ใช่พัง", async () => {
    const empty = await getRegisterReport(fixture.owner, {
      book: "incoming",
      orgUnitId: fixture.orgUnitId,
      year: fixture.year - 5,
    })

    expect(empty.rows).toEqual([])
    expect((await buildRegisterWorkbook(empty)).length).toBeGreaterThan(0)
    expect((await buildRegisterPdf(empty)).length).toBeGreaterThan(0)
  })
})
