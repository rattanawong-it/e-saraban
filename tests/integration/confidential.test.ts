import "dotenv/config"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { PERMISSIONS, type GrantedPermissions } from "@/lib/authz"
import { prisma } from "@/lib/db"
import type { ServiceContext } from "@/server/context"
import {
  circulateDocument,
  createDocument,
  getDocument,
  submitDocument,
  updateDocument,
} from "@/server/services/document.service"
import {
  grantDocumentAcl,
  listDocumentAcl,
  revokeDocumentAcl,
  searchGrantees,
} from "@/server/services/acl.service"
import { issueNumber } from "@/server/services/numbering.service"

// เอกสารชั้นความลับ (spec §4.3 ข้อ 5 · §9.1)
//
// ⚠️ เส้นทางนี้ใช้งานจริงไม่ได้เลยตั้งแต่ P2 — can() บังคับว่าเอกสารลับต้องมี ACL
// ระบุตัวบุคคล แต่ไม่มีโค้ดตรงไหนสร้าง DocumentAcl เลยสักที่
// ชุดนี้กันไม่ให้กลับไปเป็นแบบนั้นอีก

const PREFIX = "[integration-confidential]"
const BOOK_CODE = "TESTCONF"

interface Fixture {
  ctx: ServiceContext
  recipientCtx: ServiceContext
  tenantId: string
  documentTypeId: string
  recipientUserId: string
  /** ผู้ใช้ที่ชั้นความลับเป็น 0 — ใช้ทดสอบด่าน CLEARANCE */
  lowClearanceUserId: string
  otherUnitId: string
}

let fixture: Fixture
const createdDocumentIds: string[] = []

const AUTHOR_PERMISSIONS = {
  [PERMISSIONS.DOCUMENT_CREATE]: "ORG",
  [PERMISSIONS.DOCUMENT_READ]: "ORG",
  [PERMISSIONS.DOCUMENT_UPDATE]: "ORG",
  [PERMISSIONS.DOCUMENT_SUBMIT]: "ORG",
  [PERMISSIONS.DOCUMENT_NUMBER_ISSUE]: "ORG",
  [PERMISSIONS.DOCUMENT_CIRCULATE]: "ORG",
  [PERMISSIONS.CONFIDENTIAL_ACCESS]: "ORG",
  [PERMISSIONS.ATTACHMENT_GRANT]: "ORG",
} as GrantedPermissions

/** ผู้รับมีสิทธิ์แค่ระดับหน่วยงานตัวเอง — ต้องพึ่ง ACL อย่างเดียวจึงจะเปิดเอกสารได้ */
const RECIPIENT_PERMISSIONS = {
  [PERMISSIONS.DOCUMENT_READ]: "UNIT",
  [PERMISSIONS.CONFIDENTIAL_ACCESS]: "UNIT",
  // มีสิทธิ์ให้สิทธิ์ตามบทบาท แต่ ACL ที่ได้รับเป็นแค่ DOWNLOAD
  // จึงต้องยังให้สิทธิ์ต่อไม่ได้ — เป็นด่านกันการยกระดับตัวเองบนเอกสารลับ
  [PERMISSIONS.ATTACHMENT_GRANT]: "UNIT",
} as GrantedPermissions

beforeAll(async () => {
  const tenant = await prisma.tenant.findUnique({ where: { code: "KRIRK" } })
  const orgUnit = await prisma.orgUnit.findFirst({ where: { code: "510000" } })
  const otherUnit = await prisma.orgUnit.findFirst({
    where: { code: { not: "510000" }, isActive: true },
  })
  const author = await prisma.user.findFirst({ where: { username: "registrar" } })
  const recipient = await prisma.user.findFirst({ where: { username: "dean.eng" } })
  const lowClearance = await prisma.user.findFirst({ where: { username: "somchai.j" } })

  if (!tenant || !orgUnit || !otherUnit || !author || !recipient || !lowClearance) {
    throw new Error("ยังไม่ได้ seed — รัน pnpm db:seed ก่อน")
  }

  const documentType = await prisma.documentType.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "TEST_CONF_MEMO" } },
    update: { defaultBookCode: BOOK_CODE },
    create: {
      tenantId: tenant.id,
      code: "TEST_CONF_MEMO",
      nameTh: "ประเภททดสอบเอกสารลับ",
      direction: "INTERNAL",
      defaultBookCode: BOOK_CODE,
    },
  })

  const ctx: ServiceContext = {
    userId: author.id,
    tenantId: tenant.id,
    isActive: true,
    activeOrgUnitId: orgUnit.id,
    activeOrgUnitPath: orgUnit.path,
    orgUnitIds: [orgUnit.id],
    roleCodes: ["CENTRAL_REGISTRAR"],
    permissions: AUTHOR_PERMISSIONS,
    clearanceLevel: 3,
    sessionId: "integration-test",
    ip: "127.0.0.1",
    userAgent: "vitest",
  }

  fixture = {
    ctx,
    recipientCtx: {
      ...ctx,
      userId: recipient.id,
      activeOrgUnitId: otherUnit.id,
      activeOrgUnitPath: otherUnit.path,
      orgUnitIds: [otherUnit.id],
      roleCodes: ["DEPT_OFFICER"],
      permissions: RECIPIENT_PERMISSIONS,
      clearanceLevel: 3,
    },
    tenantId: tenant.id,
    documentTypeId: documentType.id,
    recipientUserId: recipient.id,
    lowClearanceUserId: lowClearance.id,
    otherUnitId: otherUnit.id,
  }
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
    where: { tenantId: fixture.tenantId, code: "TEST_CONF_MEMO" },
  })
  await prisma.$disconnect()
})

