import { expect, test } from "@playwright/test"

import { HELP, HELP_NAV_LABEL } from "@/constants/help"

// คู่มือผู้ใช้ในระบบ (spec §13 — P5)
//
// คู่มือคือหน้าที่ผู้ใช้เปิดตอนกำลังติดปัญหาอยู่ ถ้ามันพังด้วยก็ไม่เหลืออะไรให้พึ่ง
// จึงเขียนเป็น Server Component ล้วนไม่มี JS ฝั่ง client และเคสชุดนี้เฝ้าสามอย่าง:
// เข้าถึงได้ · สารบัญพาไปถูกที่ · หมวดที่ต้องเห็นตามสิทธิ์ยังอยู่ครบ

test("เข้าคู่มือได้จากเมนูโปรไฟล์", async ({ page }) => {
  await page.goto("/dashboard")

  // ปุ่มโปรไฟล์เป็นตัวอักษรย่อของชื่อผู้ใช้ ไม่มีข้อความคงที่ให้จับ
  // จึงจับจาก aria-haspopup แล้วเอาตัวท้ายสุด (กระดิ่งเป็นอีกตัวที่มี attribute เดียวกัน)
  await page.locator('button[aria-haspopup="menu"]').last().click()

  const link = page.getByRole("menuitem", { name: HELP_NAV_LABEL })
  await expect(link).toBeVisible()

  await link.click()
  await page.waitForURL("**/help")
  await expect(page.getByRole("heading", { name: HELP.title, level: 1 })).toBeVisible()
})

test("สารบัญพาไปยังหมวดที่กดจริง", async ({ page }) => {
  await page.goto("/help")

  const toc = page.getByRole("navigation", { name: HELP.tocTitle })
  const links = toc.getByRole("link")

  await expect(links.first()).toBeVisible()
  const count = await links.count()
  expect(count).toBeGreaterThan(3)

  // ทุกข้อในสารบัญต้องมีหมวดจริงรออยู่ ไม่ใช่ลิงก์ที่กดแล้วไม่ไปไหน
  for (let index = 0; index < count; index += 1) {
    const href = await links.nth(index).getAttribute("href")
    expect(href).toMatch(/^#/)
    await expect(page.locator(href ?? "")).toHaveCount(1)
  }
})

test("สารบรรณเห็นหมวดออกเลขทะเบียน พร้อมคำเตือนที่ถอนคืนไม่ได้", async ({ page }) => {
  await page.goto("/help")

  const section = page.locator("#number")
  await expect(section).toBeVisible()

  // ⚠️ ประโยคนี้คือสิ่งที่กันผู้ใช้ใหม่กดออกเลขมั่ว — ถ้าหายไปจากคู่มือต้องรู้
  await expect(section.getByText(/ถอนคืนไม่ได้/)).toBeVisible()
})
