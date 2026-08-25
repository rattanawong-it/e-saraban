import "server-only"

import { createReadStream } from "node:fs"
import { mkdir, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import type { Readable } from "node:stream"

import type { StorageAdapter, StorageKey } from "./types"

// ที่เก็บไฟล์แนบบนดิสก์ (D8 · spec §8.2)
//
// กติกาจาก §8.2 ที่บังคับไว้ในไฟล์นี้:
//   - ไฟล์ตั้งชื่อด้วย UUID ไม่ใช่ชื่อที่ผู้ใช้อัปโหลด — กันชื่อไฟล์ภาษาไทย/อักขระพิเศษ
//     และกันการเดาชื่อไฟล์ของคนอื่น
//   - เก็บ **นอก** public/ เสมอ — ถ้าอยู่ใน public/ Next จะเสิร์ฟไฟล์ตรงโดยไม่ผ่าน can()
//   - key ต้องไม่มี ".." หรือ path separator — กัน path traversal ออกนอกโฟลเดอร์ที่เก็บ
//
// ⚠️ P2 เก็บเป็น plaintext ตาม D18 · การเข้ารหัส envelope อยู่ที่ src/lib/crypto/ ใน P3
//    adapter ตัวนี้จะไม่เปลี่ยนเลยตอนนั้น เพราะมันรับ-ส่ง byte ดิบอยู่แล้ว

/** โฟลเดอร์ที่เก็บไฟล์จริง — ตั้งผ่าน env ได้เพื่อชี้ไป volume ของ Docker */
const STORAGE_ROOT = process.env.STORAGE_ROOT ?? path.join(process.cwd(), "storage", "attachments")

/** UUID เท่านั้น — ไม่มีจุด ไม่มี slash จึงออกนอกโฟลเดอร์ไม่ได้ */
const SAFE_KEY = /^[0-9a-fA-F-]{36}$/

export class LocalFsStorage implements StorageAdapter {
  constructor(private readonly root: string = STORAGE_ROOT) {}

  async put(key: StorageKey, data: Readable | Uint8Array): Promise<{ bytesWritten: number }> {
    const target = this.resolve(key)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, data)

    const written = await stat(target)
    return { bytesWritten: written.size }
  }

  async get(key: StorageKey): Promise<Readable> {
    const target = this.resolve(key)
    if (!(await this.exists(key))) {
      throw new Error(`ไม่พบไฟล์แนบในที่เก็บ (key=${key})`)
    }

    // อ่านเป็น stream — ไฟล์แนบใหญ่ได้ถึง 50MB ห้ามโหลดทั้งก้อนขึ้น memory
    return createReadStream(target)
  }

  async exists(key: StorageKey): Promise<boolean> {
    try {
      const found = await stat(this.resolve(key))
      return found.isFile()
    } catch {
      return false
    }
  }

  async delete(key: StorageKey): Promise<void> {
    await rm(this.resolve(key), { force: true })
  }

  /** แตกเป็นสองชั้นตามสองตัวอักษรแรก — กันโฟลเดอร์เดียวมีไฟล์เป็นแสนจนช้า */
  private resolve(key: StorageKey): string {
    if (!SAFE_KEY.test(key)) {
      throw new Error(`storage key ไม่ถูกรูปแบบ (ต้องเป็น UUID เท่านั้น): ${key}`)
    }

    return path.join(this.root, key.slice(0, 2), key)
  }
}

/** ตัวที่ทั้งระบบใช้ร่วมกัน — เปลี่ยนเป็น S3 วันหลังแก้ที่บรรทัดนี้บรรทัดเดียว */
export const storage: StorageAdapter = new LocalFsStorage()
