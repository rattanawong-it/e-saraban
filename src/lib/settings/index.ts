import "server-only"

import { prisma } from "@/lib/db"

import {
  DEFAULT_SETTINGS,
  SETTING_KEYS,
  settingsSchema,
  type SettingKey,
  type SystemSettings,
} from "./definitions"

export * from "./definitions"

/**
 * อ่านค่าระบบทั้งชุด — ค่าที่ยังไม่เคยบันทึกจะได้ค่าปริยายอัตโนมัติ
 *
 * ทุก schema ของแต่ละกลุ่มมี `.default()` ครบทุกฟิลด์ จึงเติมค่าที่ขาด
 * ให้เองเมื่อมีการเพิ่มฟิลด์ใหม่ภายหลัง โดยไม่ต้อง migrate ข้อมูล
 */
export async function getSystemSettings(tenantId: string): Promise<SystemSettings> {
  const rows = await prisma.systemSetting.findMany({ where: { tenantId } })

  const raw: Record<string, unknown> = {
    numbering: {},
    file: {},
    password: {},
    session: {},
  }

  for (const row of rows) {
    if (isSettingKey(row.key)) {
      raw[row.key] = row.value
    }
  }

  const parsed = settingsSchema.safeParse(raw)
  return parsed.success ? parsed.data : DEFAULT_SETTINGS
}

function isSettingKey(key: string): key is SettingKey {
  return (Object.values(SETTING_KEYS) as string[]).includes(key)
}
