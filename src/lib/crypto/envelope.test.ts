import { randomBytes } from "node:crypto"
import { Readable } from "node:stream"
import { describe, expect, it } from "vitest"

import { createDecryptStream, decryptBytes, encryptBytes, ENVELOPE_ALGO } from "./envelope"
import { EnvKeyProvider } from "./key-provider"

// spec §8.2 — envelope encryption ของไฟล์แนบ
// ทุกเทสต์ส่งกุญแจเข้าไปตรง ๆ ไม่พึ่ง env เพื่อให้รันได้บนเครื่องที่ยังไม่ได้ตั้งค่า

const KEY_A = randomBytes(32).toString("base64")
const KEY_B = randomBytes(32).toString("base64")

const providerV1 = new EnvKeyProvider(KEY_A)
const providerV2 = new EnvKeyProvider(`2:${KEY_B},1:${KEY_A}`)
const providerOnlyV2 = new EnvKeyProvider(`2:${KEY_B}`)

const PLAIN = Buffer.from("บันทึกข้อความ ชั้นความลับ ลับมาก\n%PDF-1.7", "utf8")

async function collect(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

describe("encryptBytes / decryptBytes", () => {
  it("ถอดกลับได้ตรงกับต้นฉบับ", () => {
    const { ciphertext, meta } = encryptBytes(PLAIN, providerV1)

    expect(meta.encAlgo).toBe(ENVELOPE_ALGO)
    expect(meta.keyVersion).toBe(1)
    expect(decryptBytes(ciphertext, meta, providerV1).equals(PLAIN)).toBe(true)
  })

  it("ciphertext ต้องไม่มีเนื้อความเดิมโผล่ออกมา", () => {
    const { ciphertext } = encryptBytes(PLAIN, providerV1)

    expect(ciphertext.includes(Buffer.from("%PDF-1.7"))).toBe(false)
    expect(ciphertext.equals(PLAIN)).toBe(false)
  })

  it("ไฟล์เดียวกันเข้ารหัสสองครั้งต้องได้คนละผล — DEK กับ iv สุ่มใหม่ทุกไฟล์", () => {
    const first = encryptBytes(PLAIN, providerV1)
    const second = encryptBytes(PLAIN, providerV1)

    expect(first.ciphertext.equals(second.ciphertext)).toBe(false)
    expect(first.meta.iv).not.toBe(second.meta.iv)
    expect(first.meta.encryptedDek).not.toBe(second.meta.encryptedDek)
  })

  it("ไฟล์ว่างเปล่าก็ยังเข้ารหัส-ถอดได้", () => {
    const { ciphertext, meta } = encryptBytes(new Uint8Array(), providerV1)

    expect(decryptBytes(ciphertext, meta, providerV1).length).toBe(0)
  })

  it("ไฟล์ที่ถูกแก้บนดิสก์ต้องถอดไม่ผ่าน", () => {
    const { ciphertext, meta } = encryptBytes(PLAIN, providerV1)
    const tampered = Buffer.from(ciphertext)
    tampered.writeUInt8(tampered.readUInt8(0) ^ 0xff, 0)

    expect(() => decryptBytes(tampered, meta, providerV1)).toThrow()
  })

  it("authTag ที่ถูกแก้ในฐานข้อมูลต้องถอดไม่ผ่าน", () => {
    const { ciphertext, meta } = encryptBytes(PLAIN, providerV1)
    const forged = randomBytes(16).toString("base64")

    expect(() => decryptBytes(ciphertext, { ...meta, authTag: forged }, providerV1)).toThrow()
  })

  it("กุญแจคนละดอกถอดไม่ออก", () => {
    const { ciphertext, meta } = encryptBytes(PLAIN, providerV1)

    expect(() => decryptBytes(ciphertext, meta, providerOnlyV2)).toThrow(/รุ่นที่ 1/)
  })

  it("ไม่รับอัลกอริทึมอื่น", () => {
    const { ciphertext, meta } = encryptBytes(PLAIN, providerV1)

    expect(() => decryptBytes(ciphertext, { ...meta, encAlgo: "aes-128-cbc" }, providerV1)).toThrow(
      /ไม่รองรับอัลกอริทึม/,
    )
  })
})

describe("createDecryptStream", () => {
  it("ถอดแบบ stream ได้ผลเท่ากับถอดทั้งก้อน", async () => {
    const big = randomBytes(200 * 1024)
    const { ciphertext, meta } = encryptBytes(big, providerV1)

    // แบ่งเป็นหลายก้อนให้เหมือนอ่านจากดิสก์จริง
    const chunks: Buffer[] = []
    for (let at = 0; at < ciphertext.length; at += 64 * 1024) {
      chunks.push(ciphertext.subarray(at, at + 64 * 1024))
    }

    const result = await collect(createDecryptStream(Readable.from(chunks), meta, providerV1))

    expect(result.equals(big)).toBe(true)
  })

  it("stream ที่เนื้อไฟล์ถูกแก้ต้องจบด้วย error ไม่ใช่ส่งไฟล์เสียให้ผู้ใช้เงียบ ๆ", async () => {
    const { ciphertext, meta } = encryptBytes(PLAIN, providerV1)
    const tampered = Buffer.from(ciphertext)
    tampered.writeUInt8(tampered.readUInt8(tampered.length - 1) ^ 0xff, tampered.length - 1)

    await expect(
      collect(createDecryptStream(Readable.from([tampered]), meta, providerV1)),
    ).rejects.toThrow()
  })

  it("⚠️ ปลายทางที่ยังไม่เริ่มอ่านต้องยังได้รับ error ไม่ใช่ทำทั้งโปรเซสตาย", async () => {
    // เลียนแบบของจริง: openAttachment สร้าง stream แล้วแวะไปเขียน audit ก่อนจะส่งไฟล์
    // ถ้า stream เริ่มไหลเองตั้งแต่ตอนสร้าง error จะโผล่ตอนยังไม่มีใครแนบ listener
    const { ciphertext, meta } = encryptBytes(PLAIN, providerV1)
    const tampered = Buffer.from(ciphertext)
    tampered.writeUInt8(tampered.readUInt8(0) ^ 0xff, 0)

    const stream = createDecryptStream(Readable.from([tampered]), meta, providerV1)
    await new Promise((resolve) => setTimeout(resolve, 20))

    await expect(collect(stream)).rejects.toThrow()
  })

  it("อ่านไฟล์จากดิสก์พังกลางทางต้องส่ง error ต่อ ไม่ค้าง", async () => {
    const { meta } = encryptBytes(PLAIN, providerV1)
    const broken = new Readable({
      read() {
        this.destroy(new Error("ดิสก์อ่านไม่ได้"))
      },
    })

    await expect(collect(createDecryptStream(broken, meta, providerV1))).rejects.toThrow(
      /ดิสก์อ่านไม่ได้/,
    )
  })
})

describe("EnvKeyProvider — การหมุนกุญแจ", () => {
  it("ของใหม่ wrap ด้วยรุ่นล่าสุด", () => {
    expect(providerV2.currentKeyVersion()).toBe(2)
    expect(encryptBytes(PLAIN, providerV2).meta.keyVersion).toBe(2)
  })

  it("ไฟล์ที่เข้ารหัสด้วยรุ่นเก่ายังถอดได้ ตราบใดที่ยังเก็บกุญแจรุ่นนั้นไว้", () => {
    const { ciphertext, meta } = encryptBytes(PLAIN, providerV1)

    expect(meta.keyVersion).toBe(1)
    expect(decryptBytes(ciphertext, meta, providerV2).equals(PLAIN)).toBe(true)
  })

  it("ถอดกุญแจรุ่นที่ถูกถอดออกจาก env แล้วต้องบอกให้ชัดว่าเพราะอะไร", () => {
    const { ciphertext, meta } = encryptBytes(PLAIN, providerV1)

    expect(() => decryptBytes(ciphertext, meta, providerOnlyV2)).toThrow(
      /ไม่มี Master Key รุ่นที่ 1/,
    )
  })
})

describe("EnvKeyProvider — ค่าใน env ที่ผิด", () => {
  it("ไม่ได้ตั้งกุญแจเลย", () => {
    expect(() => new EnvKeyProvider("   ").currentKeyVersion()).toThrow(/ยังไม่ได้ตั้ง/)
  })

  it("กุญแจสั้นไม่ถึง 32 ไบต์", () => {
    expect(() =>
      new EnvKeyProvider(randomBytes(16).toString("base64")).currentKeyVersion(),
    ).toThrow(/ต้องยาว 32 ไบต์/)
  })

  it("รุ่นซ้ำกัน", () => {
    expect(() => new EnvKeyProvider(`1:${KEY_A},1:${KEY_B}`).currentKeyVersion()).toThrow(/ซ้ำกัน/)
  })

  it("รุ่นไม่ใช่จำนวนเต็มบวก", () => {
    expect(() => new EnvKeyProvider(`0:${KEY_A}`).currentKeyVersion()).toThrow(/จำนวนเต็ม/)
  })

  it("DEK ที่ยาวผิดต้องถูกปฏิเสธตั้งแต่ต้น", () => {
    expect(() => providerV1.wrapDek(randomBytes(16))).toThrow(/DEK ต้องยาว 32 ไบต์/)
  })

  it("encryptedDek ที่ถูกแก้รูปแบบต้องถูกปฏิเสธ", () => {
    expect(() => providerV1.unwrapDek({ encryptedDek: "ขยะ", keyVersion: 1 })).toThrow(
      /ไม่ถูกรูปแบบ/,
    )
  })
})
