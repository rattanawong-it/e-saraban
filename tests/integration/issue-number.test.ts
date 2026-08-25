import "dotenv/config"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { verifyAuditChain } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { PERMISSIONS, type GrantedPermissions } from "@/lib/authz"
import { issueNumber } from "@/server/services/numbering.service"
import type { ServiceContext } from "@/server/context"

// ⚠️ Definition of Done ของ P2 (spec §13 · §14): "test เลขซ้ำผ่าน"
//
// สเปก §7.3 กำหนดไว้ตรง ๆ ว่า "ยิง issueNumber 50 ครั้งพร้อมกัน → ต้องได้เลข 1–50
// ครบ ไม่ซ้ำ ไม่ข้าม" · เทสต์ชุดนี้เรียก service ตัวจริงบน Postgres จริง
// ไม่ mock อะไรเลย เพราะสิ่งที่กำลังทดสอบคือพฤติกรรมของฐานข้อมูลตอนมีคนแย่งกันเขียน

const CONCURRENCY = 50

/** ใช้รหัสเฉพาะกิจ ไม่ชนกับข้อมูลจริงและลบทิ้งได้หมดหลังเทสต์ */
const TEST_TYPE_CODE = "TEST_CONCURRENCY"
const TEST_SUBJECT_PREFIX = "[integration] ทดสอบออกเลขพร้อมกัน"
const TEST_BOOK_CODE = "TEST"

interface Fixture {
  ctx: ServiceContext
  tenantId: string
  orgUnitId: string
  documentTypeId: string
  documentIds: string[]
  year: number
}

let fixture: Fixture

beforeAll(async () => {
  const tenant = await prisma.tenant.findUnique({ where: { code: "KRIRK" } })
  if (!tenant) throw new Error("ยังไม่ได้ seed — รัน pnpm db:seed ก่อน")

  // หน่วยงานที่ออกเลขได้จริงตาม D15
  const orgUnit = await prisma.orgUnit.findFirst({
    where: { tenantId: tenant.id, code: "510000", canIssueNumber: true },
  })
  if (!orgUnit) throw new Error("ไม่พบหน่วยงาน 510000 ที่ออกเลขได้")

  const user = await prisma.user.findFirst({ where: { username: "registrar" } })
  if (!user) throw new Error("ไม่พบผู้ใช้ registrar")

  const documentType = await prisma.documentType.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: TEST_TYPE_CODE } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: TEST_TYPE_CODE,
      nameTh: "เอกสารทดสอบ concurrency",
      direction: "INTERNAL",
      numberPattern: null,
    },
  })

  // เอกสาร 50 ฉบับที่รอออกเลขอยู่ — สถานะต้องเป็น PENDING_NUMBER ตามด่าน STATE
  const documentIds: string[] = []
  for (let index = 0; index < CONCURRENCY; index += 1) {
    const document = await prisma.document.create({
      data: {
        tenantId: tenant.id,
        documentTypeId: documentType.id,
        direction: "INTERNAL",
        status: "PENDING_NUMBER",
        bookCode: TEST_BOOK_CODE,
        subject: `${TEST_SUBJECT_PREFIX} ฉบับที่ ${index + 1}`,
        ownerUnitId: orgUnit.id,
        createdById: user.id,
        createdByUnitId: orgUnit.id,
      },
    })
    documentIds.push(document.id)
  }

  const permissions = {
    [PERMISSIONS.DOCUMENT_NUMBER_ISSUE]: "ORG",
  } as GrantedPermissions

  fixture = {
    ctx: {
      userId: user.id,
      tenantId: tenant.id,
      isActive: true,
      activeOrgUnitId: orgUnit.id,
      activeOrgUnitPath: orgUnit.path,
      orgUnitIds: [orgUnit.id],
      roleCodes: ["CENTRAL_REGISTRAR"],
      permissions,
      clearanceLevel: 3,
      sessionId: "integration-test",
      ip: "127.0.0.1",
      userAgent: "vitest",
    },
    tenantId: tenant.id,
    orgUnitId: orgUnit.id,
    documentTypeId: documentType.id,
    documentIds,
    year: 0,
  }
})

