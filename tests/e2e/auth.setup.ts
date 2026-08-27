import path from "node:path"

import { expect, test as setup } from "@playwright/test"

import {
  E2E_ADMIN_PASSWORD,
  E2E_ADMIN_USERNAME,
  E2E_PASSWORD,
  E2E_USERNAME,
} from "./fixtures/constants"

const STATE_FILE = path.join(__dirname, ".auth", "state.json")
const ADMIN_STATE_FILE = path.join(__dirname, ".auth", "state-admin.json")

// ล็อกอินครั้งเดียวต่อการรันหนึ่งรอบ แล้วแชร์คุกกี้ให้ทุกเคส
//
// ⚠️ ไม่ให้แต่ละเคสล็อกอินเอง เพราะหน้าล็อกอินมี rate limit ต่อ IP (§8.4)
// เทสต์สิบเคสที่ล็อกอินคนละครั้งจะโดนล็อกเองแล้วแดงทั้งชุดโดยที่โค้ดไม่ได้ผิดอะไร

setup("ล็อกอินและเก็บ session ไว้ใช้ทุกเคส", async ({ page }) => {
  await page.goto("/login")

  await page.getByLabel("ชื่อผู้ใช้หรืออีเมล").fill(E2E_USERNAME)
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click()

  // ต้องถึงหน้าภาพรวมจริง ไม่ใช่ค้างที่หน้าเปลี่ยนรหัสผ่านหรือหน้าล็อกอินเดิม
  await page.waitForURL("**/dashboard", { timeout: 30_000 })
  await expect(page.getByRole("heading", { name: "ภาพรวม" })).toBeVisible()

  await page.context().storageState({ path: STATE_FILE })
})

/**
 * เซสชันที่สอง — ฝั่งผู้ดูแลระบบ ใช้เฉพาะชุดที่ต้องเปิดหน้าใต้ /admin
 *
 * ⚠️ เก็บคนละไฟล์กับเซสชันหลัก · ชุดที่ต้องใช้เรียกผ่าน `test.use({ storageState })`
 * ไม่ได้ตั้งเป็น project แยก เพราะจะทำให้เมทริกซ์ของ Playwright โตขึ้นเท่าตัว
 * ทั้งที่มีแค่ชุดเดียวที่ต้องใช้
 */
setup("ล็อกอินฝั่งผู้ดูแลและเก็บ session ไว้ให้ชุด responsive", async ({ page }) => {
  await page.goto("/login")

  await page.getByLabel("ชื่อผู้ใช้หรืออีเมล").fill(E2E_ADMIN_USERNAME)
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(E2E_ADMIN_PASSWORD)
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click()

  await page.waitForURL("**/dashboard", { timeout: 30_000 })
  await expect(page.getByRole("heading", { name: "ภาพรวม" })).toBeVisible()

  await page.context().storageState({ path: ADMIN_STATE_FILE })
})
