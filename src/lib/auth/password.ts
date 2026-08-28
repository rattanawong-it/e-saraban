import "server-only"

import { hash, verify } from "@node-rs/argon2"

import type { SystemSettings } from "@/lib/settings/definitions"

// นโยบายรหัสผ่านตาม spec §8.4:
// Argon2id · ความยาว ≥ 10 · ตรวจกับ common-password list · บังคับเปลี่ยนครั้งแรก
//
// หมายเหตุการเลือก package: spec §11.1 เขียนว่า `argon2` แต่ package นั้นต้อง
// compile ด้วย node-gyp ตอนติดตั้ง ซึ่งพังง่ายทั้งบน Windows (dev) และ alpine (Docker)
// จึงใช้ **@node-rs/argon2** ที่เป็น binding ของ Rust มี prebuilt ครบทั้ง
// win32-x64 และ linux-x64-musl — อัลกอริทึมเดียวกัน (argon2id) ผลลัพธ์เข้ากันได้

/**
 * พารามิเตอร์ Argon2id — อิงค่าที่ OWASP แนะนำ (m=19MiB, t=2, p=1)
 * เก็บเป็นค่าคงที่ที่เดียว เพื่อให้ rehash ตอนเปลี่ยนค่าทำได้จากจุดเดียว
 */
const ARGON2_OPTIONS = {
  algorithm: 2, // Argon2id
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS)
}

/**
 * ตรวจรหัสผ่าน — คืน false เมื่อ hash เสียหายแทนที่จะโยน error
 * เพื่อไม่ให้ผู้โจมตีแยกแยะ "บัญชีไม่มี" กับ "hash พัง" จากพฤติกรรมของระบบ
 *
 * รับ null ได้ตั้งแต่ D19 — บัญชีที่เข้าด้วย Google อย่างเดียวไม่มีรหัสผ่าน (spec §17.3)
 */
export async function verifyPassword(hashValue: string | null, plain: string): Promise<boolean> {
  // บัญชีที่ไม่มีรหัสผ่าน: ยัง hash ทิ้งหนึ่งครั้งให้เวลาตอบใกล้เคียงกับกรณีปกติ
  // ไม่งั้นเวลาที่ตอบเร็วผิดปกติจะกลายเป็นเครื่องมือไล่หาว่าบัญชีไหนผูกกับ Google อยู่
  // — หลักเดียวกับที่ auth.service ทำตอนหาบัญชีไม่เจอ
  if (hashValue === null) {
    await hashPassword(plain)
    return false
  }

  try {
    return await verify(hashValue, plain, ARGON2_OPTIONS)
  } catch {
    return false
  }
}

/**
 * รหัสผ่านที่พบบ่อย — รายการสั้นแบบฝังในโค้ด ครอบเคสที่เจอจริงในองค์กรไทย
 * (spec §8.4 สั่งให้ "ตรวจกับ common-password list")
 *
 * ตั้งใจไม่โหลดไฟล์ rockyou หลายล้านบรรทัด เพราะระบบนี้บังคับความยาว ≥ 10
 * และมี lockout อยู่แล้ว — รายการยาวขึ้นแลกกับหน่วยความจำที่ container ต้องกิน
 * ตลอดเวลาไม่คุ้ม · ถ้าวันหลังต้องการเข้มขึ้น ให้ต่อกับบริการ k-anonymity ภายนอก
 */
const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "passw0rd",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyuiop",
  "qwerty123",
  "abcd1234",
  "admin1234",
  "administrator",
  "iloveyou",
  "letmein123",
  "welcome123",
  "changeme",
  "changeme123",
  "p@ssw0rd",
  "p@ssword1",
  "thailand123",
  "bangkok123",
  "saraban123",
  "esaraban123",
  "university1",
  "krirk1234",
])

export interface PasswordPolicyIssue {
  code: "TOO_SHORT" | "COMMON" | "NO_VARIETY" | "SAME_AS_USERNAME"
  message: string
}

/**
 * ตรวจรหัสผ่านตามนโยบาย — คืนรายการปัญหา (ว่าง = ผ่าน)
 *
 * ตรวจฝั่ง server เสมอ แม้ฝั่ง client จะตรวจแล้ว
 */
export function validatePassword(
  plain: string,
  policy: SystemSettings["password"],
  username?: string,
): PasswordPolicyIssue[] {
  const issues: PasswordPolicyIssue[] = []

  if (plain.length < policy.minLength) {
    issues.push({
      code: "TOO_SHORT",
      message: `รหัสผ่านต้องยาวอย่างน้อย ${policy.minLength} ตัวอักษร`,
    })
  }

  if (policy.checkCommonPasswordList && COMMON_PASSWORDS.has(plain.toLowerCase())) {
    issues.push({
      code: "COMMON",
      message: "รหัสผ่านนี้พบบ่อยเกินไป กรุณาตั้งรหัสผ่านอื่น",
    })
  }

  // ต้องมีอย่างน้อย 2 ประเภทอักขระ — กันรหัสผ่านที่ยาวแต่เป็นตัวเลขล้วน
  const varieties = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(plain)).length
  if (varieties < 2) {
    issues.push({
      code: "NO_VARIETY",
      message: "รหัสผ่านต้องมีอักขระอย่างน้อย 2 ประเภท (ตัวอักษร ตัวเลข หรือสัญลักษณ์)",
    })
  }

  if (username && plain.toLowerCase().includes(username.toLowerCase())) {
    issues.push({
      code: "SAME_AS_USERNAME",
      message: "รหัสผ่านต้องไม่มีชื่อผู้ใช้อยู่ข้างใน",
    })
  }

  return issues
}

const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"

/**
 * สร้างรหัสผ่านชั่วคราวให้ผู้ดูแลส่งต่อให้ผู้ใช้ (MVP ไม่มีอีเมล — D10)
 *
 * ตัดอักขระที่อ่านสับสน (0/O, 1/l/I) ออก เพราะผู้ดูแลต้องอ่านให้ผู้ใช้ทางโทรศัพท์
 */
export function generateTemporaryPassword(length = 12): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)

  let result = ""
  for (const byte of bytes) {
    result += TEMP_PASSWORD_ALPHABET[byte % TEMP_PASSWORD_ALPHABET.length]
  }

  // การันตีว่ามีทั้งตัวอักษรและตัวเลขเสมอ ไม่ให้ชนกฎ NO_VARIETY ของตัวเอง
  return `${result.slice(0, length - 2)}${randomDigit()}${randomDigit()}`
}

function randomDigit(): string {
  const bytes = new Uint8Array(1)
  crypto.getRandomValues(bytes)
  return String((bytes[0] ?? 0) % 10)
}
