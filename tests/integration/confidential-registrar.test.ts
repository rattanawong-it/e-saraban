import "dotenv/config"

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { AUDIT_ACTIONS } from "@/lib/audit"
import { PERMISSIONS, type GrantedPermissions } from "@/lib/authz"
import { prisma } from "@/lib/db"
import type { ServiceContext } from "@/server/context"
import { listDocumentAcl, revokeDocumentAcl } from "@/server/services/acl.service"
import { listDocuments } from "@/server/services/document-list.service"
import { createDocument, submitDocument } from "@/server/services/document.service"
import { issueNumber } from "@/server/services/numbering.service"

// นายทะเบียนหนังสือลับ (ระเบียบว่าด้วยการรักษาความลับของทางราชการ 2544 · spec §4.3 ข้อ 5)
//
// ⚠️ ปัญหาที่ชุดนี้กันไว้: เจ้าหน้าที่สารบรรณ **ออกเลขให้เอกสารลับไม่ได้เลย** ตั้งแต่ P3
// เพราะ can() บังคับว่าเอกสารชั้น ≥1 ต้องมี ACL ระบุตัวบุคคล แต่ ACL อัตโนมัติของ P3
// ออกให้แค่ผู้สร้าง · ผู้รับ · คนปรับชั้น — ไม่มีสารบรรณ · ไม่มีเทสต์ไหนเดินผ่านเส้นทางนี้
// จึงไม่มีใครเจอ จนกระทั่งด่านของ "รายการ" ใน P4 ทำให้เอกสารลับหายจากคิวไปเงียบ ๆ ด้วย
//
// ทางออก: หน่วยงานตั้งนายทะเบียนหนังสือลับไว้ (ได้หลายคน เผื่อคนหลักลา) แล้วระบบออก ACL
// ชนิด REGISTER ให้เองตอนส่งเข้าคิว — ออกเลขและเห็นแถวในทะเบียนได้ แต่เปิดไฟล์แนบไม่ได้

const PREFIX = "[integration-registrar]"
const BOOK_CODE = "TESTREG"

interface Fixture {
  /** เจ้าของเรื่อง — สร้างเอกสารลับ ได้ ACL MANAGE อัตโนมัติตั้งแต่ P3 */
  author: ServiceContext
  /** สารบรรณที่กดออกเลข — ไม่ใช่ผู้สร้าง จึงไม่มี ACL ติดตัวมาเลย */
  clerk: ServiceContext
  /** สารบรรณอีกคนที่ไม่ได้ถูกตั้งเป็นนายทะเบียน — ต้องออกเลขเอกสารลับไม่ได้ */
  otherClerk: ServiceContext
  /** ผู้ช่วยนายทะเบียน — ชั้นความลับถึงเหมือนกัน ใช้พิสูจน์ว่าตั้งได้หลายคน */
  assistantUserId: string
  /** ชั้นความลับไม่ถึงเอกสารชั้น 2 — ตั้งเป็นนายทะเบียนได้แต่แตะฉบับนี้ไม่ได้ */
  lowClearanceUserId: string
  tenantId: string
  orgUnitId: string
  memoTypeId: string
}

let fixture: Fixture
const createdDocumentIds: string[] = []

const AUTHOR_PERMISSIONS = {
  [PERMISSIONS.DOCUMENT_CREATE]: "ORG",
  [PERMISSIONS.DOCUMENT_READ]: "ORG",
  [PERMISSIONS.DOCUMENT_SUBMIT]: "ORG",
  [PERMISSIONS.CONFIDENTIAL_ACCESS]: "ORG",
  [PERMISSIONS.ATTACHMENT_GRANT]: "ORG",
} as GrantedPermissions

/** สิทธิ์ของสารบรรณ — ออกเลขได้ทั้งองค์กรตามบทบาท แต่ยังต้องผ่านด่าน ACL ของเอกสารลับ */
const CLERK_PERMISSIONS = {
  [PERMISSIONS.DOCUMENT_READ]: "ORG",
  [PERMISSIONS.DOCUMENT_NUMBER_ISSUE]: "ORG",
  [PERMISSIONS.CONFIDENTIAL_ACCESS]: "ORG",
  [PERMISSIONS.ATTACHMENT_GRANT]: "ORG",
} as GrantedPermissions