async function newConfidentialDocument(level = 2) {
  const document = await createDocument(fixture.ctx, {
    documentTypeId: fixture.documentTypeId,
    subject: `${PREFIX} เอกสารลับชั้น ${level}`,
    confidentialityLevel: level,
    urgencyLevel: 0,
    recipients: [],
  })

  createdDocumentIds.push(document.id)
  return document
}

describe("สร้างเอกสารชั้นความลับ", () => {
  it("⚠️ สร้างเอกสารชั้นลับได้ — ด่านตอนสร้างต้องไม่ตรวจ ACL ของเอกสารที่ยังไม่เกิด", async () => {
    const document = await newConfidentialDocument(2)

    expect(document.confidentialityLevel).toBe(2)
  })

  it("ผู้สร้างได้ ACL รายบุคคลอัตโนมัติ และเปิดเอกสารตัวเองได้", async () => {
    const document = await newConfidentialDocument(3)

    const acl = await prisma.documentAcl.findMany({ where: { documentId: document.id } })

    expect(acl).toHaveLength(1)
    expect(acl[0]?.principalType).toBe("USER")
    expect(acl[0]?.principalId).toBe(fixture.ctx.userId)
    expect(acl[0]?.permission).toBe("MANAGE")

    await expect(getDocument(fixture.ctx, document.id)).resolves.toMatchObject({ id: document.id })
  })

  it("เอกสารชั้น 0 ไม่ต้องมี ACL — ไม่สร้างแถวทิ้งไว้ให้รก", async () => {
    const document = await createDocument(fixture.ctx, {
      documentTypeId: fixture.documentTypeId,
      subject: `${PREFIX} เอกสารทั่วไป`,
      confidentialityLevel: 0,
      urgencyLevel: 0,
      recipients: [],
    })
    createdDocumentIds.push(document.id)

    expect(await prisma.documentAcl.count({ where: { documentId: document.id } })).toBe(0)
  })

  it("การให้ ACL อัตโนมัติต้องมีร่องรอยใน audit", async () => {
    const document = await newConfidentialDocument(2)

    const audit = await prisma.auditLog.findFirst({
      where: { action: "document.acl.granted", entityId: document.id },
    })

    expect(audit).not.toBeNull()
    expect(audit?.severity).toBe("NOTICE")
  })
})

describe("เวียนเอกสารชั้นความลับ", () => {
  it("⚠️ เวียนถึงทั้งหน่วยงานไม่ได้ — §4.3 ข้อ 5 ห้าม inherit สิทธิ์จาก scope", async () => {
    const document = await newConfidentialDocument(2)
    await submitDocument(fixture.ctx, document.id)
    await issueNumber(fixture.ctx, document.id)

    await expect(
      circulateDocument(fixture.ctx, document.id, [{ orgUnitId: fixture.otherUnitId, kind: "TO" }]),
    ).rejects.toThrow(/ระบุผู้รับเป็นรายบุคคล/)
  })

  it("เวียนถึงรายบุคคลแล้วผู้รับได้ ACL และเปิดอ่านได้จริง", async () => {
    const document = await newConfidentialDocument(2)
    await submitDocument(fixture.ctx, document.id)
    await issueNumber(fixture.ctx, document.id)

    // ก่อนเวียน ผู้รับยังเปิดไม่ได้ — อยู่คนละหน่วยงานและยังไม่มี ACL
    await expect(getDocument(fixture.recipientCtx, document.id)).rejects.toThrow()

    await circulateDocument(fixture.ctx, document.id, [
      { userId: fixture.recipientUserId, kind: "TO" },
    ])

    const acl = await prisma.documentAcl.findFirst({
      where: { documentId: document.id, principalId: fixture.recipientUserId },
    })

    expect(acl?.permission).toBe("DOWNLOAD")
    await expect(getDocument(fixture.recipientCtx, document.id)).resolves.toMatchObject({
      id: document.id,
    })
  })

  it("เอกสารชั้น 0 ยังเวียนถึงทั้งหน่วยงานได้ตามปกติ", async () => {
    const document = await createDocument(fixture.ctx, {
      documentTypeId: fixture.documentTypeId,
      subject: `${PREFIX} เอกสารทั่วไปที่เวียนถึงหน่วยงาน`,
      confidentialityLevel: 0,
      urgencyLevel: 0,
      recipients: [],
    })
    createdDocumentIds.push(document.id)

    await submitDocument(fixture.ctx, document.id)
    await issueNumber(fixture.ctx, document.id)

    await expect(
      circulateDocument(fixture.ctx, document.id, [{ orgUnitId: fixture.otherUnitId, kind: "TO" }]),
    ).resolves.toBeTruthy()
  })
})

