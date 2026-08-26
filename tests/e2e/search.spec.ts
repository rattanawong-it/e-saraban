import { expect, test } from "@playwright/test"

import { REGISTER_REPORT, SEARCH } from "@/constants/ui"

// ตัวกรองของหน้าค้นหาขั้นสูง (spec §10.1)
//
// ⚠️ ชุดนี้เกิดจากบั๊กจริงที่ผู้ดูแลเจอจากการใช้งาน (26 ส.ค. 2569) —
// กด "ล้างเงื่อนไข" แล้ว URL เปลี่ยนเป็น /search เปล่า ๆ และช่องข้อความว่างจริง
// แต่ **`<select>` ทุกตัวยังค้างค่าเดิม** เพราะ `defaultValue` มีผลแค่ตอน mount ครั้งแรก
// ส่วนการเปลี่ยนหน้าแบบ client-side ใช้ DOM ก้อนเดิมต่อ
//
// เป็นบั๊กที่ integration test มองไม่เห็นเลย เพราะฝั่ง server คืนค่าถูกมาตลอด
// ผิดเฉพาะสิ่งที่ค้างอยู่บนหน้าจอเท่านั้น

/** ใส่เงื่อนไขหลายชนิดแล้วกดค้นหา — คืนค่าที่กรอกไว้เพื่อเอาไปเทียบ */
async function searchWithFilters(page: import("@playwright/test").Page) {
  await page.goto("/search")

  await page.getByLabel(SEARCH.keyword).fill("อบรม")
  await page.getByLabel(SEARCH.direction).selectOption("INTERNAL")
  await page.getByLabel(SEARCH.sort).selectOption("oldest")

  await page.getByRole("button", { name: SEARCH.submit }).click()
  await page.waitForURL(/\/search\?/)
}

test("กดล้างเงื่อนไขแล้วทุกช่องต้องกลับเป็นค่าเริ่มต้น ไม่ใช่แค่ URL", async ({ page }) => {
  await searchWithFilters(page)

  // ยืนยันก่อนว่าค่าติดอยู่จริง ไม่งั้นเคสนี้จะผ่านแบบไม่ได้ทดสอบอะไร
  await expect(page.getByLabel(SEARCH.direction)).toHaveValue("INTERNAL")

  await page.getByRole("link", { name: SEARCH.reset }).click()
  await expect(page).toHaveURL(/\/search$/)

  await expect(page.getByLabel(SEARCH.keyword)).toHaveValue("")
  // ⚠️ สองบรรทัดนี้คือตัวที่แดงตอนบั๊กยังอยู่ — ช่องข้อความล้างได้แต่ select ไม่ล้าง
  await expect(page.getByLabel(SEARCH.direction)).toHaveValue("")
  await expect(page.getByLabel(SEARCH.sort)).toHaveValue("latest")
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

// ── หน้าทะเบียนหนังสือใช้ฟอร์มคนละตัวแต่เป็นแบบแผนเดียวกัน ────────────────
//
// ⚠️ ของหน้านี้อันตรายกว่า เพราะปุ่มดาวน์โหลดพก query จาก URL ไปทั้งชุด
// ถ้าตัวกรองบนจอไม่ตรงกับ URL ผู้ใช้จะเห็นเงื่อนไขชุดหนึ่งแต่ได้ไฟล์ของอีกชุดหนึ่ง

test("ทะเบียนหนังสือ: กดล้างเงื่อนไขแล้วเล่มทะเบียนต้องกลับเป็นค่าเริ่มต้น", async ({ page }) => {
  await page.goto("/reports/register")

  await page.getByLabel(REGISTER_REPORT.book).selectOption("incoming")
  await page.getByRole("button", { name: REGISTER_REPORT.submit }).click()
  await page.waitForURL(/\/reports\/register\?/)

  await expect(page.getByLabel(REGISTER_REPORT.book)).toHaveValue("incoming")

  await page.getByRole("link", { name: REGISTER_REPORT.reset }).click()
  await expect(page).toHaveURL(/\/reports\/register$/)

  // เดิมค้างเป็น incoming ทั้งที่ URL ว่างแล้ว
  await expect(page.getByLabel(REGISTER_REPORT.book)).toHaveValue("outgoing")
})
