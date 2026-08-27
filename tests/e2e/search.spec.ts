import { expect, test } from "@playwright/test"

import { REGISTER_REPORT, SEARCH } from "@/constants/ui"
import { SEARCH_FILTER_DEFAULTS, registerFilterDefaults } from "@/constants/filters"

// ตัวกรองของหน้าค้นหาขั้นสูง (spec §10.1)
//
// ⚠️ ชุดนี้เกิดจากบั๊กจริงที่ผู้ดูแลเจอจากการใช้งาน (26 ส.ค. 2569) —
// กด "ล้างเงื่อนไข" แล้ว URL เปลี่ยนเป็น /search เปล่า ๆ และช่องข้อความว่างจริง
// แต่ **`<select>` ทุกตัวยังค้างค่าเดิม** เพราะ `defaultValue` มีผลแค่ตอน mount ครั้งแรก
// ส่วนการเปลี่ยนหน้าแบบ client-side ใช้ DOM ก้อนเดิมต่อ
//
// เป็นบั๊กที่ integration test มองไม่เห็นเลย เพราะฝั่ง server คืนค่าถูกมาตลอด
// ผิดเฉพาะสิ่งที่ค้างอยู่บนหน้าจอเท่านั้น

/**
 * ป้ายกำกับของแต่ละช่อง เทียบกับชื่อคีย์ใน `SEARCH_FILTER_DEFAULTS`
 *
 * ⚠️ ต้องครบทุกคีย์ — ชนิดของ Record บังคับไว้แล้ว ถ้าวันหลังเพิ่มช่องใหม่
 * เข้าไปในค่าตั้งต้นแล้วลืมมาเติมที่นี่ typecheck จะแดงทันที ไม่ใช่ปล่อยให้
 * ช่องใหม่ไม่มีใครตรวจว่ากดล้างแล้วกลับมาถูกไหม
 */
const SEARCH_FIELD_LABELS: Record<keyof typeof SEARCH_FILTER_DEFAULTS, string> = {
  q: SEARCH.keyword,
  direction: SEARCH.direction,
  status: SEARCH.status,
  documentTypeId: SEARCH.documentType,
  ownerUnitId: SEARCH.ownerUnit,
  confidentiality: SEARCH.confidentiality,
  urgency: SEARCH.urgency,
  dateField: SEARCH.dateField,
  from: SEARCH.from,
  to: SEARCH.to,
  hasAttachment: SEARCH.hasAttachment,
  sort: SEARCH.sort,
}

/** ใส่เงื่อนไขหลายชนิดแล้วกดค้นหา — เลือกให้ต่างจากค่าตั้งต้นทุกช่องที่เลือกได้ */
async function searchWithFilters(page: import("@playwright/test").Page) {
  await page.goto("/search")

  await page.getByLabel(SEARCH.keyword).fill("อบรม")
  await page.getByLabel(SEARCH.direction).selectOption("INTERNAL")
  await page.getByLabel(SEARCH.status).selectOption("DRAFT")
  await page.getByLabel(SEARCH.confidentiality).selectOption("0")
  await page.getByLabel(SEARCH.urgency).selectOption("0")
  await page.getByLabel(SEARCH.dateField).selectOption("createdAt")
  await page.getByLabel(SEARCH.from).fill("2026-01-01")
  await page.getByLabel(SEARCH.to).fill("2026-12-31")
  await page.getByLabel(SEARCH.hasAttachment).check()
  await page.getByLabel(SEARCH.sort).selectOption("oldest")

  await page.getByRole("button", { name: SEARCH.submit }).click()
  await page.waitForURL(/\/search\?/)
}

test("กดล้างเงื่อนไขแล้วทุกช่องต้องกลับเป็นค่าตั้งต้น ไม่ใช่ค่าว่าง", async ({ page }) => {
  await searchWithFilters(page)

  // ยืนยันก่อนว่าค่าติดอยู่จริง ไม่งั้นเคสนี้จะผ่านแบบไม่ได้ทดสอบอะไร
  await expect(page.getByLabel(SEARCH.direction)).toHaveValue("INTERNAL")
  await expect(page.getByLabel(SEARCH.sort)).toHaveValue("oldest")

  await page.getByRole("link", { name: SEARCH.reset }).click()
  await expect(page).toHaveURL(/\/search$/)

  // ไล่เทียบทุกช่องกับ SEARCH_FILTER_DEFAULTS ตัวจริงที่หน้าเพจใช้ ไม่ใช่ค่าที่พิมพ์ซ้ำในเทสต์
  //
  // ⚠️ "กลับเป็นค่าตั้งต้น" ไม่เท่ากับ "ล้างเป็นค่าว่าง" — `sort` ต้องเป็น latest
  // และ `dateField` ต้องเป็น docDate · ถ้าวันหลังมีใครทำให้สองช่องนี้ว่าง
  // ฟอร์มจะส่งค่าที่ service ไม่รู้จักไปโดยที่หน้าจอดู "สะอาดดี"
  for (const [field, label] of Object.entries(SEARCH_FIELD_LABELS)) {
    const expected = SEARCH_FILTER_DEFAULTS[field as keyof typeof SEARCH_FILTER_DEFAULTS]

    if (typeof expected === "boolean") {
      await expect(page.getByLabel(label), label).toBeChecked({ checked: expected })
    } else {
      await expect(page.getByLabel(label), label).toHaveValue(expected)
    }
  }
})

