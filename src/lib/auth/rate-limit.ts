import "server-only"

// การป้องกัน brute force (spec §8.4)
//
// สองชั้นที่ทำงานคนละหน้าที่:
//   1. **ต่อบัญชี** — failedLoginCount ในตาราง User + lockedUntil แบบ exponential backoff
//      (อยู่ในฐานข้อมูล จึงอยู่ข้ามการรีสตาร์ทและข้าม instance)
//   2. **ต่อ IP** — sliding window ในหน่วยความจำของ process
//      กันคนยิงสุ่ม username รัว ๆ ซึ่งชั้นที่ 1 จับไม่ได้เพราะแต่ละบัญชีผิดแค่ครั้งเดียว
//
// ⚠️ ข้อจำกัดที่ต้องรู้: ชั้นที่ 2 เก็บใน memory ของ process เดียว
// ถ้าวันหลัง scale เป็นหลาย instance ต้องย้ายไป Redis — โครงสร้าง interface
// ตรงนี้ออกแบบให้เปลี่ยนตัวเก็บได้โดยไม่ต้องแก้ผู้เรียก

export interface RateLimitResult {
  allowed: boolean
  /** จำนวนครั้งที่เหลือในหน้าต่างนี้ */
  remaining: number
  /** เวลาที่หน้าต่างจะรีเซ็ต */
  resetAt: Date
}

interface Bucket {
  hits: number[]
}

const buckets = new Map<string, Bucket>()

/** ล้าง bucket ที่หมดอายุ — เรียกทุกครั้งที่ตรวจ กันหน่วยความจำโตไม่จำกัด */
function sweep(now: number, windowMs: number) {
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((at) => now - at < windowMs)
    if (bucket.hits.length === 0) buckets.delete(key)
  }
}

/**
 * Sliding window rate limit
 *
 * @param key      ตัวระบุผู้เรียก เช่น `login:203.0.113.5`
 * @param limit    จำนวนครั้งสูงสุดในหน้าต่าง
 * @param windowMs ความยาวหน้าต่างเป็นมิลลิวินาที
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  sweep(now, windowMs)

  const bucket = buckets.get(key) ?? { hits: [] }
  bucket.hits = bucket.hits.filter((at) => now - at < windowMs)

  const oldest = bucket.hits[0] ?? now
  const resetAt = new Date(oldest + windowMs)

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket)
    return { allowed: false, remaining: 0, resetAt }
  }

  bucket.hits.push(now)
  buckets.set(key, bucket)

  return { allowed: true, remaining: limit - bucket.hits.length, resetAt }
}

/** ล้างประวัติของ key นั้น — เรียกเมื่อ login สำเร็จ */
export function resetRateLimit(key: string): void {
  buckets.delete(key)
}

/** ใช้ในเทสต์เท่านั้น */
export function clearAllRateLimits(): void {
  buckets.clear()
}

/** จำนวนครั้งที่ยอมให้ผิดต่อ IP ใน 15 นาที — หลวมกว่าระดับบัญชีเพราะ IP เดียวอาจมีหลายคนใช้ */
export const LOGIN_IP_LIMIT = 30
export const LOGIN_IP_WINDOW_MS = 15 * 60 * 1000

// ── หน้าที่เปิดให้คนนอกใช้โดยไม่ต้องล็อกอิน (spec §8.4) ────────────────────
//
// สองหน้านี้ยิงซ้ำ ๆ ได้โดยไม่ต้องมีบัญชี ถ้าไม่จำกัดก็สร้างคำขอค้างคิวให้ผู้ดูแลได้ไม่จำกัด
// และหน้าลืมรหัสผ่านยังใช้ยิงถามได้ว่าอีเมลไหนมีอยู่จริงในระบบ (แม้ข้อความตอบจะเหมือนกันหมด
// แต่การยิงจำนวนมากคือการกวาดรายชื่อ) · ตั้งหลวมพอสำหรับคนใช้จริงที่กรอกผิดแล้วลองใหม่
export const PUBLIC_FORM_LIMIT = 10
export const PUBLIC_FORM_WINDOW_MS = 15 * 60 * 1000

/**
 * คำนวณเวลาปลดล็อกแบบ exponential backoff (spec §8.4)
 *
 * ผิดครบ threshold ครั้งแรก → ล็อก base นาที
 * ผิดครบอีกรอบ            → ล็อก base × 2 นาที · รอบถัดไป × 4 … เพดาน 24 ชม.
 *
 * คืน `null` เมื่อยังไม่ถึงเกณฑ์ล็อก
 */
export function computeLockUntil(
  failedCount: number,
  threshold: number,
  baseMinutes: number,
  now: Date = new Date(),
): Date | null {
  if (failedCount < threshold) return null

  const overflows = Math.floor(failedCount / threshold) - 1
  const minutes = Math.min(baseMinutes * 2 ** overflows, 24 * 60)

  return new Date(now.getTime() + minutes * 60 * 1000)
}