afterAll(async () => {
  if (!fixture) return

  // audit log ลบไม่ได้ตามดีไซน์ (append-only) — ที่เหลือเก็บกวาดให้หมด
  await prisma.documentAction.deleteMany({ where: { documentId: { in: fixture.documentIds } } })
  await prisma.document.deleteMany({ where: { id: { in: fixture.documentIds } } })
  await prisma.numberSequence.deleteMany({
    where: { tenantId: fixture.tenantId, orgUnitId: fixture.orgUnitId, bookCode: TEST_BOOK_CODE },
  })
  await prisma.documentType.deleteMany({
    where: { tenantId: fixture.tenantId, code: TEST_TYPE_CODE },
  })
  await prisma.$disconnect()
})

describe("issueNumber — ยิงพร้อมกัน 50 ครั้ง (spec §7.3)", () => {
  it("ได้เลข 1–50 ครบ ไม่ซ้ำ ไม่ข้าม", async () => {
    const results = await Promise.all(
      fixture.documentIds.map((documentId) => issueNumber(fixture.ctx, documentId)),
    )

    fixture.year = results[0]?.year ?? 0

    const sequences = results.map((result) => result.seqValue).sort((a, b) => a - b)
    const expected = Array.from({ length: CONCURRENCY }, (_, index) => index + 1)

    expect(sequences).toEqual(expected)
    expect(new Set(results.map((result) => result.docNo)).size).toBe(CONCURRENCY)
  })

  it("เลขที่ render ตรงกับ pattern ค่าปริยาย {unitCode}/{seq:4}", async () => {
    const documents = await prisma.document.findMany({
      where: { id: { in: fixture.documentIds } },
      select: { docNo: true, seqValue: true, year: true, status: true },
      orderBy: { seqValue: "asc" },
    })

    expect(documents).toHaveLength(CONCURRENCY)
    expect(documents[0]?.docNo).toBe("510000/0001")
    expect(documents.at(-1)?.docNo).toBe(`510000/${String(CONCURRENCY).padStart(4, "0")}`)
    expect(documents.every((document) => document.status === "REGISTERED")).toBe(true)
    expect(documents.every((document) => document.year === fixture.year)).toBe(true)
  })

  it("ตัวนับในฐานข้อมูลตรงกับจำนวนที่ออกไป — ไม่มีเลขถูกกินทิ้ง", async () => {
    const sequence = await prisma.numberSequence.findFirst({
      where: {
        tenantId: fixture.tenantId,
        orgUnitId: fixture.orgUnitId,
        direction: "INTERNAL",
        bookCode: TEST_BOOK_CODE,
        year: fixture.year,
      },
    })

    expect(sequence?.lastValue).toBe(CONCURRENCY)
  })

  it("ทุกฉบับมี timeline NUMBER_ISSUED หนึ่งรายการ", async () => {
    const actions = await prisma.documentAction.findMany({
      where: { documentId: { in: fixture.documentIds }, actionType: "NUMBER_ISSUED" },
      select: { documentId: true, fromStatus: true, toStatus: true },
    })

    expect(actions).toHaveLength(CONCURRENCY)
    expect(actions.every((action) => action.fromStatus === "PENDING_NUMBER")).toBe(true)
    expect(actions.every((action) => action.toStatus === "REGISTERED")).toBe(true)
  })

  it("hash chain ของ audit ยังต่อกันครบหลังเขียนพร้อมกัน 50 รายการ", async () => {
    // writeAudit() จับ advisory lock ต่อ tenant ก่อนต่อ hash — ถ้าล็อกนั้นพลาด
    // จะมี seq ซ้ำหรือ prevHash ไม่ต่อกัน แล้ว verifyAuditChain จะจับได้ทันที
    const result = await verifyAuditChain(fixture.tenantId)

    expect(result.valid).toBe(true)
    expect(result.checked).toBeGreaterThanOrEqual(CONCURRENCY)
  })

  it("ออกเลขซ้ำให้ฉบับเดิมไม่ได้ — สถานะไม่ใช่ PENDING_NUMBER แล้ว", async () => {
    const documentId = fixture.documentIds[0]
    if (!documentId) throw new Error("ไม่มีเอกสารสำหรับทดสอบ")

    await expect(issueNumber(fixture.ctx, documentId)).rejects.toThrow()
  })
})
