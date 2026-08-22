import type { ConfidentialityLevel } from "@/constants"
import type { GrantedPermissions } from "@/lib/authz"

// ServiceContext — spec §11.3 ข้อ 2:
// "ทุก service method รับ ctx เป็น argument แรก" และ
// "**ตรวจสิทธิ์ที่ service layer เสมอ ไม่ใช่ที่ UI**"
//
// เหตุผลที่บังคับเป็น argument แรกแทนการอ่าน session ในตัว service เอง:
// service จะได้ทดสอบได้โดยไม่ต้องมี request จริง และมองเห็นได้จาก signature
// ว่าเมธอดนั้นทำงาน "ในนามใคร ในหน่วยงานไหน"

export interface ServiceContext {
  userId: string

  /**
   * spec §11.3 ข้อ 4 — ต้องใส่ใน where clause **ทุก query** ตั้งแต่วันแรก
   * เพื่อเปิด multi-tenant ภายหลังได้โดยไม่ต้อง migrate ใหญ่
   */
  tenantId: string

  /**
   * หน่วยงานที่ผู้ใช้กำลังสวมบทบาทอยู่ (จาก Context Switcher · spec §10.2)
   * คนหนึ่งมีได้หลายสังกัด — ค่านี้คือสังกัดที่ "กำลังทำงานอยู่" ไม่ใช่ทั้งหมด
   */
  activeOrgUnitId: string

  /** สิทธิ์ในหน่วยงานปัจจุบัน พร้อม scope ของแต่ละสิทธิ์ (spec §4.2) */
  permissions: GrantedPermissions

  /** ชั้นความลับสูงสุดที่ผู้ใช้เข้าถึงได้ 0–3 (spec §8.1) */
  clearanceLevel: ConfidentialityLevel
}