async function makeDocument(subject: string, confidentialityLevel = 2) {
  const document = await createDocument(fixture.author, {
    documentTypeId: fixture.memoTypeId,
    subject: `${PREFIX} ${subject}`,
    confidentialityLevel,
    urgencyLevel: 0,
    recipients: [],
  })

  createdDocumentIds.push(document.id)
  return document
}

async function setRegistrars(userIds: string[]) {
  await prisma.confidentialRegistrar.deleteMany({ where: { orgUnitId: fixture.orgUnitId } })

  for (const userId of userIds) {
    await prisma.confidentialRegistrar.create({
      data: { orgUnitId: fixture.orgUnitId, userId, assignedById: fixture.author.userId },
    })
  }
}

beforeAll(async () => {
  const tenant = await prisma.tenant.findUnique({ where: { code: "KRIRK" } })
  if (!tenant) throw new Error("ยังไม่ได้ seed — รัน pnpm db:seed ก่อน")

  const orgUnit = await prisma.orgUnit.findFirst({
    where: { tenantId: tenant.id, code: "510000", canIssueNumber: true },
  })
  const author = await prisma.user.findFirst({ where: { username: "dean.eng" } })
  const clerk = await prisma.user.findFirst({ where: { username: "registrar" } })
  const otherClerk = await prisma.user.findFirst({ where: { username: "admin" } })
  const assistant = await prisma.user.findFirst({ where: { username: "rattana.wong" } })
  const lowClearance = await prisma.user.findFirst({ where: { username: "somchai.j" } })

  if (!orgUnit || !author || !clerk || !otherClerk || !assistant || !lowClearance) {
    throw new Error("ข้อมูล seed ไม่ครบ")
  }

  // ⚠️ ด่านนี้อ่านชั้นความลับจาก **ฐานข้อมูล** ไม่ใช่จาก context ที่เทสต์ประกอบเอง
  // ถ้าฐาน dev ถูกแก้ชั้นความลับด้วยมือ เทสต์จะเพี้ยนแบบงง ๆ — ตรวจให้ชัดตั้งแต่ตรงนี้
  if (
    clerk.clearanceLevel < 2 ||
    assistant.clearanceLevel < 2 ||
    lowClearance.clearanceLevel >= 2
  ) {
    throw new Error(
      `ชั้นความลับบนฐานไม่ตรงกับที่ชุดเทสต์นี้ต้องการ (registrar=${clerk.clearanceLevel} · rattana.wong=${assistant.clearanceLevel} · somchai.j=${lowClearance.clearanceLevel})`,
    )
  }

  const documentType = await prisma.documentType.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "TEST_REG_MEMO" } },
    update: { defaultBookCode: BOOK_CODE },
    create: {
      tenantId: tenant.id,
      code: "TEST_REG_MEMO",
      nameTh: "ประเภททดสอบนายทะเบียนลับ",
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
    sessionId: "integration-test",
    ip: "127.0.0.1",
    userAgent: "vitest",
  } satisfies Partial<ServiceContext>

  fixture = {
    author: {
      ...base,
      userId: author.id,
      roleCodes: ["DEPT_OFFICER"],
      permissions: AUTHOR_PERMISSIONS,
      clearanceLevel: 3,
    },
    clerk: {
      ...base,
      userId: clerk.id,
      roleCodes: ["CENTRAL_REGISTRAR"],
      permissions: CLERK_PERMISSIONS,
      clearanceLevel: 3,
    },
    otherClerk: {
      ...base,
      userId: otherClerk.id,
      roleCodes: ["CENTRAL_REGISTRAR"],
      permissions: CLERK_PERMISSIONS,
      clearanceLevel: 3,
    },
    assistantUserId: assistant.id,
    lowClearanceUserId: lowClearance.id,
    tenantId: tenant.id,
    orgUnitId: orgUnit.id,
    memoTypeId: documentType.id,
  }
})

beforeEach(async () => {
  if (!fixture) return
  await prisma.confidentialRegistrar.deleteMany({ where: { orgUnitId: fixture.orgUnitId } })
})

