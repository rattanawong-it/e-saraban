import { describe, expect, it } from "vitest"

import { can, canOrFalse, type AuthzAclEntry, type AuthzResource } from "./can"
import type { AuthzContext } from "./context"
import { PERMISSIONS, type GrantedPermissions } from "./permissions"

// Definition of Done ของ P1 (spec §13): "unit test ของ can() ครอบทุก scope"
// ชุดนี้จึงไล่ครบทั้ง OWN / UNIT / SUBTREE / ORG และทุกด่านของ spec §4.3

const TENANT = "tenant-1"

// ผังหน่วยงานที่ใช้ทดสอบ (path เก็บตัวเองรวมอยู่ด้วย ตาม schema)
const UNIVERSITY = { id: "u-root", path: "/u-root/" }
const FACULTY = { id: "u-eng", path: "/u-root/u-eng/" }
const DEPARTMENT = { id: "u-cpe", path: "/u-root/u-eng/u-cpe/" }
const OTHER_FACULTY = { id: "u-sci", path: "/u-root/u-sci/" }

function makeCtx(overrides: Partial<AuthzContext> = {}): AuthzContext {
  return {
    userId: "user-1",
    tenantId: TENANT,
    isActive: true,
    activeOrgUnitId: FACULTY.id,
    activeOrgUnitPath: FACULTY.path,
    orgUnitIds: [FACULTY.id],
    roleCodes: ["DEPT_OFFICER"],
    permissions: {},
    clearanceLevel: 0,
    ...overrides,
  }
}

function grants(...pairs: [string, string][]): GrantedPermissions {
  return Object.fromEntries(pairs) as GrantedPermissions
}

function makeDoc(overrides: Partial<AuthzResource> = {}): AuthzResource {
  return {
    ownerUnitId: FACULTY.id,
    ownerUnitPath: FACULTY.path,
    createdById: "user-2",
    confidentialityLevel: 0,
    ...overrides,
  }
}

describe("can() — ด่านที่ 1 AUTHENTICATED", () => {
  it("ปฏิเสธเมื่อบัญชีถูกระงับ แม้จะมีสิทธิ์ครบ", () => {
    const ctx = makeCtx({
      isActive: false,
      permissions: grants([PERMISSIONS.DOCUMENT_READ, "ORG"]),
    })

    expect(can(ctx, PERMISSIONS.DOCUMENT_READ, makeDoc())).toEqual({
      allowed: false,
      reason: "NOT_AUTHENTICATED",
    })
  })

  it("ปฏิเสธเมื่อไม่มี userId", () => {
    const ctx = makeCtx({ userId: "", permissions: grants([PERMISSIONS.USER_MANAGE, "ORG"]) })

    expect(can(ctx, PERMISSIONS.USER_MANAGE)).toEqual({
      allowed: false,
      reason: "NOT_AUTHENTICATED",
    })
  })
})

describe("can() — ด่านที่ 2 ROLE GRANT", () => {
  it("ปฏิเสธเมื่อบทบาทไม่มีสิทธิ์นั้นเลย", () => {
    const ctx = makeCtx({ permissions: grants([PERMISSIONS.DOCUMENT_READ, "ORG"]) })

    expect(can(ctx, PERMISSIONS.DOCUMENT_NUMBER_ISSUE, makeDoc())).toEqual({
      allowed: false,
      reason: "NO_PERMISSION",
    })
  })

  it("สิทธิ์ที่ไม่ผูกกับทรัพยากรผ่านได้ทันทีเมื่อมี grant", () => {
    const ctx = makeCtx({ permissions: grants([PERMISSIONS.USER_MANAGE, "ORG"]) })

    expect(can(ctx, PERMISSIONS.USER_MANAGE)).toEqual({ allowed: true, scope: "ORG" })
  })

  it("SYSTEM_ADMIN ไม่ได้ document.read โดยอัตโนมัติ (spec §4.2 หมายเหตุความปลอดภัย)", () => {
    // จำลองสิทธิ์ของ SYSTEM_ADMIN ตามตาราง §4.2 — ไม่มี document.read อยู่ในชุด
    const ctx = makeCtx({
      roleCodes: ["SYSTEM_ADMIN"],
      permissions: grants(
        [PERMISSIONS.USER_MANAGE, "ORG"],
        [PERMISSIONS.ORGUNIT_MANAGE, "ORG"],
        [PERMISSIONS.AUDIT_READ, "ORG"],
      ),
    })

    expect(canOrFalse(ctx, PERMISSIONS.DOCUMENT_READ, makeDoc())).toBe(false)
  })
})

