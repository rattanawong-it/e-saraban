// สร้างชื่อผู้ใช้จากอีเมล — หน้า /register ไม่ถามชื่อผู้ใช้แล้ว
// แต่ spec §7.1 ยังกำหนดให้ User.username เป็นตัวระบุที่ใช้ล็อกอิน
//
// ไฟล์นี้เป็นฟังก์ชันบริสุทธิ์โดยตั้งใจ (ไม่มี "server-only" ไม่แตะฐานข้อมูล)
// เพื่อให้เขียน unit test ตรง ๆ ได้ · การเช็คว่าชื่อซ้ำหรือไม่อยู่ที่ auth.service

/** ความยาวสูงสุดของชื่อผู้ใช้ตาม usernameSchema — เผื่อที่ไว้ต่อท้ายเลขกันซ้ำด้วย */
const MAX_BASE_LENGTH = 45

/** ชื่อสำรองเมื่ออีเมลไม่เหลืออักขระที่ใช้ได้เลย เช่น อีเมลที่ local part เป็นภาษาไทยล้วน */
const FALLBACK = "user"

/**
 * แปลงส่วนหน้า @ ของอีเมลให้เป็นชื่อผู้ใช้ที่ผ่าน `usernameSchema`
 * (a-z 0-9 จุด ขีดล่าง ขีดกลาง · ยาว 3–50)
 *
 * ผลลัพธ์อาจซ้ำกับคนอื่นได้ — ผู้เรียกต้องเช็คกับฐานข้อมูลแล้วต่อท้ายเลขเอง
 */
export function usernameFromEmail(email: string): string {
  const localPart = email.trim().toLowerCase().split("@")[0] ?? ""

  const cleaned = localPart
    .replace(/[^a-z0-9._-]+/g, ".") // อักขระที่ใช้ไม่ได้ (รวมภาษาไทย) กลายเป็นจุด
    .replace(/\.{2,}/g, ".") // จุดติดกันเหลือจุดเดียว
    .replace(/^[._-]+|[._-]+$/g, "") // ตัดตัวคั่นหัวท้ายทิ้ง
    .slice(0, MAX_BASE_LENGTH)

  if (cleaned.length === 0) return FALLBACK
  if (cleaned.length < 3) return `${cleaned}.${FALLBACK}`

  return cleaned
}

/** ชื่อผู้ใช้ลำดับที่ n ของฐานเดียวกัน — ลำดับแรกคือฐานเปล่า ๆ ไม่มีเลขต่อท้าย */
export function usernameCandidate(base: string, attempt: number): string {
  return attempt === 0 ? base : `${base}${attempt + 1}`
}
