// ข้อมูลประกอบของสิทธิ์ + ตารางบทบาทตั้งต้น — ถอดจาก spec §4.2 ตรง ๆ
//
// ⚠️ ไฟล์นี้เป็น **ค่าตั้งต้นสำหรับ seed เท่านั้น** ไม่ใช่แหล่งความจริงตอนรันจริง
// ของจริงอยู่ในตาราง Role/RolePermission เพราะ spec §4 ให้ผู้ดูแลระบบแก้บทบาท
// ได้เองผ่าน /admin/roles — โค้ดตรวจสิทธิ์ต้องอ่านจากฐานข้อมูลเสมอ

import { PERMISSIONS, type Permission, type PermissionScope, type RoleCode } from "./permissions"

/** กลุ่มของสิทธิ์ที่ใช้จัดหมวดในหน้า /admin/roles */
export const PERMISSION_GROUPS = {
  DOCUMENT: "เอกสาร",
  ATTACHMENT: "ไฟล์แนบ",
  CONFIDENTIAL: "ชั้นความลับ",
  REPORT: "รายงาน",
  ADMIN: "ผู้ดูแลระบบ",
} as const

export type PermissionGroup = (typeof PERMISSION_GROUPS)[keyof typeof PERMISSION_GROUPS]

export interface PermissionMeta {
  code: Permission
  group: PermissionGroup
  nameTh: string
  description: string
}

