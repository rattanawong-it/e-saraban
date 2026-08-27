import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

// ด่านกันโทเคนของธีมหลุด — อ่านไฟล์ CSS ตรง ๆ เพราะสองเรื่องนี้ไม่มีทางจับได้
// ด้วย typecheck หรือ eslint และ e2e ก็ไม่เห็น เพราะหน้าเปิดได้ปกติไม่มี error
// ผิดแค่ "หน้าตา" ซึ่งมีแต่ตาคนที่จับได้ — ทั้งสองข้อเป็นบั๊กจริงที่ผู้ดูแลเจอเอง

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8")

describe("โทเคนของธีม", () => {
  it("ฟอนต์ตัวเลขต้องมี Anuphan ต่อท้าย Inter เสมอ", () => {
    const line = css.split("\n").find((row) => row.trim().startsWith("--font-num:"))

    expect(line, "ไม่พบโทเคน --font-num").toBeDefined()

    // ⚠️ Inter ไม่มีตัวอักษรไทย · ถ้าไม่มี Anuphan ต่อท้าย ข้อความไทยในองค์ประกอบ
    // ที่ใช้คลาส .tabular จะตกไปใช้ฟอนต์ของเครื่อง ซึ่งเป็นคนละแบบกับทั้งระบบ
    // (ผู้ดูแลจับได้ที่บรรทัด "ทุกหน่วยงาน · 1 รายการ" ของหน้าทะเบียน)
    expect(line).toContain("var(--font-inter)")
    expect(line).toContain("var(--font-anuphan)")
    expect(line!.indexOf("--font-inter")).toBeLessThan(line!.indexOf("--font-anuphan"))
  })

  it("ขั้นตัวอักษรต้องครบทั้งแปดขั้นตาม Design System §02", () => {
    const steps = ["display", "title-l", "title", "body", "section", "label", "caption", "micro"]

    for (const step of steps) {
      expect(css, `ขาดขั้น --text-${step}`).toContain(`--text-${step}:`)
    }
  })
})
