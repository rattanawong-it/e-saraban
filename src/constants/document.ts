import type { RoleCode } from "@/lib/authz"

// ป้ายกำกับของเอกสาร — ถอดจาก spec §8.1 (ชั้นความลับ) และ §9 (urgencyLevel 0–3)
//
// ที่นี่เก็บเฉพาะ **ข้อความและระดับ** ตาม spec §12
// ส่วนพฤติกรรมจริง (เข้ารหัส · watermark · ห้ามดาวน์โหลด) เป็นเรื่องของ
// service layer ใน P3 — อย่าเอาเงื่อนไขความปลอดภัยมาผูกกับตารางป้ายชื่อนี้

/** 0 ปกติ · 1 ลับ · 2 ลับมาก · 3 ลับที่สุด (spec §8.1) */
export const CONFIDENTIALITY_LEVELS = [
  { level: 0, label: "ปกติ", tone: "neutral" },
  { level: 1, label: "ลับ", tone: "yellow" },
  { level: 2, label: "ลับมาก", tone: "orange" },
  { level: 3, label: "ลับที่สุด", tone: "red" },
] as const

export type ConfidentialityLevel = (typeof CONFIDENTIALITY_LEVELS)[number]["level"]

/** 0 ปกติ · 1 ด่วน · 2 ด่วนมาก · 3 ด่วนที่สุด (spec §9 · §10.2) */
export const URGENCY_LEVELS = [
  { level: 0, label: "ปกติ" },
  { level: 1, label: "ด่วน" },
  { level: 2, label: "ด่วนมาก" },
  { level: 3, label: "ด่วนที่สุด" },
] as const

export type UrgencyLevel = (typeof URGENCY_LEVELS)[number]["level"]

/**
 * ชื่อบทบาทสำหรับแสดงผล — รหัสจริงอยู่ที่ src/lib/authz (spec §4.1)
 *
 * `satisfies Record<RoleCode, string>` ทำให้ถ้าวันหลังเพิ่มบทบาทใน ROLE_CODES
 * แล้วลืมใส่ชื่อไทยตรงนี้ typecheck จะฟ้องทันที ไม่ใช่ไปโผล่เป็นค่าว่างบนหน้าจอ
 */
export const ROLE_LABELS = {
  SYSTEM_ADMIN: "ผู้ดูแลระบบ",
  CENTRAL_REGISTRAR: "สารบรรณกลาง",
  DEPT_OFFICER: "ธุรการหน่วยงาน",
  EXECUTIVE: "ผู้บริหาร",
  USER: "ผู้ใช้ทั่วไป",
} as const satisfies Record<RoleCode, string>
