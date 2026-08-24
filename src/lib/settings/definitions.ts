import { z } from "zod"

// ค่าระบบที่ผู้ดูแลแก้ได้จาก /admin/settings (spec §10.1)
//
// เก็บใน SystemSetting เป็น key → Json แถวเดียวต่อกลุ่ม
// แยกเป็น "กลุ่ม" ไม่ใช่ key ละค่า เพื่อให้บันทึกทั้งหน้าได้ใน transaction เดียว
// และอ่านทีเดียวได้ครบตอน render หน้าจอ

/** ปีที่ใช้รีเซ็ตเลขทะเบียน (spec §7.2) — ค่าเริ่มต้น CALENDAR */
export const YEAR_MODES = ["CALENDAR", "FISCAL"] as const
export type YearMode = (typeof YEAR_MODES)[number]

export const YEAR_MODE_LABELS: Record<YearMode, string> = {
  CALENDAR: "ปีปฏิทิน (1 ม.ค. – 31 ธ.ค.)",
  FISCAL: "ปีงบประมาณ (1 ต.ค. – 30 ก.ย.)",
}

export const numberingSettingSchema = z.object({
  yearMode: z.enum(YEAR_MODES).default("CALENDAR"),
})

export const fileSettingSchema = z.object({
  maxSizeMb: z.number().int().min(1).max(200).default(50),
  allowedMimeTypes: z
    .array(z.string())
    .default([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg",
      "image/png",
    ]),
})

export const passwordSettingSchema = z.object({
  minLength: z.number().int().min(8).max(64).default(10),
  mustChangeOnFirstLogin: z.boolean().default(true),
  checkCommonPasswordList: z.boolean().default(true),
})

export const sessionSettingSchema = z.object({
  idleMinutes: z.number().int().min(5).max(480).default(30),
  absoluteHours: z.number().int().min(1).max(24).default(8),
  /** จำนวนครั้งที่ผิดก่อนเริ่มล็อก (spec §8.4) */
  lockoutThreshold: z.number().int().min(3).max(20).default(5),
  /** นาทีตั้งต้นของ exponential backoff — ครั้งถัดไปคูณสอง */
  lockoutBaseMinutes: z.number().int().min(1).max(120).default(15),
})

export const SETTING_KEYS = {
  NUMBERING: "numbering",
  FILE: "file",
  PASSWORD: "password",
  SESSION: "session",
} as const

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]

export const settingsSchema = z.object({
  numbering: numberingSettingSchema,
  file: fileSettingSchema,
  password: passwordSettingSchema,
  session: sessionSettingSchema,
})

export type SystemSettings = z.infer<typeof settingsSchema>

/** ค่าปริยายทั้งชุด — ใช้ตอนยังไม่เคยบันทึกค่าใด ๆ ลงฐานข้อมูล */
export const DEFAULT_SETTINGS: SystemSettings = settingsSchema.parse({
  numbering: {},
  file: {},
  password: {},
  session: {},
})