describe("can() — ด่านที่ 3 SCOPE MATCH", () => {
  describe("scope OWN", () => {
    const ctx = makeCtx({ permissions: grants([PERMISSIONS.DOCUMENT_UPDATE, "OWN"]) })

    it("ผ่านเมื่อเป็นผู้สร้างเอง", () => {
      const result = can(ctx, PERMISSIONS.DOCUMENT_UPDATE, makeDoc({ createdById: "user-1" }))
      expect(result).toEqual({ allowed: true, scope: "OWN" })
    })

    it("ไม่ผ่านเมื่อคนอื่นเป็นผู้สร้าง แม้จะอยู่หน่วยงานเดียวกัน", () => {
      const result = can(ctx, PERMISSIONS.DOCUMENT_UPDATE, makeDoc({ createdById: "user-9" }))
      expect(result).toEqual({ allowed: false, reason: "OUT_OF_SCOPE" })
    })

    it("ไม่ผ่านเมื่อเอกสารไม่มีผู้สร้าง", () => {
      const result = can(ctx, PERMISSIONS.DOCUMENT_UPDATE, makeDoc({ createdById: null }))
      expect(result).toEqual({ allowed: false, reason: "OUT_OF_SCOPE" })
    })
  })

  describe("scope UNIT", () => {
    const ctx = makeCtx({ permissions: grants([PERMISSIONS.DOCUMENT_READ, "UNIT"]) })

    it("ผ่านเมื่อเอกสารเป็นของหน่วยงานปัจจุบัน", () => {
      expect(can(ctx, PERMISSIONS.DOCUMENT_READ, makeDoc()).allowed).toBe(true)
    })

    it("ผ่านเมื่อหน่วยงานปัจจุบันเป็นผู้รับ (spec §4.3 ข้อ 3)", () => {
      const doc = makeDoc({
        ownerUnitId: OTHER_FACULTY.id,
        ownerUnitPath: OTHER_FACULTY.path,
        recipientUnitIds: [FACULTY.id],
      })
      expect(can(ctx, PERMISSIONS.DOCUMENT_READ, doc).allowed).toBe(true)
    })

    it("ไม่ผ่านเมื่อเป็นเอกสารของหน่วยงานลูก (UNIT ไม่ลามลงไป)", () => {
      const doc = makeDoc({ ownerUnitId: DEPARTMENT.id, ownerUnitPath: DEPARTMENT.path })
      expect(can(ctx, PERMISSIONS.DOCUMENT_READ, doc)).toEqual({
        allowed: false,
        reason: "OUT_OF_SCOPE",
      })
    })

    it("ไม่ผ่านเมื่อยังไม่ได้เลือกหน่วยงานทำงาน", () => {
      const noCtx = makeCtx({
        activeOrgUnitId: null,
        activeOrgUnitPath: null,
        permissions: grants([PERMISSIONS.DOCUMENT_READ, "UNIT"]),
      })
      expect(can(noCtx, PERMISSIONS.DOCUMENT_READ, makeDoc()).allowed).toBe(false)
    })
  })

  describe("scope SUBTREE", () => {
    const ctx = makeCtx({ permissions: grants([PERMISSIONS.DOCUMENT_READ, "SUBTREE"]) })

    it("ผ่านเมื่อเป็นเอกสารของหน่วยงานตนเอง", () => {
      expect(can(ctx, PERMISSIONS.DOCUMENT_READ, makeDoc()).allowed).toBe(true)
    })

    it("ผ่านเมื่อเป็นเอกสารของหน่วยงานลูก", () => {
      const doc = makeDoc({ ownerUnitId: DEPARTMENT.id, ownerUnitPath: DEPARTMENT.path })
      expect(can(ctx, PERMISSIONS.DOCUMENT_READ, doc).allowed).toBe(true)
    })

    it("ไม่ผ่านเมื่อเป็นเอกสารของหน่วยงานพี่น้อง", () => {
      const doc = makeDoc({ ownerUnitId: OTHER_FACULTY.id, ownerUnitPath: OTHER_FACULTY.path })
      expect(can(ctx, PERMISSIONS.DOCUMENT_READ, doc)).toEqual({
        allowed: false,
        reason: "OUT_OF_SCOPE",
      })
    })

    it("ไม่ผ่านเมื่อเป็นเอกสารของหน่วยงานแม่ (SUBTREE ไม่ไต่ขึ้น)", () => {
      const doc = makeDoc({ ownerUnitId: UNIVERSITY.id, ownerUnitPath: UNIVERSITY.path })
      expect(can(ctx, PERMISSIONS.DOCUMENT_READ, doc).allowed).toBe(false)
    })

    it("ไม่ผ่านเมื่อเอกสารไม่มี path ของหน่วยงานเจ้าของ", () => {
      const doc = makeDoc({ ownerUnitPath: null })
      expect(can(ctx, PERMISSIONS.DOCUMENT_READ, doc).allowed).toBe(false)
    })

    it("ไม่ถูกหลอกด้วยชื่อ path ที่ขึ้นต้นเหมือนกัน", () => {
      // path ปิดท้ายด้วย "/" เสมอ จึงไม่มีทางที่ /u-root/u-eng2/ จะ match /u-root/u-eng/
      const doc = makeDoc({ ownerUnitId: "u-eng2", ownerUnitPath: "/u-root/u-eng2/" })
      expect(can(ctx, PERMISSIONS.DOCUMENT_READ, doc).allowed).toBe(false)
    })
  })

  describe("scope ORG", () => {
    const ctx = makeCtx({ permissions: grants([PERMISSIONS.DOCUMENT_READ, "ORG"]) })

    it("ผ่านทุกหน่วยงานภายใน tenant เดียวกัน", () => {
      const doc = makeDoc({ ownerUnitId: OTHER_FACULTY.id, ownerUnitPath: OTHER_FACULTY.path })
      expect(can(ctx, PERMISSIONS.DOCUMENT_READ, doc)).toEqual({ allowed: true, scope: "ORG" })
    })
  })
})

