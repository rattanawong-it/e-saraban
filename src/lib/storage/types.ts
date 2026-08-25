import type { Readable } from "node:stream"

// StorageAdapter — spec §11.3 ข้อ 3 บังคับให้เป็น interface **ตั้งแต่วันแรก**
// เพื่อให้เปลี่ยนจาก LocalFs ไป S3 ได้โดยไม่แตะ business logic
//
// ข้อกำหนดจาก spec §8.2 ที่ interface นี้ต้องรองรับ:
//   - ไฟล์บนดิสก์ตั้งชื่อด้วย UUID (ไม่ใช้ชื่อไฟล์จริง) และเก็บ **นอก** public/
//   - ตัว adapter รับ-ส่ง byte ดิบอย่างเดียว ไม่รู้จักกุญแจและไม่รู้ว่าไฟล์เข้ารหัสไว้หรือไม่
//     การเข้ารหัส/ถอดรหัส envelope เป็นหน้าที่ของ src/lib/crypto/ ไม่ใช่ที่นี่
//
// ตัวที่ implement จริงคือ LocalFsStorage ในโฟลเดอร์เดียวกัน

/** คีย์ของอ็อบเจกต์ในที่เก็บ — UUID ไม่ใช่ชื่อไฟล์ที่ผู้ใช้อัปโหลด */
export type StorageKey = string

export interface StorageAdapter {
  /** เขียนไฟล์ · คืนขนาดจริงที่เขียนได้ไว้กระทบยอดกับที่บันทึกใน DB */
  put(key: StorageKey, data: Readable | Uint8Array): Promise<{ bytesWritten: number }>

  /** อ่านไฟล์เป็น stream — ห้ามโหลดทั้งก้อนขึ้น memory เพราะไฟล์แนบถึง 50MB */
  get(key: StorageKey): Promise<Readable>

  exists(key: StorageKey): Promise<boolean>

  /** ลบจริงออกจากที่เก็บ — soft delete ของเอกสารเป็นคนละเรื่อง จัดการที่ DB */
  delete(key: StorageKey): Promise<void>
}
