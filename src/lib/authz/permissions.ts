// สิทธิ์และขอบเขต — ถอดมาจาก spec §4.1 และ §4.2 ตรง ๆ
//
// ไฟล์นี้เก็บแค่ "รายการรหัส" ให้ TypeScript ตรวจได้ว่าสะกดถูก
// ส่วน **ตารางว่า role ไหนได้สิทธิ์อะไรที่ scope ไหน อยู่ในฐานข้อมูล**
// (ตาราง Role/Permission) และถูก seed ใน P1 — ไม่ hardcode ไว้ที่นี่
// เพราะ spec §4 ให้ผู้ดูแลระบบแก้บทบาทได้เองผ่าน /admin/roles

/**
 * ขอบเขตข้อมูลที่สิทธิ์หนึ่งครอบคลุม (spec §4.2)
 *
 * `OWN` ของตนเอง · `UNIT` หน่วยงานปัจจุบัน ·
 * `SUBTREE` หน่วยงานตนและลูกหลาน · `ORG` ทั้งองค์กร
 */
export const PERMISSION_SCOPES = ["OWN", "UNIT", "SUBTREE", "ORG"] as const

export type PermissionScope = (typeof PERMISSION_SCOPES)[number]

/** บทบาท (spec §4.1) — ผูกกับคู่ (User, OrgUnit) ไม่ใช่กับ User เดี่ยว */
export const ROLE_CODES = [
  "SYSTEM_ADMIN",
  "CENTRAL_REGISTRAR",
  "DEPT_OFFICER",
  "EXECUTIVE",
  "USER",
] as const

export type RoleCode = (typeof ROLE_CODES)[number]

/** รหัสสิทธิ์รูปแบบ `<resource>.<action>` (spec §4.2) */
export const PERMISSIONS = {
  DOCUMENT_CREATE: "document.create",
  DOCUMENT_READ: "document.read",
  DOCUMENT_UPDATE: "document.update",
  DOCUMENT_DELETE: "document.delete",
  DOCUMENT_SUBMIT: "document.submit",
  DOCUMENT_NUMBER_ISSUE: "document.number.issue",
  DOCUMENT_RETURN: "document.return",
  DOCUMENT_SEND_EXTERNAL: "document.send.external",
  DOCUMENT_CIRCULATE: "document.circulate",
  DOCUMENT_ACKNOWLEDGE: "document.acknowledge",
  DOCUMENT_CLOSE: "document.close",

  ATTACHMENT_UPLOAD: "attachment.upload",
  ATTACHMENT_DOWNLOAD: "attachment.download",
  ATTACHMENT_GRANT: "attachment.grant",

  CONFIDENTIAL_ACCESS: "confidential.access",

  REPORT_VIEW: "report.view",
  REPORT_EXPORT: "report.export",

  ORGUNIT_MANAGE: "orgunit.manage",
  USER_MANAGE: "user.manage",
  ROLE_MANAGE: "role.manage",
  AUDIT_READ: "audit.read",
  SETTING_MANAGE: "setting.manage",
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/** สิทธิ์ที่ผู้ใช้ถืออยู่ในหน่วยงานปัจจุบัน พร้อมขอบเขตของแต่ละอัน */
export type GrantedPermissions = Readonly<Partial<Record<Permission, PermissionScope>>>
