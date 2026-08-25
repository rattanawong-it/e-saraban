import { describe, expect, it } from "vitest"

import {
  DEFAULT_NUMBER_PATTERN,
  previewDocNumber,
  renderDocNumber,
  resolveNumberYear,
  validateNumberPattern,
} from "./doc-number"

const BASE = {
  unitCode: "510000",
  unitShort: "บธ.",
  seq: 451,
  year: 2569,
  docType: "คำสั่ง",
  bookCode: "MAIN",
}

describe("renderDocNumber", () => {
  it("ค่าปริยายตาม D16 ให้ผลเป็น รหัสหน่วยงาน/ลำดับ 4 หลัก", () => {
    expect(renderDocNumber(DEFAULT_NUMBER_PATTERN, BASE)).toBe("510000/0451")
  })

  it("เติมศูนย์ตามจำนวนหลักที่สั่ง", () => {
    expect(renderDocNumber("{seq:4}", { ...BASE, seq: 7 })).toBe("0007")
    expect(renderDocNumber("{seq:6}", { ...BASE, seq: 7 })).toBe("000007")
  })

  it("ไม่เติมศูนย์เมื่อไม่ได้ระบุจำนวนหลัก", () => {
    expect(renderDocNumber("{seq}", { ...BASE, seq: 7 })).toBe("7")
  })

  it("เลขที่ยาวกว่าจำนวนหลักต้องไม่ถูกตัด — ตัดแล้วเลขจะซ้ำกัน", () => {
    expect(renderDocNumber("{seq:4}", { ...BASE, seq: 12345 })).toBe("12345")
  })

  it("รองรับ token ครบทุกตัว", () => {
    expect(renderDocNumber("{unitShort} {seq:4}/{year}", BASE)).toBe("บธ. 0451/2569")
    expect(renderDocNumber("{docType} ที่ {seq}/{yearShort}", BASE)).toBe("คำสั่ง ที่ 451/69")
    expect(renderDocNumber("{bookCode}-{unitCode}", BASE)).toBe("MAIN-510000")
  })

  it("ไม่มีชื่อย่อ → ใช้รหัสหน่วยงานแทน ไม่ปล่อยให้เลขมีช่องว่าง", () => {
    expect(renderDocNumber("{unitShort}/{seq:4}", { ...BASE, unitShort: null })).toBe("510000/0451")
    expect(renderDocNumber("{unitShort}/{seq:4}", { ...BASE, unitShort: "  " })).toBe("510000/0451")
  })

  it("เก็บข้อความไทยที่คั่นระหว่าง token ไว้ตามเดิม", () => {
    expect(renderDocNumber("ที่ {unitCode}/{seq:4} ลงวันที่", BASE)).toBe(
      "ที่ 510000/0451 ลงวันที่",
    )
  })

  it("โยน error ทันทีเมื่อเจอ token ที่ไม่รู้จัก", () => {
    expect(() => renderDocNumber("{unitCode}/{running}", BASE)).toThrowError(/running/)
  })

  it("previewDocNumber ใช้ค่าตัวอย่างชุดเดียวกับที่หน้าตั้งค่าโชว์", () => {
    expect(previewDocNumber(DEFAULT_NUMBER_PATTERN)).toBe("510000/0451")
  })
})

describe("validateNumberPattern", () => {
  it("รูปแบบที่ถูกต้องไม่มีข้อทักท้วง", () => {
    expect(validateNumberPattern(DEFAULT_NUMBER_PATTERN)).toEqual([])
    expect(validateNumberPattern("รับ {seq}/{year}")).toEqual([])
  })

  it("ต้องมี {seq} ไม่งั้นทุกฉบับจะได้เลขเดียวกัน", () => {
    const issues = validateNumberPattern("{unitCode}/{year}")
    expect(issues.map((issue) => issue.code)).toContain("NO_SEQ")
  })

  it("จับ token ที่ไม่รู้จัก", () => {
    const issues = validateNumberPattern("{unitCode}/{seq:4}/{running}")
    expect(issues[0]?.code).toBe("UNKNOWN_TOKEN")
    expect(issues[0]?.message).toContain("{running}")
  })

  it("จำนวนหลักต้องอยู่ในช่วง 1–9", () => {
    expect(validateNumberPattern("{seq:0}").map((issue) => issue.code)).toContain("BAD_PAD")
    expect(validateNumberPattern("{seq:12}").map((issue) => issue.code)).toContain("BAD_PAD")
  })

  it("จับวงเล็บที่พิมพ์ตก", () => {
    expect(validateNumberPattern("{unitCode/{seq:4}").map((issue) => issue.code)).toContain(
      "STRAY_BRACE",
    )
  })

  it("รูปแบบว่างเปล่า", () => {
    expect(validateNumberPattern("   ")[0]?.code).toBe("EMPTY")
  })
})

describe("resolveNumberYear", () => {
  // 2026-08-25 = 25 ส.ค. 2569 · 2026-10-15 = 15 ต.ค. 2569
  const august = new Date("2026-08-25T03:00:00.000Z")
  const october = new Date("2026-10-15T03:00:00.000Z")

  it("ปีปฏิทินใช้ปี พ.ศ. ของวันที่นั้นตรง ๆ", () => {
    expect(resolveNumberYear("CALENDAR", august)).toBe(2569)
    expect(resolveNumberYear("CALENDAR", october)).toBe(2569)
  })

  it("ปีงบประมาณ: ตั้งแต่ 1 ต.ค. นับเป็นปีถัดไป", () => {
    expect(resolveNumberYear("FISCAL", august)).toBe(2569)
    expect(resolveNumberYear("FISCAL", october)).toBe(2570)
  })

  it("ใช้เวลาไทยเสมอ ไม่พึ่ง timezone ของเครื่อง", () => {
    // 30 ก.ย. 2569 เวลา 23:30 น. ที่ไทย = 16:30 UTC — ยังเป็นปีงบ 2569 อยู่
    const lastMomentOfFiscalYear = new Date("2026-09-30T16:30:00.000Z")
    expect(resolveNumberYear("FISCAL", lastMomentOfFiscalYear)).toBe(2569)

    // อีกครึ่งชั่วโมงถัดมา (00:00 น. 1 ต.ค. ที่ไทย) ต้องข้ามไปปีงบ 2570
    const firstMomentOfNextFiscalYear = new Date("2026-09-30T17:00:00.000Z")
    expect(resolveNumberYear("FISCAL", firstMomentOfNextFiscalYear)).toBe(2570)
  })
})