test("กดปุ่ม back ของเบราว์เซอร์แล้วตัวกรองต้องตรงกับ URL ที่ย้อนไป", async ({ page }) => {
  await searchWithFilters(page)

  await page.getByRole("link", { name: SEARCH.reset }).click()
  await expect(page).toHaveURL(/\/search$/)

  // ย้อนกลับไปหน้าที่มีเงื่อนไข — ตัวกรองต้องกลับมาด้วย ไม่ใช่ค้างว่างอยู่
  await page.goBack()
  await expect(page).toHaveURL(/\/search\?/)

  await expect(page.getByLabel(SEARCH.keyword)).toHaveValue("อบรม")
  await expect(page.getByLabel(SEARCH.direction)).toHaveValue("INTERNAL")
})

// ── การจัดวางของการ์ดตัวกรอง (ผู้ดูแลกำหนด · docs/sample_v6.png) ──────────

test("ช่อง ตั้งแต่ กับ ถึง ต้องอยู่แถวเดียวกัน ไม่ใช่คนละแถว", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/search")

  const from = await page.getByLabel(SEARCH.from).boundingBox()
  const to = await page.getByLabel(SEARCH.to).boundingBox()

  // ⚠️ ของเดิม "ตั้งแต่" อยู่ท้ายแถวหนึ่ง ส่วน "ถึง" ไปโดดอยู่อีกแถว ทั้งที่เป็นช่วงเดียวกัน
  // เคสนี้ล็อกว่าทั้งคู่ต้องนั่งแถวเดียวกันเสมอ และ "ตั้งแต่" ต้องอยู่ซ้ายของ "ถึง"
  expect(from, "ไม่พบช่องตั้งแต่").toBeTruthy()
  expect(to, "ไม่พบช่องถึง").toBeTruthy()
  expect(Math.abs(from!.y - to!.y), "ตั้งแต่กับถึงต้องอยู่แถวเดียวกัน").toBeLessThan(4)
  expect(from!.x).toBeLessThan(to!.x)
})

const SEARCH_SIZES = [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]

for (const size of SEARCH_SIZES) {
  test(`เปิดหน้าค้นหาครั้งแรกต้องไม่มีแถบเลื่อนที่ ${size.width}×${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await page.goto("/search")
    await expect(page.getByRole("heading", { name: SEARCH.title, level: 1 })).toBeVisible()

    // ⚠️ "ครั้งแรก" คือยังไม่ใส่เงื่อนไข จึงยังไม่มีตารางผลลัพธ์ — พอค้นแล้วมีผล
    // หน้าย่อมยาวเกินจอเป็นเรื่องปกติ เคสนี้จึงห้ามใส่เงื่อนไขใด ๆ ก่อนวัด
    const overflow = await page.evaluate(
      () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
    )

    expect(overflow, "หน้าค้นหาตอนเปิดครั้งแรกต้องไม่มีแถบเลื่อน").toBeLessThanOrEqual(0)
  })
}

// ── หน้าทะเบียนหนังสือใช้ฟอร์มคนละตัวแต่เป็นแบบแผนเดียวกัน ────────────────
//
// ⚠️ ของหน้านี้อันตรายกว่า เพราะปุ่มดาวน์โหลดพก query จาก URL ไปทั้งชุด
// ถ้าตัวกรองบนจอไม่ตรงกับ URL ผู้ใช้จะเห็นเงื่อนไขชุดหนึ่งแต่ได้ไฟล์ของอีกชุดหนึ่ง

test("ทะเบียนหนังสือ: กดล้างเงื่อนไขแล้วทุกช่องต้องกลับเป็นค่าตั้งต้น", async ({ page }) => {
  await page.goto("/reports/register")

  // ปีตั้งต้นคือ "ปีล่าสุดที่เลือกได้" — อ่านจากตัวเลือกจริงบนหน้า ไม่ใช่คำนวณซ้ำในเทสต์
  const years = await page.getByLabel(REGISTER_REPORT.year).locator("option").allTextContents()
  const defaults = registerFilterDefaults(years.map(Number))

  await page.getByLabel(REGISTER_REPORT.book).selectOption("incoming")
  await page.getByLabel(REGISTER_REPORT.year).selectOption(String(Number(defaults.year) - 1))
  await page.getByLabel(REGISTER_REPORT.from).fill("2026-01-01")
  await page.getByLabel(REGISTER_REPORT.to).fill("2026-12-31")

  await page.getByRole("button", { name: REGISTER_REPORT.submit }).click()
  await page.waitForURL(/\/reports\/register\?/)

  await expect(page.getByLabel(REGISTER_REPORT.book)).toHaveValue("incoming")

  await page.getByRole("link", { name: REGISTER_REPORT.reset }).click()
  await expect(page).toHaveURL(/\/reports\/register$/)

  // ⚠️ เล่มทะเบียนกับปีต้องมีค่าเสมอ ล้างเป็นค่าว่างไม่ได้ — ทะเบียนหนังสือ
  // ไม่มีสภาพ "ไม่เลือกเล่ม" ให้แสดง และปุ่มดาวน์โหลดพก query ชุดนี้ไปทั้งชุด
  await expect(page.getByLabel(REGISTER_REPORT.book)).toHaveValue(defaults.book)
  await expect(page.getByLabel(REGISTER_REPORT.year)).toHaveValue(defaults.year)
  await expect(page.getByLabel(REGISTER_REPORT.orgUnit)).toHaveValue(defaults.orgUnitId)
  await expect(page.getByLabel(REGISTER_REPORT.documentType)).toHaveValue(defaults.documentTypeId)
  await expect(page.getByLabel(REGISTER_REPORT.from)).toHaveValue(defaults.from)
  await expect(page.getByLabel(REGISTER_REPORT.to)).toHaveValue(defaults.to)
})
