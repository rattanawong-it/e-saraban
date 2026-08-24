import type { AuthzContext } from "@/lib/authz"

// ServiceContext — spec §11.3 ข้อ 2:
// "ทุก service method รับ ctx เป็น argument แรก" และ
// "**ตรวจสิทธิ์ที่ service layer เสมอ ไม่ใช่ที่ UI**"
//
// เหตุผลที่บังคับเป็น argument แรกแทนการอ่าน session ในตัว service เอง:
// service จะได้ทดสอบได้โดยไม่ต้องมี request จริง และมองเห็นได้จาก signature
// ว่าเมธอดนั้นทำงาน "ในนามใคร ในหน่วยงานไหน"

export interface ServiceContext extends AuthzContext {
  /** id ของแถวในตาราง Session — บันทึกลง audit เพื่อไล่ย้อนได้ว่ามาจากเซสชันไหน */
  sessionId: string

  ip: string | null
  userAgent: string | null
}

/** ข้อมูลผู้ใช้ที่ UI ต้องใช้แสดงผล — แยกจาก ServiceContext เพราะเป็นคนละหน้าที่ */
export interface CurrentUser {
  id: string
  username: string
  prefix: string | null
  firstName: string
  lastName: string
  email: string | null
  fullName: string
  initials: string
  clearanceLevel: number
  mustChangePassword: boolean
}

/** สังกัดหนึ่งของผู้ใช้ พร้อมบทบาทที่ถือในสังกัดนั้น (ใช้ใน Context Switcher) */
export interface UserAffiliation {
  orgUnitId: string
  orgUnitName: string
  orgUnitShortName: string | null
  orgUnitCode: string
  orgUnitPath: string
  positionTitle: string | null
  isPrimary: boolean
  roleCodes: string[]
  roleLabels: string[]
}

/** ทุกอย่างที่ layout ของ (app) ต้องใช้ในการ render — โหลดครั้งเดียวต่อ request */
export interface AppSession {
  ctx: ServiceContext
  user: CurrentUser
  affiliations: UserAffiliation[]
  activeAffiliation: UserAffiliation | null
}
