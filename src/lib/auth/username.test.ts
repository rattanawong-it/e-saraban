import { describe, expect, it } from "vitest"

import { usernameCandidate, usernameFromEmail } from "./username"

describe("usernameFromEmail", () => {
  it("ใช้ส่วนหน้า @ ของอีเมลเป็นชื่อผู้ใช้", () => {
    expect(usernameFromEmail("rattana.wong@krirk.ac.th")).toBe("rattana.wong")
  })

  it("แปลงเป็นตัวพิมพ์เล็กและตัดช่องว่างหัวท้าย", () => {
    expect(usernameFromEmail("  Rattana.WONG@krirk.ac.th ")).toBe("rattana.wong")
  })

  it("แทนอักขระที่ usernameSchema ไม่รับด้วยจุด แล้วยุบจุดที่ติดกัน", () => {
    expect(usernameFromEmail("rattana wong@krirk.ac.th")).toBe("rattana.wong")
    expect(usernameFromEmail("rattana+งาน@krirk.ac.th")).toBe("rattana")
  })

  it("ตัดจุด ขีดล่าง ขีดกลาง ที่ค้างอยู่หัวท้าย", () => {
    expect(usernameFromEmail("_rattana._@krirk.ac.th")).toBe("rattana")
  })

  it("ต่อ .user ให้เมื่อสั้นกว่า 3 ตัวอักษร", () => {
    expect(usernameFromEmail("ab@krirk.ac.th")).toBe("ab.user")
  })

  it("คืน user เมื่ออีเมลไม่เหลืออักขระที่ใช้ได้เลย", () => {
    expect(usernameFromEmail("รัตนา@krirk.ac.th")).toBe("user")
  })

  it("ไม่ยาวเกินความยาวที่ usernameSchema รับได้", () => {
    expect(usernameFromEmail(`${"a".repeat(80)}@krirk.ac.th`)).toHaveLength(45)
  })
})

describe("usernameCandidate", () => {
  it("ลำดับแรกไม่มีเลขต่อท้าย", () => {
    expect(usernameCandidate("rattana.wong", 0)).toBe("rattana.wong")
  })

  it("ลำดับถัดไปต่อท้ายด้วยเลขเรียงจาก 2", () => {
    expect(usernameCandidate("rattana.wong", 1)).toBe("rattana.wong2")
    expect(usernameCandidate("rattana.wong", 2)).toBe("rattana.wong3")
  })
})
