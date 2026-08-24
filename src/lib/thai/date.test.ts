import { describe, expect, it } from "vitest"

import {
  formatThaiDate,
  formatThaiDateTime,
  formatThaiTime,
  getBuddhistYear,
  toBuddhistYear,
  toGregorianYear,
} from "./date"

// เคสสำคัญคือ **การข้ามวันและข้ามปีเมื่อเครื่องรันด้วย TZ=UTC**
// (container รันแบบนั้น — ดู docs/progress.md §6.11)
// ถ้าโซนเวลาหลุด เอกสารที่สร้างหลัง 19:00 น. ไทย จะถูกบันทึกเป็นวันถัดไป
// และปี พ.ศ. ที่ใช้รีเซ็ตเลขทะเบียน (spec §7.2) จะเพี้ยนไปทั้งปี

describe("formatThaiDate", () => {
  it("แสดง พ.ศ. เสมอ (spec §10.2)", () => {
    const d = new Date("2026-08-22T03:00:00Z") // 22 ส.ค. 2569 10:00 น. ไทย

    expect(formatThaiDate(d, "short")).toBe("22/08/2569")
    expect(formatThaiDate(d, "medium")).toBe("22 ส.ค. 2569")
    expect(formatThaiDate(d, "long")).toBe("22 สิงหาคม 2569")
  })

  it("ใช้เวลาไทยเสมอ — 17:30 UTC คือวันถัดไปแล้ว", () => {
    const d = new Date("2026-08-22T17:30:00Z") // 23 ส.ค. 2569 00:30 น. ไทย

    expect(formatThaiDate(d, "short")).toBe("23/08/2569")
    expect(formatThaiTime(d)).toBe("00:30")
  })

  it("ข้ามปีถูกต้อง — 31 ธ.ค. 17:30 UTC คือ 1 ม.ค. ปีถัดไปตามเวลาไทย", () => {
    const d = new Date("2026-12-31T17:30:00Z")

    expect(formatThaiDate(d, "medium")).toBe("1 ม.ค. 2570")
    expect(getBuddhistYear(d)).toBe(2570)
  })

  it("formatThaiDateTime รวมวันที่กับเวลา 24 ชั่วโมง", () => {
    const d = new Date("2026-08-22T03:30:00Z")

    expect(formatThaiDateTime(d, "medium")).toContain("22 ส.ค. 2569")
    expect(formatThaiDateTime(d, "medium")).toContain("10:30")
  })

  it("รับค่าเป็น string และ epoch ได้", () => {
    expect(formatThaiDate("2026-08-22T03:00:00Z", "short")).toBe("22/08/2569")
    expect(formatThaiDate(Date.parse("2026-08-22T03:00:00Z"), "short")).toBe("22/08/2569")
  })

  it("โยน error เมื่อค่าวันที่ไม่ถูกต้อง แทนที่จะแสดง Invalid Date บนหน้าจอ", () => {
    expect(() => formatThaiDate("ไม่ใช่วันที่")).toThrow(TypeError)
  })
})

describe("การแปลงปี", () => {
  it("ค.ศ. ↔ พ.ศ. ต่างกัน 543 ปี", () => {
    expect(toBuddhistYear(2026)).toBe(2569)
    expect(toGregorianYear(2569)).toBe(2026)
  })

  it("getBuddhistYear คืนปีตามเวลาไทย", () => {
    expect(getBuddhistYear(new Date("2026-08-22T03:00:00Z"))).toBe(2569)
  })
})
