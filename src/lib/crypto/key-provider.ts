import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

import type { KeyProvider, WrappedDek } from "./types"

// Master Key (KEK) ที่ใช้ wrap DEK ของแต่ละไฟล์ (spec §8.2)
//
// กติกาที่บังคับไว้ที่นี่:
//   - กุญแจอ่านจาก env เท่านั้น **ห้ามเก็บใน database หรือ git เด็ดขาด**
//   - รองรับหลายรุ่นพร้อมกัน เพื่อให้ rotate ได้โดยไม่ต้องถอด-เข้ารหัสไฟล์เก่าทั้งระบบ
//     ของใหม่ wrap ด้วยรุ่นล่าสุด · ของเก่าถอดด้วยรุ่นที่ถูกบันทึกไว้ในแถวของมันเอง
//
// รูปแบบค่าใน env `FILE_MASTER_KEY` รับสองแบบ:
//   "<base64 32 ไบต์>"                       → รุ่นที่ 1 (แบบง่าย ใช้ตอนติดตั้งครั้งแรก)
//   "2:<base64>,1:<base64>"                  → หลายรุ่น · รุ่นสูงสุดคือรุ่นที่ใช้ wrap ของใหม่
//
// ตอน rotate: เติมรุ่นใหม่ไว้ **หน้า** รุ่นเดิม แล้วเก็บรุ่นเดิมไว้จนกว่าจะไล่ re-wrap ครบ

const KEY_ENV = "FILE_MASTER_KEY"
const KEY_BYTES = 32
const WRAP_ALGO = "aes-256-gcm"
const WRAP_IV_BYTES = 12

export class EnvKeyProvider implements KeyProvider {
  /** อ่าน env ตอนใช้ครั้งแรก ไม่ใช่ตอน import — ไม่งั้น build/test ที่ไม่มีกุญแจจะพังทันที */
  private keys: Map<number, Buffer> | null = null
  private latest = 0

  constructor(private readonly raw: string | undefined = undefined) {}

  currentKeyVersion(): number {
    this.load()
    return this.latest
  }

  wrapDek(dek: Buffer): WrappedDek {
    if (dek.length !== KEY_BYTES) {
      throw new Error(`DEK ต้องยาว ${KEY_BYTES} ไบต์ (ได้ ${dek.length})`)
    }

    this.load()
    const kek = this.mustGet(this.latest)
    const iv = randomBytes(WRAP_IV_BYTES)
    const cipher = createCipheriv(WRAP_ALGO, kek, iv)
    const wrapped = Buffer.concat([cipher.update(dek), cipher.final()])

    // iv กับ authTag ของการ wrap ฝังมากับสตริงเลย เพื่อให้ DB มีคอลัมน์เดียวพอ
    const encryptedDek = [
      iv.toString("base64"),
      cipher.getAuthTag().toString("base64"),
      wrapped.toString("base64"),
    ].join(".")

    return { encryptedDek, keyVersion: this.latest }
  }

  unwrapDek(wrapped: WrappedDek): Buffer {
    this.load()
    const kek = this.mustGet(wrapped.keyVersion)
    const [iv, authTag, ciphertext] = wrapped.encryptedDek.split(".")

    if (iv === undefined || authTag === undefined || ciphertext === undefined) {
      throw new Error("encryptedDek ไม่ถูกรูปแบบ (ต้องเป็น iv.authTag.ciphertext)")
    }
    const decipher = createDecipheriv(WRAP_ALGO, kek, Buffer.from(iv, "base64"))
    decipher.setAuthTag(Buffer.from(authTag, "base64"))

    // ถ้ากุญแจผิดหรือค่าใน DB ถูกแก้ final() จะโยนที่บรรทัดนี้ — เป็นด่านที่ต้องการ
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()])
  }

  private mustGet(version: number): Buffer {
    const key = this.keys?.get(version)

    if (!key) {
      throw new Error(
        `ไม่มี Master Key รุ่นที่ ${version} ใน ${KEY_ENV} — ไฟล์ที่เข้ารหัสด้วยรุ่นนี้จะถอดไม่ได้`,
      )
    }

    return key
  }

  private load() {
    if (this.keys) return

    const raw = (this.raw ?? process.env[KEY_ENV] ?? "").trim()

    if (!raw) {
      throw new Error(
        `ยังไม่ได้ตั้ง ${KEY_ENV} — เอกสารชั้นความลับเข้ารหัสไม่ได้ · สร้างด้วย openssl rand -base64 32`,
      )
    }

    const keys = new Map<number, Buffer>()

    for (const entry of raw.split(",")) {
      const trimmed = entry.trim()
      if (!trimmed) continue

      const separator = trimmed.indexOf(":")
      const version = separator === -1 ? 1 : Number(trimmed.slice(0, separator))
      const value = separator === -1 ? trimmed : trimmed.slice(separator + 1)

      if (!Number.isInteger(version) || version < 1) {
        throw new Error(`รุ่นของ Master Key ต้องเป็นจำนวนเต็มตั้งแต่ 1 (ได้ "${trimmed}")`)
      }

      if (keys.has(version)) {
        throw new Error(`${KEY_ENV} มีกุญแจรุ่นที่ ${version} ซ้ำกัน`)
      }

      const key = Buffer.from(value, "base64")

      if (key.length !== KEY_BYTES) {
        throw new Error(
          `Master Key รุ่นที่ ${version} ต้องยาว ${KEY_BYTES} ไบต์ (ได้ ${key.length}) · สร้างด้วย openssl rand -base64 32`,
        )
      }

      keys.set(version, key)
    }

    if (keys.size === 0) throw new Error(`${KEY_ENV} ไม่มีกุญแจที่ใช้ได้เลย`)

    this.keys = keys
    this.latest = Math.max(...keys.keys())
  }
}

/** ตัวที่ทั้งระบบใช้ร่วมกัน — ต่อ Vault/HSM วันหลังแก้ที่บรรทัดนี้บรรทัดเดียว */
export const keyProvider: KeyProvider = new EnvKeyProvider()
