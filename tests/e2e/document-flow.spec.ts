import { expect, test, type Page } from "@playwright/test"

import { E2E_PREFIX } from "./fixtures/constants"

// เส้นทางหลักของงานสารบรรณจากต้นจนได้เลขทะเบียน — ร่าง → ส่งให้สารบรรณ → ออกเลข
//
// ⚠️ นี่คือเส้นทางที่ถ้าพังแล้วระบบใช้งานไม่ได้เลย และเป็นเส้นทางที่ integration test
// เดินผ่าน "ทีละ service" แต่ไม่เคยเดินผ่าน "ทีละหน้าจอ" — ปุ่มที่หายไป ฟอร์มที่ส่งค่าไม่ครบ
// หรือ redirect ที่พาไปผิดหน้า จะโผล่ตรงนี้เท่านั้น

test("ร่างหนังสือ → ส่งให้สารบรรณ → ออกเลขทะเบียน → เห็นในทะเบียนส่ง", async ({ page }) => {
  const subject = `${E2E_PREFIX} ขออนุมัติจัดประชุมคณะทำงาน ${Date.now()}`

  // ── 1. ร่างหนังสือ ────────────────────────────────────────────────
  await page.goto("/documents/new")

  await page.getByLabel("ชื่อเรื่อง").fill(subject)

  // เลือกประเภทหนังสือตัวแรกที่ไม่ใช่ตัวเลือกว่าง
  const typeSelect = page.getByLabel("ประเภทหนังสือ")
  const firstType = await typeSelect.locator("option").nth(1).getAttribute("value")
  await typeSelect.selectOption(firstType ?? "")

  await page.getByRole("button", { name: "บันทึกร่าง" }).click()

  // บันทึกแล้วต้องเด้งไปหน้ารายละเอียดของฉบับที่เพิ่งสร้าง
  await page.waitForURL(/\/documents\/[0-9a-f-]+$/, { timeout: 30_000 })
  // ⚠️ ต้องระบุว่าเป็นหัวข้อ ไม่ใช่ getByText เฉย ๆ — Next มี route announcer
  // (`#__next-route-announcer__`) ที่อ่านชื่อหน้าให้ screen reader หลังเปลี่ยนหน้า
  // ข้อความจึงซ้ำกันสองที่ชั่วขณะ แล้ว strict mode ของ Playwright จะแดงแบบสุ่ม
  await expect(page.getByRole("heading", { name: subject })).toBeVisible()

  const documentUrl = page.url()

  // ── 2. ส่งให้สารบรรณออกเลข ────────────────────────────────────────
  await runAction(page, "ส่งให้สารบรรณออกเลข")
  await expect(page.getByText("รอออกเลข").first()).toBeVisible({ timeout: 20_000 })

  // ── 3. ออกเลขทะเบียน ─────────────────────────────────────────────
  await page.goto(documentUrl)
  await runAction(page, "ออกเลขทะเบียน")
  await expect(page.getByText("ออกเลขแล้ว").first()).toBeVisible({ timeout: 20_000 })

  // ── 4. ต้องปรากฏในทะเบียนส่งพร้อมเลขที่ ──────────────────────────
  await page.goto("/registry/sent")

  const row = page.getByRole("row", { name: new RegExp(escapeRegex(subject)) })
  await expect(row).toBeVisible({ timeout: 20_000 })

  // เลขทะเบียนของหน่วยงาน 510000 ตามรูปแบบ {unitCode}/{seq:4} (§7.1)
  await expect(row).toContainText(/510000\/\d{4}/)
})

test("เอกสารที่ออกเลขแล้วแก้ไขไม่ได้ (§6.4)", async ({ page }) => {
  const subject = `${E2E_PREFIX} ฉบับที่ออกเลขแล้วห้ามแก้ ${Date.now()}`

  await page.goto("/documents/new")
  await page.getByLabel("ชื่อเรื่อง").fill(subject)

  const typeSelect = page.getByLabel("ประเภทหนังสือ")
  const firstType = await typeSelect.locator("option").nth(1).getAttribute("value")
  await typeSelect.selectOption(firstType ?? "")

  await page.getByRole("button", { name: "บันทึกร่าง" }).click()
  await page.waitForURL(/\/documents\/[0-9a-f-]+$/, { timeout: 30_000 })

  const documentUrl = page.url()

  await runAction(page, "ส่งให้สารบรรณออกเลข")
  await expect(page.getByText("รอออกเลข").first()).toBeVisible({ timeout: 20_000 })

  await page.goto(documentUrl)
  await runAction(page, "ออกเลขทะเบียน")
  await expect(page.getByText("ออกเลขแล้ว").first()).toBeVisible({ timeout: 20_000 })

  // เข้าหน้าแก้ไขตรง ๆ ต้องเจอคำเตือน ไม่ใช่ฟอร์มที่กรอกได้
  await page.goto(`${documentUrl}/edit`)

  await expect(page.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" })).toHaveCount(0)
  // ⚠️ เคยเป็น getByRole("alert") ซึ่ง **เขียวได้เองโดยไม่มีคำเตือนจริง** เพราะ
  // route announcer ของ Next มี role="alert" ติดมาด้วยเสมอ (ดู primitives.tsx)
  await expect(page.locator("[data-slot='alert']").first()).toBeVisible()
})

/**
 * กดปุ่มดำเนินการหนึ่งอย่างจนจบ
 *
 * แผงดำเนินการเป็นสองจังหวะโดยตั้งใจ — กดเลือกก่อนแล้วฟอร์มยืนยันจึงเปิดออกมา
 * (มีช่องหมายเหตุที่จะถูกบันทึกลงประวัติ) ผู้ใช้จึงไม่เผลอเปลี่ยนสถานะเอกสารด้วยคลิกเดียว
 */
async function runAction(page: Page, label: string) {
  await page.getByRole("button", { name: label }).click()
  await page.getByRole("button", { name: "ยืนยันการดำเนินการ" }).click()
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
