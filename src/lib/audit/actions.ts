// รหัสการกระทำที่บันทึกลง audit log (spec §8.5)
//
// รูปแบบ `<domain>.<action>` — เก็บเป็นค่าคงที่เพื่อให้ค้นหาย้อนหลังได้แน่นอน
// และ typecheck จับได้เมื่อพิมพ์ผิด (ถ้าปล่อยเป็น string ดิบ จะมี "auth.login"
// กับ "auth.Login" ปนกันในทะเบียนโดยไม่มีใครรู้)

export const AUDIT_ACTIONS = {
  // ── การเข้าสู่ระบบ ───────────────────────────────────────────────
  LOGIN_SUCCESS: "auth.login.success",
  LOGIN_FAILED: "auth.login.failed",
  LOGIN_LOCKED: "auth.login.locked",
  LOGOUT: "auth.logout",
  PASSWORD_CHANGED: "auth.password.changed",
  PASSWORD_RESET_REQUESTED: "auth.password.reset.requested",
  PASSWORD_RESET_BY_ADMIN: "auth.password.reset.admin",
  CONTEXT_SWITCHED: "auth.context.switched",
  SESSION_REVOKED: "auth.session.revoked",

  // ── หน่วยงาน ─────────────────────────────────────────────────────
  ORGUNIT_CREATED: "orgunit.created",
  ORGUNIT_UPDATED: "orgunit.updated",
  ORGUNIT_MOVED: "orgunit.moved",
  ORGUNIT_ARCHIVED: "orgunit.archived",
  ORGUNIT_RESTORED: "orgunit.restored",

  // ── ผู้ใช้ ───────────────────────────────────────────────────────
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
  USER_SUSPENDED: "user.suspended",
  USER_ACTIVATED: "user.activated",
  USER_AFFILIATION_ADDED: "user.affiliation.added",
  USER_AFFILIATION_REMOVED: "user.affiliation.removed",
  USER_ROLE_GRANTED: "user.role.granted",
  USER_ROLE_REVOKED: "user.role.revoked",
  USER_CLEARANCE_CHANGED: "user.clearance.changed",

  // ── คำขอสมัครใช้งาน ──────────────────────────────────────────────
  REGISTRATION_SUBMITTED: "registration.submitted",
  REGISTRATION_APPROVED: "registration.approved",
  REGISTRATION_REJECTED: "registration.rejected",

  // ── เอกสาร ───────────────────────────────────────────────────────
  DOCUMENT_NUMBER_ISSUED: "document.number.issued",

  // ── บทบาทและสิทธิ์ ───────────────────────────────────────────────
  ROLE_CREATED: "role.created",
  ROLE_UPDATED: "role.updated",
  ROLE_PERMISSIONS_UPDATED: "role.permissions.updated",

  // ── ค่าระบบ ──────────────────────────────────────────────────────
  SETTING_UPDATED: "setting.updated",

  // ── การตรวจสอบ ───────────────────────────────────────────────────
  AUDIT_EXPORTED: "audit.exported",
  AUDIT_CHAIN_VERIFIED: "audit.chain.verified",

  // ── การเข้าถึงที่ถูกปฏิเสธ (สำคัญที่สุดตาม spec §8.5) ─────────────
  ACCESS_DENIED: "access.denied",
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]

/** ข้อความไทยของแต่ละการกระทำ — ใช้แสดงในหน้า /admin/audit */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "auth.login.success": "เข้าสู่ระบบสำเร็จ",
  "auth.login.failed": "เข้าสู่ระบบไม่สำเร็จ",
  "auth.login.locked": "บัญชีถูกล็อกชั่วคราว",
  "auth.logout": "ออกจากระบบ",
  "auth.password.changed": "เปลี่ยนรหัสผ่าน",
  "auth.password.reset.requested": "ขอรีเซ็ตรหัสผ่าน",
  "auth.password.reset.admin": "ผู้ดูแลรีเซ็ตรหัสผ่านให้",
  "auth.context.switched": "สลับหน่วยงานที่ทำงาน",
  "auth.session.revoked": "ยกเลิกเซสชัน",

  "orgunit.created": "เพิ่มหน่วยงาน",
  "orgunit.updated": "แก้ไขหน่วยงาน",
  "orgunit.moved": "ย้ายหน่วยงาน",
  "orgunit.archived": "เก็บถาวรหน่วยงาน",
  "orgunit.restored": "นำหน่วยงานกลับมาใช้",

  "user.created": "เพิ่มผู้ใช้งาน",
  "user.updated": "แก้ไขผู้ใช้งาน",
  "user.suspended": "ระงับบัญชีผู้ใช้",
  "user.activated": "เปิดใช้งานบัญชีผู้ใช้",
  "user.affiliation.added": "เพิ่มสังกัดให้ผู้ใช้",
  "user.affiliation.removed": "ถอดสังกัดของผู้ใช้",
  "user.role.granted": "ให้บทบาทแก่ผู้ใช้",
  "user.role.revoked": "ถอนบทบาทของผู้ใช้",
  "user.clearance.changed": "เปลี่ยนชั้นความลับของผู้ใช้",

  "registration.submitted": "ส่งคำขอสมัครใช้งาน",
  "registration.approved": "อนุมัติคำขอสมัครใช้งาน",
  "registration.rejected": "ปฏิเสธคำขอสมัครใช้งาน",

  "document.number.issued": "ออกเลขทะเบียนหนังสือ",
  "role.created": "สร้างบทบาท",
  "role.updated": "แก้ไขบทบาท",
  "role.permissions.updated": "แก้ไขสิทธิ์ของบทบาท",

  "setting.updated": "แก้ไขค่าระบบ",

  "audit.exported": "ส่งออก audit log",
  "audit.chain.verified": "ตรวจสอบ hash chain",

  "access.denied": "การเข้าถึงถูกปฏิเสธ",
}

/** ประเภทของ entity ที่ audit อ้างถึง */
export const AUDIT_ENTITY_TYPES = {
  USER: "User",
  ORG_UNIT: "OrgUnit",
  ROLE: "Role",
  SESSION: "Session",
  SETTING: "SystemSetting",
  REGISTRATION: "RegistrationRequest",
  PASSWORD_RESET: "PasswordResetRequest",
  AUDIT: "AuditLog",
  DOCUMENT: "Document",
} as const

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[keyof typeof AUDIT_ENTITY_TYPES]

export const AUDIT_ENTITY_LABELS: Record<AuditEntityType, string> = {
  User: "ผู้ใช้งาน",
  OrgUnit: "หน่วยงาน",
  Role: "บทบาท",
  Session: "เซสชัน",
  SystemSetting: "ค่าระบบ",
  RegistrationRequest: "คำขอสมัครใช้งาน",
  PasswordResetRequest: "คำขอรีเซ็ตรหัสผ่าน",
  AuditLog: "Audit Log",
  Document: "หนังสือ",
}
