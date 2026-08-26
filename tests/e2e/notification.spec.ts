import { expect, test } from "@playwright/test"

import { NOTIFICATION_UI } from "@/constants/notification"
import { HEADER } from "@/constants/ui"

import { E2E_NOTIFICATION } from "./fixtures/constants"

// กระดิ่งแจ้งเตือน (D10 · spec §11.2)
//
// ⚠️ เคสที่สำคัญที่สุดในไฟล์นี้คือ "แถวที่ชี้ไปยังเอกสารที่เปิดไม่ได้ต้องไม่โผล่"
// เพราะการแจ้งเตือนถูกอ่านโดย**ไม่ผ่านด่าน can() ของเอกสาร** ถ้าด่านกรองหลุดเมื่อไหร่
// กระดิ่งจะกลายเป็นช่องรั่วช่องใหม่ที่มีชื่อเรื่องของเอกสารลับติดมาด้วย (บทเรียน §22.2)
//
// ข้อมูลตัวอย่างมาจาก tests/e2e/fixtures/db-fixture.ts ตอน globalSetup

test("กระดิ่งแสดงจำนวนที่ยังไม่อ่าน และเปิดแผงได้", async ({ page }) => {
  await page.goto("/dashboard")

  const bell = page.getByRole("button", { name: HEADER.notifications })

  // เคยเป็นปุ่ม disabled ตั้งแต่ P2 — ถ้ากลับไปเป็นแบบนั้นอีกต้องรู้ทันที
  await expect(bell).toBeEnabled()
  await expect(bell).toContainText(/\d+/)

  await bell.click()

  const panel = page.getByRole("menu").filter({ hasText: NOTIFICATION_UI.panelTitle })
  await expect(panel).toBeVisible()
  await expect(panel.getByText(E2E_NOTIFICATION.visible)).toBeVisible()
})

test("⚠️ แจ้งเตือนที่ชี้ไปยังเอกสารที่เปิดไม่ได้ ต้องไม่โผล่บนกระดิ่ง", async ({ page }) => {
  await page.goto("/dashboard")

  await page.getByRole("button", { name: HEADER.notifications }).click()

  const panel = page.getByRole("menu").filter({ hasText: NOTIFICATION_UI.panelTitle })
  await expect(panel).toBeVisible()

  // แถวนี้มีอยู่จริงในตาราง `notifications` และเป็นของผู้ใช้คนนี้
  // แต่เอกสารที่มันอ้างถึงไม่มีอยู่ — ด่านการมองเห็นต้องตัดทิ้งก่อนถึงหน้าจอ
  await expect(panel.getByText(E2E_NOTIFICATION.orphan)).toHaveCount(0)
})

test("หน้า /notifications แสดงรายการเดียวกันและกรองด้วยด่านเดียวกัน", async ({ page }) => {
  await page.goto("/notifications")

  await expect(
    page.getByRole("heading", { name: NOTIFICATION_UI.pageTitle, level: 1 }),
  ).toBeVisible()

  await expect(page.getByText(E2E_NOTIFICATION.visible)).toBeVisible()
  await expect(page.getByText(E2E_NOTIFICATION.orphan)).toHaveCount(0)
})

test("กดอ่านทั้งหมดแล้ว ตัวเลขบนกระดิ่งต้องหายและไม่กลับมาหลังรีโหลด", async ({ page }) => {
  await page.goto("/dashboard")

  const bell = page.getByRole("button", { name: HEADER.notifications })
  await bell.click()

  await page.getByRole("button", { name: NOTIFICATION_UI.markAllRead }).click()

  // ต้องหายจากหน้าจอทันที
  await expect(bell).not.toContainText(/\d/, { timeout: 15_000 })

  // และต้องหายจริงในฐานข้อมูล ไม่ใช่แค่ state ฝั่ง client
  await page.reload()
  await expect(bell).not.toContainText(/\d/)
})