describe("can() — ด่านที่ 4 EXPLICIT ACL", () => {
  const userAllow: AuthzAclEntry = {
    principalType: "USER",
    principalId: "user-1",
    permission: "VIEW",
    effect: "ALLOW",
  }

  it("ACL ALLOW กู้กรณีที่ scope ไม่ผ่าน", () => {
    const ctx = makeCtx({ permissions: grants([PERMISSIONS.DOCUMENT_READ, "UNIT"]) })
    const doc = makeDoc({
      ownerUnitId: OTHER_FACULTY.id,
      ownerUnitPath: OTHER_FACULTY.path,
      acl: [userAllow],
    })

    expect(can(ctx, PERMISSIONS.DOCUMENT_READ, doc).allowed).toBe(true)
  })

  it("ACL DENY ชนะเสมอ แม้ scope เป็น ORG", () => {
    const ctx = makeCtx({ permissions: grants([PERMISSIONS.DOCUMENT_READ, "ORG"]) })
    const doc = makeDoc({
      acl: [
        userAllow,
        { principalType: "USER", principalId: "user-1", permission: "VIEW", effect: "DENY" },
      ],
    })

    expect(can(ctx, PERMISSIONS.DOCUMENT_READ, doc)).toEqual({
      allowed: false,
      reason: "ACL_DENY",
    })
  })

  it("ACL ที่หมดอายุแล้วไม่มีผล", () => {
    const ctx = makeCtx({ permissions: grants([PERMISSIONS.DOCUMENT_READ, "UNIT"]) })
    const doc = makeDoc({
      ownerUnitId: OTHER_FACULTY.id,
      ownerUnitPath: OTHER_FACULTY.path,
      acl: [{ ...userAllow, expiresAt: new Date("2569-01-01T00:00:00Z") }],
    })

    const result = can(ctx, PERMISSIONS.DOCUMENT_READ, doc, {
      now: new Date("2570-01-01T00:00:00Z"),
    })
    expect(result).toEqual({ allowed: false, reason: "OUT_OF_SCOPE" })
  })

  it("ACL ระดับหน่วยงานใช้ได้กับทุกสังกัดของผู้ใช้", () => {
    const ctx = makeCtx({
      orgUnitIds: [FACULTY.id, DEPARTMENT.id],
      permissions: grants([PERMISSIONS.DOCUMENT_READ, "UNIT"]),
    })
    const doc = makeDoc({
      ownerUnitId: OTHER_FACULTY.id,
      ownerUnitPath: OTHER_FACULTY.path,
      acl: [
        {
          principalType: "ORG_UNIT",
          principalId: DEPARTMENT.id,
          permission: "VIEW",
          effect: "ALLOW",
        },
      ],
    })

    expect(can(ctx, PERMISSIONS.DOCUMENT_READ, doc).allowed).toBe(true)
  })

  it("ACL ระดับบทบาทใช้ได้กับบทบาทที่ถืออยู่", () => {
    const ctx = makeCtx({
      roleCodes: ["EXECUTIVE"],
      permissions: grants([PERMISSIONS.DOCUMENT_READ, "UNIT"]),
    })
    const doc = makeDoc({
      ownerUnitId: OTHER_FACULTY.id,
      ownerUnitPath: OTHER_FACULTY.path,
      acl: [
        { principalType: "ROLE", principalId: "EXECUTIVE", permission: "VIEW", effect: "ALLOW" },
      ],
    })

    expect(can(ctx, PERMISSIONS.DOCUMENT_READ, doc).allowed).toBe(true)
  })
})

