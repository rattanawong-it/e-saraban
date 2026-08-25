import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { Readable } from "node:stream"

import { keyProvider } from "./key-provider"
import type { EnvelopeMetadata, KeyProvider } from "./types"

// Envelope encryption ของไฟล์แนบ (spec §8.2)
//
//   1. ทุกไฟล์สุ่ม DEK ของตัวเอง (AES-256-GCM)
//   2. เข้ารหัสเนื้อไฟล์ด้วย DEK
//   3. DEK ถูก wrap ด้วย Master Key (KEK) แล้วเก็บลง DB — ตัว DEK ดิบไม่เคยลงดิสก์
//
// ทำไมต้อง DEK ต่อไฟล์: ถ้าใช้กุญแจเดียวทั้งระบบ กุญแจหลุดครั้งเดียวเสียทุกไฟล์
// และ rotate กุญแจต้องถอด-เข้ารหัสไฟล์ใหม่ทั้งหมด · แบบนี้ rotate แค่ re-wrap DEK ก้อนเล็ก
//
// GCM ให้ทั้งความลับและความครบถ้วน — ไฟล์ที่ถูกแก้บนดิสก์จะถอดไม่ผ่าน authTag

export const ENVELOPE_ALGO = "aes-256-gcm"

const DEK_BYTES = 32
const IV_BYTES = 12

export interface EncryptedPayload {
  ciphertext: Buffer
  meta: EnvelopeMetadata
}

/**
 * เข้ารหัสทั้งก้อน — ใช้ตอนอัปโหลด เพราะ Server Action ส่งไฟล์มาเป็น byte ทั้งก้อนอยู่แล้ว
 */
export function encryptBytes(
  plain: Uint8Array,
  provider: KeyProvider = keyProvider,
): EncryptedPayload {
  const dek = randomBytes(DEK_BYTES)

  try {
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv(ENVELOPE_ALGO, dek, iv)
    const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()])
    const wrapped = provider.wrapDek(dek)

    return {
      ciphertext,
      meta: {
        encAlgo: ENVELOPE_ALGO,
        encryptedDek: wrapped.encryptedDek,
        iv: iv.toString("base64"),
        authTag: cipher.getAuthTag().toString("base64"),
        keyVersion: wrapped.keyVersion,
      },
    }
  } finally {
    // ลบ DEK ออกจากหน่วยความจำทันทีที่ใช้เสร็จ — ลดโอกาสติดไปกับ core dump / heap snapshot
    dek.fill(0)
  }
}

/** ถอดทั้งก้อน — ใช้เมื่อปลายทางต้องการไฟล์เต็ม เช่นตอนแปะ watermark ลง PDF */
export function decryptBytes(
  ciphertext: Uint8Array,
  meta: EnvelopeMetadata,
  provider: KeyProvider = keyProvider,
): Buffer {
  const decipher = createDecipher(meta, provider)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

/**
 * ถอดแบบ stream — ใช้ตอนส่งไฟล์ให้ผู้ใช้ ไฟล์แนบใหญ่ได้ถึง 50MB ห้ามโหลดขึ้น memory ทั้งก้อน
 *
 * ⚠️ GCM ตรวจ authTag ได้ตอน **จบ** stream เท่านั้น ถ้าไฟล์บนดิสก์ถูกแก้
 * ผู้ใช้จะได้ byte ต้น ๆ ไปแล้วก่อนที่ stream จะพังกลางคัน — ปลายทางจึงได้ไฟล์ไม่ครบเสมอ
 * ไม่ใช่ไฟล์ที่ถูกแก้ทั้งไฟล์ · การยืนยันความครบถ้วนแบบสมบูรณ์ใช้ `sha256` ที่เก็บไว้แทน
 *
 * ⚠️ **ห้ามคืน `source.pipe(decipher)` ตรง ๆ** — pipe ทำให้ข้อมูลเริ่มไหลทันที
 * ถ้าผู้เรียกยังไม่ได้อ่าน (เช่นแวะไปเขียน audit ก่อนส่งไฟล์) ไฟล์เล็กจะไหลจนจบ
 * แล้ว authTag ที่ไม่ผ่านจะกลายเป็น **uncaught exception ที่ทำให้ทั้งโปรเซสตาย**
 * เพราะยังไม่มีใครแนบ error listener · `Readable.from(generator)` เริ่มไหลเมื่อมีคนอ่านจริง
 * จึงการันตีว่ามีคนรับ error เสมอ (พิสูจน์ด้วยเทสต์ "ยังไม่มีใครอ่าน" ด้านล่าง)
 */
export function createDecryptStream(
  source: Readable,
  meta: EnvelopeMetadata,
  provider: KeyProvider = keyProvider,
): Readable {
  const decipher = createDecipher(meta, provider)

  // ถ้าอ่านไฟล์จากดิสก์พังกลางทาง ต้องให้ปลายทางรู้ ไม่ใช่ค้างรอ stream ที่ไม่มีวันจบ
  source.on("error", (error) => decipher.destroy(error))

  return Readable.from(
    (async function* () {
      for await (const chunk of source.pipe(decipher)) yield chunk as Buffer
    })(),
  )
}

function createDecipher(meta: EnvelopeMetadata, provider: KeyProvider) {
  if (meta.encAlgo !== ENVELOPE_ALGO) {
    throw new Error(`ไม่รองรับอัลกอริทึม ${meta.encAlgo} (รองรับเฉพาะ ${ENVELOPE_ALGO})`)
  }

  const dek = provider.unwrapDek({ encryptedDek: meta.encryptedDek, keyVersion: meta.keyVersion })

  try {
    const decipher = createDecipheriv(ENVELOPE_ALGO, dek, Buffer.from(meta.iv, "base64"))
    decipher.setAuthTag(Buffer.from(meta.authTag, "base64"))
    return decipher
  } finally {
    dek.fill(0)
  }
}