afterAll(async () => {
  if (!fixture) return

  await prisma.confidentialRegistrar.deleteMany({ where: { orgUnitId: fixture.orgUnitId } })
  await prisma.documentAcl.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  await prisma.documentRecipient.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  await prisma.documentAction.deleteMany({ where: { documentId: { in: createdDocumentIds } } })
  await prisma.document.deleteMany({ where: { id: { in: createdDocumentIds } } })
  await prisma.numberSequence.deleteMany({
    where: { tenantId: fixture.tenantId, bookCode: BOOK_CODE },
  })
  await prisma.documentType.deleteMany({
    where: { tenantId: fixture.tenantId, code: "TEST_REG_MEMO" },
  })
  await prisma.$disconnect()
})

describe("ส่งเอกสารลับเข้าคิวออกเลข", () => {
  it("⚠️ หน่วยงานที่ยังไม่ได้ตั้งนายทะเบียนต้องส่งไม่ได้ พร้อมบอกว่าให้ไปตั้งก่อน", async () => {
    const document = await makeDocument("ฉบับที่ยังไม่มีนายทะเบียน")

    await expect(submitDocument(fixture.author, document.id)).rejects.toThrow(
      /นายทะเบียนหนังสือลับ/,
    )

    // ต้อง rollback ครบ — เอกสารยังเป็นร่างเหมือนเดิม ไม่ใช่ค้างครึ่งทาง
    const after = await prisma.document.findUniqueOrThrow({ where: { id: document.id } })
    expect(after.status).toBe("DRAFT")
  })

  it("ตั้งนายทะเบียนแล้วส่งได้ และนายทะเบียนได้ ACL ชนิด REGISTER อัตโนมัติ", async () => {
    await setRegistrars([fixture.clerk.userId])

    const document = await makeDocument("ฉบับที่มีนายทะเบียนแล้ว")
    await submitDocument(fixture.author, document.id)

    const acl = await prisma.documentAcl.findFirst({
      where: { documentId: document.id, principalId: fixture.clerk.userId },
    })

    expect(acl?.permission).toBe("REGISTER")
    expect(acl?.effect).toBe("ALLOW")
    // ถาวร — นายทะเบียนต้องดูแลทะเบียนหนังสือลับย้อนหลังได้
    expect(acl?.expiresAt).toBeNull()
  })

  it("ตั้งได้หลายคน ทุกคนได้สิทธิ์ — ผู้ช่วยนายทะเบียนต้องทำงานแทนกันได้ตอนคนหลักลา", async () => {
    await setRegistrars([fixture.clerk.userId, fixture.assistantUserId])

    const document = await makeDocument("ฉบับที่มีนายทะเบียนสองคน")
    await submitDocument(fixture.author, document.id)

    const acls = await prisma.documentAcl.findMany({
      where: { documentId: document.id, permission: "REGISTER" },
      select: { principalId: true },
    })

    expect(acls.map((row) => row.principalId).sort()).toEqual(
      [fixture.clerk.userId, fixture.assistantUserId].sort(),
    )
  })

  it("⚠️ นายทะเบียนที่ชั้นความลับไม่ถึงต้องไม่ผ่าน และต้องบอกชื่อออกมาตรง ๆ", async () => {
    await setRegistrars([fixture.lowClearanceUserId])

    const document = await makeDocument("ฉบับชั้น 2 ที่นายทะเบียนชั้นไม่ถึง", 2)

    await expect(submitDocument(fixture.author, document.id)).rejects.toThrow(/ชั้นความลับ/)
  })

  it("มีนายทะเบียนชั้นถึงอยู่อย่างน้อยหนึ่งคนก็พอ — คนที่ชั้นไม่ถึงแค่ไม่ได้รับสิทธิ์ฉบับนั้น", async () => {
    await setRegistrars([fixture.clerk.userId, fixture.lowClearanceUserId])

    const document = await makeDocument("ฉบับที่นายทะเบียนชั้นถึงบางคน")
    await submitDocument(fixture.author, document.id)

    const acls = await prisma.documentAcl.findMany({
      where: { documentId: document.id, permission: "REGISTER" },
      select: { principalId: true },
    })

    expect(acls.map((row) => row.principalId)).toEqual([fixture.clerk.userId])
  })

  it("เอกสารชั้น 0 ไม่ต้องมีนายทะเบียน และต้องไม่มีแถว ACL ทิ้งไว้ให้รก", async () => {
    const document = await makeDocument("ฉบับทั่วไปที่ไม่ลับ", 0)
    await submitDocument(fixture.author, document.id)

    const count = await prisma.documentAcl.count({ where: { documentId: document.id } })

    expect(count).toBe(0)
  })

  it("การออก ACL ให้นายทะเบียนต้องมีร่องรอยใน audit", async () => {
    await setRegistrars([fixture.clerk.userId])

    const document = await makeDocument("ฉบับที่ต้องมี audit")
    await submitDocument(fixture.author, document.id)

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityId: document.id,
        action: AUDIT_ACTIONS.DOCUMENT_ACL_GRANTED,
        actorUserId: fixture.author.userId,
      },
      orderBy: { at: "desc" },
    })

    expect(audit).not.toBeNull()
    expect(JSON.stringify(audit?.metadata)).toContain("REGISTER")
  })
})