describe("can() — ACL หยาบสี่ระดับต้องจำกัดว่าให้ทำอะไรได้บ้าง (§9.1)", () => {
  function aclDoc(permission: AuthzAclEntry["permission"]): AuthzResource {
    return makeDoc({
      ownerUnitId: OTHER_FACULTY.id,
      ownerUnitPath: OTHER_FACULTY.path,
      acl: [{ principalType: "USER", principalId: "user-1", permission, effect: "ALLOW" }],
    })
  }

  const ctx = makeCtx({
    permissions: grants(
      [PERMISSIONS.DOCUMENT_READ, "UNIT"],
      [PERMISSIONS.DOCUMENT_UPDATE, "UNIT"],
      [PERMISSIONS.ATTACHMENT_DOWNLOAD, "UNIT"],
      [PERMISSIONS.ATTACHMENT_GRANT, "UNIT"],
    ),
  })

  it("⚠️ ACL ระดับ VIEW ให้แค่เปิดอ่าน ห้ามกลายเป็นสิทธิ์แก้ไขหรือดาวน์โหลด", () => {
    const doc = aclDoc("VIEW")

    expect(can(ctx, PERMISSIONS.DOCUMENT_READ, doc).allowed).toBe(true)
    expect(can(ctx, PERMISSIONS.DOCUMENT_UPDATE, doc).allowed).toBe(false)
    expect(can(ctx, PERMISSIONS.ATTACHMENT_DOWNLOAD, doc).allowed).toBe(false)
  })

  it("ACL ระดับ DOWNLOAD เปิดไฟล์ได้ แต่ยังแก้เอกสารไม่ได้", () => {
    const doc = aclDoc("DOWNLOAD")

    expect(can(ctx, PERMISSIONS.ATTACHMENT_DOWNLOAD, doc).allowed).toBe(true)
    expect(can(ctx, PERMISSIONS.DOCUMENT_UPDATE, doc).allowed).toBe(false)
  })

  it("ACL ระดับ EDIT แก้ได้ แต่ให้สิทธิ์คนอื่นต่อไม่ได้", () => {
    const doc = aclDoc("EDIT")

    expect(can(ctx, PERMISSIONS.DOCUMENT_UPDATE, doc).allowed).toBe(true)
    expect(can(ctx, PERMISSIONS.ATTACHMENT_GRANT, doc).allowed).toBe(false)
  })

  it("ACL ระดับ MANAGE ทำได้ทุกอย่างกับเอกสารฉบับนั้น", () => {
    const doc = aclDoc("MANAGE")

    expect(can(ctx, PERMISSIONS.DOCUMENT_READ, doc).allowed).toBe(true)
    expect(can(ctx, PERMISSIONS.DOCUMENT_UPDATE, doc).allowed).toBe(true)
    expect(can(ctx, PERMISSIONS.ATTACHMENT_GRANT, doc).allowed).toBe(true)
  })

  it("DENY ไม่ดูชนิดสิทธิ์ — ห้ามแล้วห้ามทั้งฉบับ", () => {
    const doc = makeDoc({
      acl: [
        { principalType: "USER", principalId: "user-1", permission: "MANAGE", effect: "ALLOW" },
        { principalType: "USER", principalId: "user-1", permission: "VIEW", effect: "DENY" },
      ],
    })

    expect(can(ctx, PERMISSIONS.DOCUMENT_UPDATE, doc)).toEqual({
      allowed: false,
      reason: "ACL_DENY",
    })
  })

  it("เอกสารลับ: ACL รายบุคคลระดับ VIEW เปิดอ่านได้ แต่แก้ไม่ได้", () => {
    const confidential = makeCtx({
      clearanceLevel: 2,
      permissions: grants([PERMISSIONS.DOCUMENT_READ, "ORG"], [PERMISSIONS.DOCUMENT_UPDATE, "ORG"]),
    })
    const doc = makeDoc({
      confidentialityLevel: 2,
      acl: [{ principalType: "USER", principalId: "user-1", permission: "VIEW", effect: "ALLOW" }],
    })

    expect(can(confidential, PERMISSIONS.DOCUMENT_READ, doc).allowed).toBe(true)
    expect(can(confidential, PERMISSIONS.DOCUMENT_UPDATE, doc)).toEqual({
      allowed: false,
      reason: "NO_EXPLICIT_ACL",
    })
  })
})

