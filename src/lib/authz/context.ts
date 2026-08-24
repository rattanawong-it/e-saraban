import type { ConfidentialityLevel } from "@/constants"

import type { GrantedPermissions, RoleCode } from "./permissions"

/**
 * ข้อมูลตัวตนขั้นต่ำที่ `can()` ต้องใช้ (spec §4.3)
 *
 * แยกออกจาก `ServiceContext` เพื่อให้ unit test ของ `can()` สร้าง context ปลอมได้
 * โดยไม่ต้องลาก sessionId / ip / userAgent มาด้วย
 */
export interface AuthzContext {
  userId: string
  tenantId: string

  /** ด่านที่ 1 ของ spec §4.3 — บัญชีถูกระงับแล้วต้องไม่ผ่านทุกอย่าง */
  isActive: boolean

  /** หน่วยงานที่กำลังสวมบทบาทอยู่ (Context Switcher) — null ตอนยังไม่เลือก */
  activeOrgUnitId: string | null

  /** materialized path ของ activeOrgUnit — จำเป็นสำหรับ scope SUBTREE */
  activeOrgUnitPath: string | null

  /** ทุกหน่วยงานที่ผู้ใช้สังกัด — ใช้ตรวจ ACL ที่ให้สิทธิ์ระดับหน่วยงาน */
  orgUnitIds: readonly string[]

  /** รหัสบทบาทที่ถืออยู่ใน context ปัจจุบัน (รวม global role) */
  roleCodes: readonly RoleCode[]

  /** สิทธิ์ในหน่วยงานปัจจุบัน พร้อม scope ของแต่ละสิทธิ์ (spec §4.2) */
  permissions: GrantedPermissions

  /** ชั้นความลับสูงสุดที่ผู้ใช้เข้าถึงได้ 0–3 (spec §8.1) */
  clearanceLevel: ConfidentialityLevel
}