/** ป้ายชื่อไทยของสิทธิ์ทั้ง 22 รหัส — เรียงตามลำดับที่แสดงในหน้า /admin/roles */
export const PERMISSION_META: readonly PermissionMeta[] = [
  {
    code: PERMISSIONS.DOCUMENT_CREATE,
    group: PERMISSION_GROUPS.DOCUMENT,
    nameTh: "สร้างหนังสือ",
    description: "ร่างหนังสือใหม่ในนามหน่วยงานที่กำลังทำงานอยู่",
  },
  {
    code: PERMISSIONS.DOCUMENT_READ,
    group: PERMISSION_GROUPS.DOCUMENT,
    nameTh: "อ่านหนังสือ",
    description: "เปิดดูรายละเอียดหนังสือตามขอบเขตที่กำหนด",
  },
  {
    code: PERMISSIONS.DOCUMENT_UPDATE,
    group: PERMISSION_GROUPS.DOCUMENT,
    nameTh: "แก้ไขหนังสือ",
    description: "แก้ metadata และไฟล์แนบ — ได้เฉพาะสถานะ ร่าง / ตีกลับ",
  },
  {
    code: PERMISSIONS.DOCUMENT_DELETE,
    group: PERMISSION_GROUPS.DOCUMENT,
    nameTh: "ลบหนังสือ",
    description: "ลบแบบ soft delete — หนังสือที่ออกเลขแล้วลบไม่ได้เด็ดขาด",
  },
  {
    code: PERMISSIONS.DOCUMENT_SUBMIT,
    group: PERMISSION_GROUPS.DOCUMENT,
    nameTh: "ส่งออกเลข",
    description: "ส่งร่างเข้าคิวรอออกเลขทะเบียน",
  },
  {
    code: PERMISSIONS.DOCUMENT_NUMBER_ISSUE,
    group: PERMISSION_GROUPS.DOCUMENT,
    nameTh: "ออกเลขทะเบียน",
    description: "ออกเลขหนังสือให้รายการในคิว — จุดที่เลขทะเบียนถูกจองถาวร",
  },
  {
    code: PERMISSIONS.DOCUMENT_RETURN,
    group: PERMISSION_GROUPS.DOCUMENT,
    nameTh: "ตีกลับให้แก้ไข",
    description: "ส่งหนังสือกลับให้ผู้ร่างแก้ (มาตรการทดแทนขั้นอนุมัติ ตาม A2)",
  },
  {
    code: PERMISSIONS.DOCUMENT_SEND_EXTERNAL,
    group: PERMISSION_GROUPS.DOCUMENT,
    nameTh: "ส่งออกภายนอก",
    description: "บันทึกว่าหนังสือถูกส่งออกนอกองค์กรแล้ว",
  },
  {
    code: PERMISSIONS.DOCUMENT_CIRCULATE,
    group: PERMISSION_GROUPS.DOCUMENT,
    nameTh: "เวียนหนังสือ",
    description: "ส่งหนังสือให้หน่วยงาน/บุคคลที่เป็นผู้รับ",
  },
  {
    code: PERMISSIONS.DOCUMENT_ACKNOWLEDGE,
    group: PERMISSION_GROUPS.DOCUMENT,
    nameTh: "รับทราบ",
    description: "กดรับทราบหนังสือที่ถูกเวียนถึงตน",
  },
  {
    code: PERMISSIONS.DOCUMENT_CLOSE,
    group: PERMISSION_GROUPS.DOCUMENT,
    nameTh: "ปิดเรื่อง",
    description: "ปิดเรื่องหนังสือที่ดำเนินการเสร็จแล้ว",
  },
  {
    code: PERMISSIONS.ATTACHMENT_UPLOAD,
    group: PERMISSION_GROUPS.ATTACHMENT,
    nameTh: "อัปโหลดไฟล์แนบ",
    description: "แนบไฟล์เข้ากับหนังสือ (ตรวจ MIME + magic number)",
  },
  {
    code: PERMISSIONS.ATTACHMENT_DOWNLOAD,
    group: PERMISSION_GROUPS.ATTACHMENT,
    nameTh: "ดาวน์โหลดไฟล์แนบ",
    description: "ดาวน์โหลดไฟล์ผ่าน route ที่ตรวจสิทธิ์ — ไม่มี URL ตรงถึงไฟล์",
  },
  {
    code: PERMISSIONS.ATTACHMENT_GRANT,
    group: PERMISSION_GROUPS.ATTACHMENT,
    nameTh: "ให้สิทธิ์ไฟล์แนบ",
    description: "มอบสิทธิ์เข้าถึงไฟล์แนบให้บุคคล/หน่วยงานเป็นราย ๆ",
  },
  {
    code: PERMISSIONS.CONFIDENTIAL_ACCESS,
    group: PERMISSION_GROUPS.CONFIDENTIAL,
    nameTh: "เข้าถึงเอกสารลับ",
    description: "เข้าถึงได้ไม่เกินชั้นความลับ (clearance) ของผู้ใช้ และต้องมี ACL ระบุตัวบุคคล",
  },
  {
    code: PERMISSIONS.REPORT_VIEW,
    group: PERMISSION_GROUPS.REPORT,
    nameTh: "ดูรายงาน",
    description: "เปิดดูทะเบียนหนังสือและ dashboard สถิติ",
  },
  {
    code: PERMISSIONS.REPORT_EXPORT,
    group: PERMISSION_GROUPS.REPORT,
    nameTh: "ส่งออกรายงาน",
    description: "ดาวน์โหลดทะเบียนเป็น Excel / PDF",
  },
  {
    code: PERMISSIONS.ORGUNIT_MANAGE,
    group: PERMISSION_GROUPS.ADMIN,
    nameTh: "จัดการหน่วยงาน",
    description: "เพิ่ม แก้ไข ย้าย และเก็บถาวรหน่วยงานในผังองค์กร",
  },
  {
    code: PERMISSIONS.USER_MANAGE,
    group: PERMISSION_GROUPS.ADMIN,
    nameTh: "จัดการผู้ใช้",
    description: "สร้าง/แก้ไขบัญชี สังกัด บทบาท ชั้นความลับ และรีเซ็ตรหัสผ่าน",
  },
  {
    code: PERMISSIONS.ROLE_MANAGE,
    group: PERMISSION_GROUPS.ADMIN,
    nameTh: "จัดการบทบาท",
    description: "แก้ชุดสิทธิ์และขอบเขตของแต่ละบทบาท",
  },
  {
    code: PERMISSIONS.AUDIT_READ,
    group: PERMISSION_GROUPS.ADMIN,
    nameTh: "อ่าน Audit Log",
    description: "ดูบันทึกการกระทำย้อนหลังและตรวจความสมบูรณ์ของ hash chain",
  },
  {
    code: PERMISSIONS.SETTING_MANAGE,
    group: PERMISSION_GROUPS.ADMIN,
    nameTh: "ตั้งค่าระบบ",
    description: "แก้ค่าระบบ เช่น ปีที่ใช้รีเซ็ตเลข ขนาดไฟล์ และนโยบายรหัสผ่าน",
  },
]