describe("can() — ด่านที่ 5 CLEARANCE", () => {
  const personalAcl: AuthzAclEntry = {
    principalType: "USER",
    principalId: "user-1",
    permission: "VIEW",
    effect: "ALLOW",
  }

  it("ปฏิเสธเมื่อ clearance ต่ำกว่าชั้นความลับของเอกสาร", () => {
    const ctx = makeCtx({
      clearanceLevel: 1,
      permissions: grants([PERMISSIONS.DOCUMENT_READ, "ORG"]),
    })
    const doc = makeDoc({ confidentialityLevel: 2, acl: [personalAcl] })

    expect(can(ctx, PERMISSIONS.DOCUMENT_READ, doc)).toEqual({
      allowed: false,
      reason: "CLEARANCE_TOO_LOW",
    })
  })

  it("เอกสารลับต้องมี ACL ระบุตัวบุคคล — scope อย่างเดียวไม่พอ", () => {
    const ctx = makeCtx({
      clearanceLevel: 3,
      permissions: grants([PERMISSIONS.DOCUMENT_READ, "ORG"]),
    })
    const doc = makeDoc({ confidentialityLevel: 1 })

    expect(can(ctx, PERMISSIONS.DOCUMENT_READ, doc)).toEqual({
      allowed: false,
      reason: "NO_EXPLICIT_ACL",
    })
  })

  it("ACL ระดับหน่วยงานไม่พอสำหรับเอกสารลับ — ต้องเป็นรายบุคคลเท่านั้น", () => {
    const ctx = makeCtx({
      clearanceLevel: 3,
      orgUnitIds: [FACULTY.id],
      permissions: grants([PERMISSIONS.DOCUMENT_READ, "ORG"]),
    })
    const doc = makeDoc({
      confidentialityLevel: 1,
      acl: [
        { principalType: "ORG_UNIT", principalId: FACULTY.id, permission: "VIEW", effect: "ALLOW" },
      ],
    })

    expect(can(ctx, PERMISSIONS.DOCUMENT_READ, doc)).toEqual({
      allowed: false,
      reason: "NO_EXPLICIT_ACL",
    })
  })

  it("ผ่านเมื่อ clearance พอและมี ACL รายบุคคล", () => {
    const ctx = makeCtx({
      clearanceLevel: 3,
      permissions: grants([PERMISSIONS.DOCUMENT_READ, "ORG"]),
    })
    const doc = makeDoc({ confidentialityLevel: 3, acl: [personalAcl] })

    expect(can(ctx, PERMISSIONS.DOCUMENT_READ, doc)).toEqual({ allowed: true, scope: "ORG" })
  })

  it("เอกสารปกติ (ระดับ 0) ไม่ต้องมี ACL", () => {
    const ctx = makeCtx({
      clearanceLevel: 0,
      permissions: grants([PERMISSIONS.DOCUMENT_READ, "ORG"]),
    })

    expect(can(ctx, PERMISSIONS.DOCUMENT_READ, makeDoc()).allowed).toBe(true)
  })
})

