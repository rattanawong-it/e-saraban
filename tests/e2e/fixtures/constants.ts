// ค่าคงที่ของ e2e ที่ทั้งฝั่งเทสต์และฝั่งสคริปต์เตรียมข้อมูลใช้ร่วมกัน
//
// ⚠️ ไฟล์นี้ต้องไม่ import Prisma หรืออะไรที่แตะฐานข้อมูล — Playwright แปลงไฟล์เทสต์เป็น
// CommonJS ซึ่งโหลด Prisma client (ESM · ใช้ import.meta) ไม่ได้
// งานที่ต้องคุยกับฐานข้อมูลจึงแยกไปอยู่ที่ db-fixture.ts แล้วรันด้วย tsx คนละโปรเซส

export const E2E_USERNAME = process.env.E2E_USERNAME ?? "e2e.runner"
export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "E2eRunner!2569"

/** คำนำหน้าของทุกอย่างที่ e2e สร้าง — ใช้ตามลบทีหลัง */
export const E2E_PREFIX = "[e2e]"

/**
 * หัวข้อของแจ้งเตือนที่ fixture เตรียมไว้ให้เคสกระดิ่ง
 *
 * `orphan` ชี้ไปยังเอกสารที่ไม่มีอยู่จริงโดยตั้งใจ — ต้อง **ไม่** โผล่บนกระดิ่ง
 * เพราะ listNotifications() กรองผ่านด่านการมองเห็นเอกสาร (§22.2)
 */
export const E2E_NOTIFICATION = {
  visible: `${E2E_PREFIX} แจ้งเตือนที่ต้องเห็น`,
  orphan: `${E2E_PREFIX} แจ้งเตือนที่ต้องถูกกรองทิ้ง`,
} as const
