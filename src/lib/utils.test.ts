import { describe, expect, it } from "vitest"

import { cn } from "./utils"

// ⚠️ ชุดนี้เกิดจากบั๊กจริงที่ผู้ดูแลเห็นบนหน้าจอ (27 ส.ค. 2569):
// ปุ่ม "สร้างหนังสือใหม่" กลืนไปกับพื้น เพราะ tailwind-merge ไม่รู้จักขั้นตัวอักษร
// ของเรา (`text-label` ฯลฯ) เลยเดาว่าเป็น "สี" แล้วตัด `text-primary-foreground` ทิ้ง
//
// เป็นบั๊กที่ typecheck · eslint · integration test มองไม่เห็นเลย และ e2e ก็ไม่เห็น
// เพราะหน้าเปิดได้ปกติไม่มี error — ผิดแค่สีที่ตาคนเท่านั้นที่จับได้

describe("cn", () => {
  it("ขั้นตัวอักษรของเราต้องไม่ถูกนับเป็นสี — สีที่ตั้งไว้ต้องอยู่ครบ", () => {
    const result = cn("bg-primary text-primary-foreground", "text-label")

    expect(result).toContain("text-primary-foreground")
    expect(result).toContain("text-label")
  })

  it("ขั้นตัวอักษรสองตัวชนกันต้องเหลือตัวหลัง — เป็นขนาดกลุ่มเดียวกันจริง ๆ", () => {
    expect(cn("text-caption", "text-title")).toBe("text-title")
    expect(cn("text-display", "text-micro")).toBe("text-micro")
  })

  it("ยังทับสีตัวอักษรด้วยกันเองได้ตามปกติ", () => {
    expect(cn("text-text-subtle", "text-danger-text")).toBe("text-danger-text")
  })

  it("ขนาดของ Tailwind เองยังทำงานร่วมกับขั้นของเราได้", () => {
    expect(cn("text-sm", "text-body")).toBe("text-body")
    expect(cn("text-body", "text-sm")).toBe("text-sm")
  })
})