describe("ปรับชั้นความลับขึ้นภายหลัง", () => {
  it("⚠️ คนที่ปรับชั้นต้องไม่ล็อกตัวเองออกจากเอกสารที่เพิ่งแก้", async () => {
    const document = await createDocument(fixture.ctx, {
      documentTypeId: fixture.documentTypeId,
      subject: `${PREFIX} ร่างที่จะปรับเป็นชั้นลับ`,
      confidentialityLevel: 0,
      urgencyLevel: 0,
      recipients: [],
    })
    createdDocumentIds.push(document.id)

    await updateDocument(fixture.ctx, {
      id: document.id,
      documentTypeId: fixture.documentTypeId,
      subject: `${PREFIX} ปรับเป็นชั้นลับแล้ว`,
      confidentialityLevel: 2,
      urgencyLevel: 0,
    })

    await expect(getDocument(fixture.ctx, document.id)).resolves.toMatchObject({
      confidentialityLevel: 2,
    })
  })

  it("มีผู้รับเป็นหน่วยงานค้างอยู่ ต้องบอกให้แก้ผู้รับก่อน ไม่ใช่ปรับแล้วเงียบ", async () => {
    const document = await createDocument(fixture.ctx, {
      documentTypeId: fixture.documentTypeId,
      subject: `${PREFIX} ร่างที่มีผู้รับเป็นหน่วยงาน`,
      confidentialityLevel: 0,
      urgencyLevel: 0,
      recipients: [{ orgUnitId: fixture.otherUnitId, kind: "TO" }],
    })
    createdDocumentIds.push(document.id)

    await expect(
      updateDocument(fixture.ctx, {
        id: document.id,
        documentTypeId: fixture.documentTypeId,
        subject: `${PREFIX} พยายามปรับเป็นชั้นลับ`,
        confidentialityLevel: 2,
        urgencyLevel: 0,
      }),
    ).rejects.toThrow(/แก้รายชื่อผู้รับก่อน/)
  })
})