export interface RoleSeed {
  code: RoleCode
  nameTh: string
  description: string
  /** ขอบเขตข้อมูลของบทบาทนี้ — ใช้แสดงในหน้า /admin/roles */
  scopeLabel: string
  permissions: Partial<Record<Permission, PermissionScope>>
}

// "✓" ใน spec §4.2 (มีสิทธิ์แต่ไม่ผูก scope) แทนด้วย ORG
// เพราะการกระทำเหล่านั้นไม่ผูกกับเอกสารเป้าหมายอยู่แล้ว — can() จะผ่าน scope ทันที
const ANY: PermissionScope = "ORG"

/** ตารางบทบาท → สิทธิ์ ตั้งต้นตาม spec §4.1 + §4.2 */
export const DEFAULT_ROLES: readonly RoleSeed[] = [
  {
    code: "SYSTEM_ADMIN",
    nameTh: "ผู้ดูแลระบบ",
    description:
      "จัดการผู้ใช้ หน่วยงาน บทบาท และค่าระบบ · ไม่ได้รับสิทธิ์อ่านเอกสารโดยอัตโนมัติ เพื่อกันการสอดส่อง (spec §4.2)",
    scopeLabel: "ทั้งองค์กร",
    permissions: {
      [PERMISSIONS.DOCUMENT_CREATE]: ANY,
      [PERMISSIONS.REPORT_VIEW]: ANY,
      [PERMISSIONS.REPORT_EXPORT]: ANY,
      [PERMISSIONS.ORGUNIT_MANAGE]: ANY,
      [PERMISSIONS.USER_MANAGE]: ANY,
      [PERMISSIONS.ROLE_MANAGE]: ANY,
      [PERMISSIONS.AUDIT_READ]: "ORG",
      [PERMISSIONS.SETTING_MANAGE]: ANY,
    },
  },
  {
    code: "CENTRAL_REGISTRAR",
    nameTh: "สารบรรณกลาง",
    description:
      "ออกเลขหนังสือขององค์กร ลงทะเบียนหนังสือรับ ส่งออกภายนอก ตีกลับแก้ไข และออกรายงานทะเบียน",
    scopeLabel: "ทั้งองค์กร",
    permissions: {
      [PERMISSIONS.DOCUMENT_CREATE]: ANY,
      [PERMISSIONS.DOCUMENT_READ]: "ORG",
      [PERMISSIONS.DOCUMENT_UPDATE]: "ORG",
      [PERMISSIONS.DOCUMENT_DELETE]: "ORG",
      [PERMISSIONS.DOCUMENT_SUBMIT]: ANY,
      [PERMISSIONS.DOCUMENT_NUMBER_ISSUE]: "ORG",
      [PERMISSIONS.DOCUMENT_RETURN]: "ORG",
      [PERMISSIONS.DOCUMENT_SEND_EXTERNAL]: ANY,
      [PERMISSIONS.DOCUMENT_CIRCULATE]: ANY,
      [PERMISSIONS.DOCUMENT_ACKNOWLEDGE]: ANY,
      [PERMISSIONS.DOCUMENT_CLOSE]: "ORG",
      [PERMISSIONS.ATTACHMENT_UPLOAD]: ANY,
      [PERMISSIONS.ATTACHMENT_DOWNLOAD]: "ORG",
      [PERMISSIONS.ATTACHMENT_GRANT]: "ORG",
      [PERMISSIONS.CONFIDENTIAL_ACCESS]: "ORG",
      [PERMISSIONS.REPORT_VIEW]: "ORG",
      [PERMISSIONS.REPORT_EXPORT]: "ORG",
      [PERMISSIONS.AUDIT_READ]: "ORG",
    },
  },
  {
    code: "DEPT_OFFICER",
    nameTh: "ธุรการหน่วยงาน",
    description: "ออกเลขหนังสือภายในของหน่วยงาน สร้าง/แก้ไข/เวียนหนังสือ และดูทะเบียนของหน่วยงานตน",
    scopeLabel: "หน่วยงานตนและหน่วยงานลูก",
    permissions: {
      [PERMISSIONS.DOCUMENT_CREATE]: ANY,
      [PERMISSIONS.DOCUMENT_READ]: "SUBTREE",
      [PERMISSIONS.DOCUMENT_UPDATE]: "UNIT",
      [PERMISSIONS.DOCUMENT_DELETE]: "UNIT",
      [PERMISSIONS.DOCUMENT_SUBMIT]: ANY,
      [PERMISSIONS.DOCUMENT_NUMBER_ISSUE]: "UNIT",
      [PERMISSIONS.DOCUMENT_RETURN]: "UNIT",
      [PERMISSIONS.DOCUMENT_CIRCULATE]: ANY,
      [PERMISSIONS.DOCUMENT_ACKNOWLEDGE]: ANY,
      [PERMISSIONS.DOCUMENT_CLOSE]: "UNIT",
      [PERMISSIONS.ATTACHMENT_UPLOAD]: ANY,
      [PERMISSIONS.ATTACHMENT_DOWNLOAD]: "UNIT",
      [PERMISSIONS.ATTACHMENT_GRANT]: "UNIT",
      [PERMISSIONS.CONFIDENTIAL_ACCESS]: "UNIT",
      [PERMISSIONS.REPORT_VIEW]: "UNIT",
      [PERMISSIONS.REPORT_EXPORT]: "UNIT",
      [PERMISSIONS.AUDIT_READ]: "UNIT",
    },
  },
  {
    code: "EXECUTIVE",
    nameTh: "ผู้บริหาร",
    description: "เห็นหนังสือทุกฉบับในสายบังคับบัญชาของตน ดู dashboard และบันทึกความเห็น/สั่งการ",
    scopeLabel: "สายบังคับบัญชาของตน",
    permissions: {
      [PERMISSIONS.DOCUMENT_CREATE]: ANY,
      [PERMISSIONS.DOCUMENT_READ]: "SUBTREE",
      [PERMISSIONS.DOCUMENT_SUBMIT]: ANY,
      [PERMISSIONS.DOCUMENT_CIRCULATE]: ANY,
      [PERMISSIONS.DOCUMENT_ACKNOWLEDGE]: ANY,
      [PERMISSIONS.DOCUMENT_CLOSE]: "SUBTREE",
      [PERMISSIONS.ATTACHMENT_UPLOAD]: ANY,
      [PERMISSIONS.ATTACHMENT_DOWNLOAD]: "SUBTREE",
      [PERMISSIONS.ATTACHMENT_GRANT]: "SUBTREE",
      [PERMISSIONS.CONFIDENTIAL_ACCESS]: "SUBTREE",
      [PERMISSIONS.REPORT_VIEW]: "SUBTREE",
      [PERMISSIONS.REPORT_EXPORT]: "SUBTREE",
      [PERMISSIONS.AUDIT_READ]: "SUBTREE",
    },
  },
  {
    code: "USER",
    nameTh: "ผู้ใช้ทั่วไป",
    description: "ร่างหนังสือ และดูหนังสือที่ตนสร้าง ถูกส่งถึง หรือได้รับสิทธิ์เป็นราย ๆ",
    scopeLabel: "เฉพาะที่เกี่ยวข้องกับตน",
    permissions: {
      [PERMISSIONS.DOCUMENT_CREATE]: ANY,
      [PERMISSIONS.DOCUMENT_READ]: "OWN",
      [PERMISSIONS.DOCUMENT_UPDATE]: "OWN",
      [PERMISSIONS.DOCUMENT_DELETE]: "OWN",
      [PERMISSIONS.DOCUMENT_SUBMIT]: ANY,
      [PERMISSIONS.DOCUMENT_ACKNOWLEDGE]: ANY,
      [PERMISSIONS.ATTACHMENT_UPLOAD]: "OWN",
      [PERMISSIONS.ATTACHMENT_DOWNLOAD]: "OWN",
      [PERMISSIONS.ATTACHMENT_GRANT]: "OWN",
      [PERMISSIONS.CONFIDENTIAL_ACCESS]: "OWN",
    },
  },
]

/** ป้ายไทยของแต่ละ scope — ใช้ใน legend ของหน้า /admin/roles */
export const SCOPE_LABELS: Record<PermissionScope, string> = {
  OWN: "ของตนเอง",
  UNIT: "หน่วยงานนี้",
  SUBTREE: "หน่วยงานและลูก",
  ORG: "ทั้งองค์กร",
}
