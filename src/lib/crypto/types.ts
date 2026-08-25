// สัญญาของ envelope encryption (spec §8.2)
//
// แยก **การจัดการกุญแจ** (KeyProvider) ออกจาก **การเข้ารหัสเนื้อไฟล์** (envelope.ts)
// เพราะวันหนึ่งกุญแจจะย้ายไป HSM / HashiCorp Vault ตามที่ §8.2 สั่งให้เผื่อไว้
// ตอนนั้นเปลี่ยนแค่ตัวที่ implement KeyProvider — envelope.ts ไม่ต้องแก้เลย

/** DEK ที่ถูก wrap ด้วย Master Key แล้ว — รูปนี้เท่านั้นที่เก็บลงฐานข้อมูลได้ */
export interface WrappedDek {
  /** สตริงเดียวจบ มี iv กับ authTag ของการ wrap ฝังอยู่ข้างใน */
  encryptedDek: string
  /** กุญแจรุ่นที่ใช้ wrap — ต้องเก็บไว้ ไม่งั้น rotate กุญแจแล้วถอดของเก่าไม่ออก */
  keyVersion: number
}

export interface KeyProvider {
  /** รุ่นที่ใช้ wrap ของใหม่ · ของเก่ายังถอดได้ด้วยรุ่นที่ยังอยู่ในมือ */
  currentKeyVersion(): number

  wrapDek(dek: Buffer): WrappedDek

  /**
   * @throws เมื่อไม่มีกุญแจรุ่นที่ขอ หรือ authTag ไม่ตรง (กุญแจผิด/ข้อมูลถูกแก้)
   */
  unwrapDek(wrapped: WrappedDek): Buffer
}

/** ทุกอย่างที่ต้องรู้เพื่อถอดรหัสไฟล์หนึ่งไฟล์ — ตรงกับคอลัมน์ใน `Attachment` */
export interface EnvelopeMetadata {
  encAlgo: string
  encryptedDek: string
  /** iv ของ **เนื้อไฟล์** (base64) — คนละตัวกับ iv ที่ใช้ wrap DEK */
  iv: string
  /** authTag ของเนื้อไฟล์ (base64) — ตัวที่ทำให้รู้ว่าไฟล์ถูกแก้บนดิสก์ */
  authTag: string
  keyVersion: number
}
