import { describe, expect, it } from "vitest"

import { hashPassword, verifyPassword } from "./password"

// พฤติกรรมของการตรวจรหัสผ่านเมื่อบัญชี "ไม่มีรหัสผ่าน" (D19 · spec §17.3)
//
// บัญชีที่เข้าด้วย Google อย่างเดียวมี passwordHash เป็น null ได้ตั้งแต่ P5 —
// ชุดนี้เฝ้าไว้ว่าการล็อกอินด้วยรหัสผ่านกับบัญชีแบบนั้นต้อง "เหมือนกรอกรหัสผิด"
// ทุกประการ ไม่ใช่พังหรือผ่าน

describe("verifyPassword", () => {
  it("บัญชีที่ไม่มีรหัสผ่าน ตรวจไม่ผ่านเสมอ", async () => {
    expect(await verifyPassword(null, "รหัสผ่านอะไรก็ตาม")).toBe(false)
  })

  it("hash ที่เสียหาย ตรวจไม่ผ่านโดยไม่โยน error", async () => {
    expect(await verifyPassword("ไม่ใช่ hash ของ argon2", "password1234")).toBe(false)
  })

  it("รหัสผ่านที่ถูกต้องยังตรวจผ่านตามปกติ", async () => {
    const hash = await hashPassword("ทดสอบ-Password-1234")

    expect(await verifyPassword(hash, "ทดสอบ-Password-1234")).toBe(true)
    expect(await verifyPassword(hash, "ทดสอบ-Password-1235")).toBe(false)
  })

  it("ใช้เวลาใกล้เคียงกับการตรวจปกติเมื่อไม่มีรหัสผ่าน — ไม่งั้นเวลาตอบจะบอกว่าบัญชีไหนผูก Google", async () => {
    const hash = await hashPassword("ทดสอบ-Password-1234")

    const startReal = performance.now()
    await verifyPassword(hash, "ผิดแน่นอน")
    const realMs = performance.now() - startReal

    const startNull = performance.now()
    await verifyPassword(null, "ผิดแน่นอน")
    const nullMs = performance.now() - startNull

    // เทียบแบบหลวม ๆ โดยตั้งใจ — เครื่อง CI ช้าไม่เท่ากันทุกครั้ง
    // ที่ต้องกันคือกรณีที่คืน false ทันทีโดยไม่ hash ซึ่งจะเร็วกว่ากันหลายสิบเท่า
    expect(nullMs).toBeGreaterThan(realMs / 5)
  })
})
