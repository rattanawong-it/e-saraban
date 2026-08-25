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
export async function getSystemSettings(
  tenantId: string,
  /**
   * client ที่ใช้อ่าน — ส่ง `tx` เข้ามาเมื่อเรียกจากในทรานแซกชัน
   *
   * ⚠️ ถ้าเรียกด้วย prisma ตัวหลักจากภายในทรานแซกชัน จะขอ connection ใบที่สอง
   * ทั้งที่ใบแรกยังถูกจองอยู่ → พอมีหลายทรานแซกชันพร้อมกัน connection pool จะตันกันเอง
   * (เจอจริงตอนทดสอบออกเลข 50 ฉบับพร้อมกัน — ดู progress.md §18)
   */
  client: Pick<typeof prisma, "systemSetting"> = prisma,
): Promise<SystemSettings> {
  const rows = await client.systemSetting.findMany({ where: { tenantId } })

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