describe("ให้และถอนสิทธิ์เฉพาะรายด้วยมือ (§9.1)", () => {
  it("ให้สิทธิ์คนนอกวงได้ พร้อมเหตุผลที่บันทึกลง audit", async () => {
    const document = await newConfidentialDocument(2)

    await grantDocumentAcl(fixture.ctx, {
      documentId: document.id,
      userId: fixture.recipientUserId,
      permission: "VIEW",
      effect: "ALLOW",
      reason: "ให้ผู้ตรวจสอบภายในเข้าดูชั่วคราว",
    })

    const rows = await listDocumentAcl(fixture.ctx, document.id)
    const granted = rows.find((row) => row.userId === fixture.recipientUserId)

    expect(granted?.permission).toBe("VIEW")
    expect(granted?.isAutomatic).toBe(false)
    expect(granted?.reason).toBe("ให้ผู้ตรวจสอบภายในเข้าดูชั่วคราว")

    const audit = await prisma.auditLog.findFirst({
      where: { action: "document.acl.granted", entityId: document.id },
      orderBy: { seq: "desc" },
    })

    expect(audit?.metadata).toMatchObject({ automatic: false, permission: "VIEW" })
  })

  it("ACL ระดับ VIEW เปิดอ่านได้ แต่ยังให้สิทธิ์ต่อไม่ได้ — กันการยกระดับตัวเอง", async () => {
    const document = await newConfidentialDocument(2)

    await grantDocumentAcl(fixture.ctx, {
      documentId: document.id,
      userId: fixture.recipientUserId,
      permission: "VIEW",
      effect: "ALLOW",
      reason: "ให้ดูอย่างเดียว",
    })

    await expect(getDocument(fixture.recipientCtx, document.id)).resolves.toBeTruthy()

    // ⚠️ ด่านสำคัญ: คนที่ได้แค่ "ดูได้" ต้องดึงคนอื่นเข้ามาไม่ได้
    await expect(
      grantDocumentAcl(fixture.recipientCtx, {
        documentId: document.id,
        userId: fixture.lowClearanceUserId,
        permission: "VIEW",
        effect: "ALLOW",
        reason: "พยายามดึงคนอื่นเข้ามา",
      }),
    ).rejects.toThrow()
  })

  it("⚠️ ให้สิทธิ์คนที่ชั้นความลับไม่ถึงไม่ได้ — ให้ไปก็เปิดไม่ได้อยู่ดี", async () => {
    const document = await newConfidentialDocument(2)

    await expect(
      grantDocumentAcl(fixture.ctx, {
        documentId: document.id,
        userId: fixture.lowClearanceUserId,
        permission: "VIEW",
        effect: "ALLOW",
        reason: "ทดสอบชั้นความลับไม่ถึง",
      }),
    ).rejects.toThrow(/ต่ำกว่าชั้นของเอกสาร/)
  })

  it("ให้สิทธิ์ซ้ำคือแก้ของเดิม ไม่ใช่เพิ่มแถวใหม่", async () => {
    const document = await newConfidentialDocument(2)

    for (const reason of ["ครั้งแรก", "แก้เหตุผลใหม่"]) {
      await grantDocumentAcl(fixture.ctx, {
        documentId: document.id,
        userId: fixture.recipientUserId,
        permission: "VIEW",
        effect: "ALLOW",
        reason,
      })
    }

    const rows = await prisma.documentAcl.findMany({
      where: { documentId: document.id, principalId: fixture.recipientUserId },
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]?.reason).toBe("แก้เหตุผลใหม่")
  })

  it("วันหมดอายุต้องเป็นวันในอนาคต", async () => {
    const document = await newConfidentialDocument(2)

    await expect(
      grantDocumentAcl(fixture.ctx, {
        documentId: document.id,
        userId: fixture.recipientUserId,
        permission: "VIEW",
        effect: "ALLOW",
        expiresAt: new Date("2020-01-01"),
        reason: "ทดสอบวันหมดอายุย้อนหลัง",
      }),
    ).rejects.toThrow(/วันในอนาคต/)
  })

  it("ถอนสิทธิ์แล้วผู้ที่เคยได้ต้องเปิดเอกสารไม่ได้อีก", async () => {
    const document = await newConfidentialDocument(2)

    await grantDocumentAcl(fixture.ctx, {
      documentId: document.id,
      userId: fixture.recipientUserId,
      permission: "VIEW",
      effect: "ALLOW",
      reason: "ให้ชั่วคราวแล้วถอนคืน",
    })

    const rows = await listDocumentAcl(fixture.ctx, document.id)
    const target = rows.find((row) => row.userId === fixture.recipientUserId)
    if (!target) throw new Error("ไม่พบสิทธิ์ที่เพิ่งให้")

    await revokeDocumentAcl(fixture.ctx, document.id, target.id)

    await expect(getDocument(fixture.recipientCtx, document.id)).rejects.toThrow()

    const audit = await prisma.auditLog.findFirst({
      where: { action: "document.acl.revoked", entityId: document.id },
    })
    expect(audit).not.toBeNull()
  })

  it("⚠️ ถอนสิทธิ์ของเจ้าของเรื่องไม่ได้ — เอกสารจะไม่เหลือผู้ดูแล", async () => {
    const document = await newConfidentialDocument(2)

    const rows = await listDocumentAcl(fixture.ctx, document.id)
    const owner = rows.find((row) => row.isOwner)
    if (!owner) throw new Error("ไม่พบ ACL ของเจ้าของเรื่อง")

    await expect(revokeDocumentAcl(fixture.ctx, document.id, owner.id)).rejects.toThrow(
      /เจ้าของเรื่อง/,
    )
  })

  it("ค้นหาผู้รับสิทธิ์บอกได้ว่าใครชั้นความลับไม่ถึง", async () => {
    const document = await newConfidentialDocument(2)

    const results = await searchGrantees(fixture.ctx, document.id, "somchai")
    const low = results.find((row) => row.id === fixture.lowClearanceUserId)

    expect(low?.hasClearance).toBe(false)
    expect(await searchGrantees(fixture.ctx, document.id, "s")).toEqual([])
  })
})

describe("ชั้นความลับของผู้รับ", () => {
  it("⚠️ เวียนเอกสารลับถึงคนที่ชั้นไม่ถึงไม่ได้ ต้องบอกชื่อคนนั้นออกมาตรง ๆ", async () => {
    const document = await newConfidentialDocument(2)
    await submitDocument(fixture.ctx, document.id)
    await issueNumber(fixture.ctx, document.id)

    await expect(
      circulateDocument(fixture.ctx, document.id, [
        { userId: fixture.lowClearanceUserId, kind: "TO" },
      ]),
    ).rejects.toThrow(/ชั้นความลับไม่ถึงระดับ 2/)
  })
})
