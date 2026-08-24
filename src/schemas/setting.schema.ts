import { z } from "zod"

import {
  fileSettingSchema,
  numberingSettingSchema,
  passwordSettingSchema,
  sessionSettingSchema,
} from "@/lib/settings/definitions"

/**
 * ค่าที่มาจากฟอร์ม /admin/settings
 *
 * ฟอร์ม HTML ส่งทุกอย่างมาเป็น string จึงต้อง coerce ก่อน
 * แล้วค่อยส่งต่อให้ schema จริงใน lib/settings ตรวจซ้ำอีกชั้น
 */
export const updateSettingsSchema = z.object({
  yearMode: numberingSettingSchema.shape.yearMode,
  maxSizeMb: z.coerce.number().int().min(1).max(200),
  allowedMimeTypes: z.array(z.string()).min(1, "ต้องอนุญาตอย่างน้อย 1 ประเภทไฟล์"),
  minLength: z.coerce.number().int().min(8).max(64),
  mustChangeOnFirstLogin: z.boolean(),
  checkCommonPasswordList: z.boolean(),
  idleMinutes: z.coerce.number().int().min(5).max(480),
  absoluteHours: z.coerce.number().int().min(1).max(24),
  lockoutThreshold: z.coerce.number().int().min(3).max(20),
  lockoutBaseMinutes: z.coerce.number().int().min(1).max(120),
})

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>

export const settingGroupSchemas = {
  numbering: numberingSettingSchema,
  file: fileSettingSchema,
  password: passwordSettingSchema,
  session: sessionSettingSchema,
}