describe("นายทะเบียนทำงานกับเอกสารลับได้จริง", () => {
  it("⚠️ ออกเลขทะเบียนให้เอกสารลับได้ — เส้นทางที่พังมาตั้งแต่ P3", async () => {
    await setRegistrars([fixture.clerk.userId])

    const document = await makeDocument("ฉบับที่นายทะเบียนจะออกเลขให้")
    await submitDocument(fixture.author, document.id)

    const issued = await issueNumber(fixture.clerk, document.id)

    expect(issued.docNo).toBeTruthy()
  })

  it("เห็นเอกสารลับในคิวออกเลข — ไม่งั้นก็ไม่มีทางกดออกเลขได้ถึงจะมีสิทธิ์", async () => {
    await setRegistrars([fixture.clerk.userId])

    const document = await makeDocument("ฉบับที่ต้องโผล่ในคิว")
    await submitDocument(fixture.author, document.id)

    const queue = await listDocuments(fixture.clerk, { scope: "queue", pageSize: 100 })

    expect(queue.rows.some((row) => row.id === document.id)).toBe(true)
  })

  it("⚠️ สารบรรณที่ไม่ได้ถูกตั้งเป็นนายทะเบียนต้องยังออกเลขไม่ได้", async () => {
    await setRegistrars([fixture.clerk.userId])

    const document = await makeDocument("ฉบับที่คนอื่นจะแอบออกเลข")
    await submitDocument(fixture.author, document.id)

    await expect(issueNumber(fixture.otherClerk, document.id)).rejects.toThrow()

    // และต้องไม่เห็นในคิวของตัวเองด้วย
    const queue = await listDocuments(fixture.otherClerk, { scope: "queue", pageSize: 100 })
    expect(queue.rows.some((row) => row.id === document.id)).toBe(false)
  })

  it("สิทธิ์ที่ได้คือ REGISTER ไม่ใช่ MANAGE — ต้องไม่กลายเป็นเจ้าของเรื่องคนที่สอง", async () => {
    await setRegistrars([fixture.clerk.userId])

    const document = await makeDocument("ฉบับที่ตรวจระดับสิทธิ์")
    await submitDocument(fixture.author, document.id)

    const rows = await listDocumentAcl(fixture.author, document.id)
    const registrarRow = rows.find((row) => row.userId === fixture.clerk.userId)

    expect(registrarRow?.permission).toBe("REGISTER")
    expect(registrarRow?.isAutomatic).toBe(true)
  })

  it("⚠️ ถอนสิทธิ์นายทะเบียนด้วยมือไม่ได้ — ไม่งั้นเอกสารจะค้างคิวโดยไม่มีใครออกเลขให้", async () => {
    await setRegistrars([fixture.clerk.userId])

    const document = await makeDocument("ฉบับที่จะลองถอนสิทธิ์นายทะเบียน")
    await submitDocument(fixture.author, document.id)

    const rows = await listDocumentAcl(fixture.author, document.id)
    const registrarRow = rows.find((row) => row.userId === fixture.clerk.userId)

    await expect(
      revokeDocumentAcl(fixture.author, document.id, registrarRow?.id ?? ""),
    ).rejects.toThrow(/นายทะเบียน/)
  })
})