describe("can() — ด่านที่ 6 STATE", () => {
  const ctx = makeCtx({ permissions: grants([PERMISSIONS.DOCUMENT_UPDATE, "ORG"]) })

  it("อนุญาตแก้ไขเฉพาะสถานะ DRAFT / RETURNED (spec §6.4)", () => {
    const draft = makeDoc({ status: "DRAFT" })
    const registered = makeDoc({ status: "REGISTERED" })
    const options = { allowedStatuses: ["DRAFT", "RETURNED"] as const }

    expect(can(ctx, PERMISSIONS.DOCUMENT_UPDATE, draft, options).allowed).toBe(true)
    expect(can(ctx, PERMISSIONS.DOCUMENT_UPDATE, registered, options)).toEqual({
      allowed: false,
      reason: "INVALID_STATE",
    })
  })

  it("ไม่ตรวจสถานะเมื่อไม่ได้ระบุ allowedStatuses", () => {
    expect(can(ctx, PERMISSIONS.DOCUMENT_UPDATE, makeDoc({ status: "REGISTERED" })).allowed).toBe(
      true,
    )
  })
})

describe("can() — ลำดับของด่านต้องถูกต้อง", () => {
  it("DENY ชนะก่อนที่ scope จะได้ตัดสิน", () => {
    const ctx = makeCtx({ permissions: grants([PERMISSIONS.DOCUMENT_READ, "OWN"]) })
    const doc = makeDoc({
      createdById: "user-1",
      acl: [{ principalType: "USER", principalId: "user-1", permission: "VIEW", effect: "DENY" }],
    })

    const result = can(ctx, PERMISSIONS.DOCUMENT_READ, doc)
    expect(result.allowed).toBe(false)
    expect(result).toMatchObject({ reason: "ACL_DENY" })
  })

  it("ไม่มีสิทธิ์เลย ถูกปฏิเสธก่อนตรวจ clearance", () => {
    const ctx = makeCtx({ clearanceLevel: 0, permissions: {} })
    const doc = makeDoc({ confidentialityLevel: 3 })

    const result = can(ctx, PERMISSIONS.DOCUMENT_READ, doc)
    expect(result.allowed).toBe(false)
    expect(result).toMatchObject({ reason: "NO_PERMISSION" })
  })
})

describe("can() — ACL ชนิด REGISTER ของนายทะเบียนหนังสือลับ", () => {
  const registrarAcl = {
    principalType: "USER" as const,
    principalId: "user-1",
    permission: "REGISTER" as const,
    effect: "ALLOW" as const,
  }

  const ctx = makeCtx({
    clearanceLevel: 3,
    permissions: grants(
      [PERMISSIONS.DOCUMENT_READ, "ORG"],
      [PERMISSIONS.DOCUMENT_NUMBER_ISSUE, "ORG"],
      [PERMISSIONS.ATTACHMENT_DOWNLOAD, "ORG"],
      [PERMISSIONS.DOCUMENT_UPDATE, "ORG"],
      [PERMISSIONS.ATTACHMENT_GRANT, "ORG"],
    ),
  })

  const doc = makeDoc({ confidentialityLevel: 2, acl: [registrarAcl] })

  it("ออกเลขทะเบียนให้เอกสารลับได้ — เหตุผลเดียวที่ตำแหน่งนี้มีอยู่", () => {
    expect(can(ctx, PERMISSIONS.DOCUMENT_NUMBER_ISSUE, doc).allowed).toBe(true)
  })

  it("เห็นแถวในทะเบียนได้ ไม่งั้นก็ไม่มีทางกดออกเลข", () => {
    expect(can(ctx, PERMISSIONS.DOCUMENT_READ, doc).allowed).toBe(true)
  })

  it("⚠️ เปิดไฟล์แนบไม่ได้ — นายทะเบียนลงทะเบียนซองที่ปิดผนึก ไม่ได้อ่านเนื้อใน", () => {
    expect(can(ctx, PERMISSIONS.ATTACHMENT_DOWNLOAD, doc).allowed).toBe(false)
  })

  it("แก้เอกสารไม่ได้ และให้สิทธิ์คนอื่นต่อไม่ได้", () => {
    expect(can(ctx, PERMISSIONS.DOCUMENT_UPDATE, doc).allowed).toBe(false)
    expect(can(ctx, PERMISSIONS.ATTACHMENT_GRANT, doc).allowed).toBe(false)
  })
})
