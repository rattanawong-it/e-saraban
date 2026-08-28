import { expect, test } from "@playwright/test"

import { HELP } from "@/constants/help"
import { NOTIFICATION_UI } from "@/constants/notification"
import {
  AUDIT,
  DASHBOARD,
  DOCUMENTS,
  LOGIN,
  LOGIN_ERRORS,
  REGISTER_REPORT,
  SEARCH,
} from "@/constants/ui"

// หน้าหลักทุกหน้าต้องเปิดได้จริงโดยไม่มี error ในคอนโซล
//
// ⚠️ ชุดนี้จับสิ่งที่ integration test มองไม่เห็นเลย — หน้าเว็บที่ระเบิดตอน render
// (server component โยน error · client component พัง) ยังคืน HTTP 200 พร้อมหน้า error
// ของ Next ได้สบาย ๆ · ต้องเปิดด้วยเบราว์เซอร์จริงเท่านั้นถึงจะรู้

// อ่านชื่อหัวข้อจาก constants ที่หน้าเว็บใช้จริง ไม่ฝังข้อความซ้ำในเทสต์
// เปลี่ยนคำเรียกเมนูทีหลังแล้วเทสต์ต้องไม่แดงเพราะเรื่องนั้น
const PAGES = [
  { path: "/dashboard", heading: DASHBOARD.title },
  { path: "/inbox", heading: DOCUMENTS.inboxTitle },
  { path: "/outbox", heading: DOCUMENTS.outboxTitle },
  { path: "/drafts", heading: DOCUMENTS.draftsTitle },
  { path: "/registry/outgoing", heading: DOCUMENTS.queueTitle },
  { path: "/registry/sent", heading: DOCUMENTS.registrySentTitle },
  { path: "/registry/incoming", heading: DOCUMENTS.registryIncomingTitle },
  { path: "/search", heading: SEARCH.title },
  { path: "/reports/register", heading: REGISTER_REPORT.title },
  { path: "/notifications", heading: NOTIFICATION_UI.pageTitle },
  { path: "/help", heading: HELP.title },
  { path: "/admin/audit", heading: AUDIT.title },
]

for (const { path, heading } of PAGES) {
  test(`เปิด ${path} ได้และไม่มี error ในคอนโซล`, async ({ page }) => {
    const errors: string[] = []

    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text())
    })
    page.on("pageerror", (error) => errors.push(error.message))

    const response = await page.goto(path)

    expect(response?.status(), `${path} ต้องตอบ 200`).toBe(200)
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible()

    // หน้า error ของ Next คืน 200 ได้ จึงต้องเช็กเนื้อหาด้วย ไม่ใช่ดูแค่สถานะ
    await expect(page.getByText("This page couldn't load")).toHaveCount(0)

    expect(errors, `${path} มี error ในคอนโซล`).toEqual([])
  })
}

// ── หน้าภาพรวมต้องจบในหน้าจอเดียว ────────────────────────────────────────
//
// ⚠️ เคสนี้ล็อกข้อตกลงที่ผู้ดูแลสั่งไว้ (27 ส.ค. 2569) และล็อก **การผูกค่าข้ามไฟล์**
// ไปพร้อมกัน — ความสูงของกล่องหน้าภาพรวมเป็นสูตร calc() ที่หักความสูง header
// (`h-17`) กับ padding ของ <main> (`lg:py-7`) ออกจาก 100dvh ด้วยตัวเลขที่พิมพ์ไว้เอง
// ถ้าใครไปแก้ความสูง header แล้วไม่ได้มาแก้สูตร หน้าจะเริ่มล้นเงียบ ๆ
// โดยไม่มีเทสต์ไหนจับได้เลยถ้าไม่มีเคสนี้
//
// บังคับเฉพาะจอ lg ขึ้นไปตามที่ผู้ดูแลกำหนด — จอเล็กปล่อยให้เลื่อนทั้งหน้าตามปกติ
const DESKTOP_SIZES = [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]

for (const size of DESKTOP_SIZES) {
  test(`หน้าภาพรวมจบในหน้าจอเดียวที่ ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size)
    await page.goto("/dashboard")
    await expect(page.getByRole("heading", { name: DASHBOARD.title, level: 1 })).toBeVisible()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
    )

    expect(overflow, "หน้าภาพรวมต้องไม่มีแถบเลื่อนของหน้า").toBeLessThanOrEqual(0)
  })
}

test("รายการบนหน้าภาพรวมเลื่อนในกรอบตัวเอง ไม่ใช่ถูกตัดทิ้ง", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto("/dashboard")

  // ⚠️ "ไม่มีแถบเลื่อน" ทำให้ผ่านได้ด้วยการซ่อนเนื้อหาทิ้งเหมือนกัน — เคสข้างบนจึงไม่พอ
  // ต้องยืนยันด้วยว่าเนื้อหาที่เกินยังไปถึงได้ ผ่านกรอบที่เลื่อนได้ของตัวเอง
  await expect(page.getByText(DASHBOARD.recentActivity)).toBeVisible()

  const scrollable = await page.evaluate(() =>
    [...document.querySelectorAll("main ul")].some(
      (el) => getComputedStyle(el).overflowY === "auto",
    ),
  )

  expect(scrollable, "รายการต้องอยู่ในกรอบที่เลื่อนได้").toBe(true)
})

test("เมนูข้างไม่แสดงเมนูที่ผู้ใช้ไม่มีสิทธิ์ (§10.2 — ซ่อน ไม่ใช่ disable)", async ({ page }) => {
  await page.goto("/dashboard")

  // สารบรรณกลางไม่มีสิทธิ์ user.manage/role.manage จึงต้องไม่เห็นเมนูจัดการผู้ใช้เลย
  const sidebar = page.getByRole("navigation")

  await expect(sidebar.getByRole("link", { name: "ผู้ใช้งาน" })).toHaveCount(0)
  await expect(sidebar.getByRole("link", { name: "บทบาทและสิทธิ์" })).toHaveCount(0)
})

// ── หน้าล็อกอิน (spec §17.5 · D19) ────────────────────────────────────────────
//
// ต้องเปิดแบบยังไม่ล็อกอิน — ชุดอื่นใช้เซสชันที่ auth.setup.ts เตรียมไว้
// ซึ่งจะทำให้ /login เด้งไป /dashboard ทันทีและไม่ได้ทดสอบอะไรเลย
test.describe("หน้าเข้าสู่ระบบ", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("มีปุ่ม Google · เส้นคั่น · ช่องจดจำ และช่องแรกรับได้ทั้งชื่อผู้ใช้และอีเมล", async ({
    page,
  }) => {
    await page.goto("/login")

    const google = page.getByRole("link", { name: LOGIN.google })

    await expect(google).toBeVisible()
    await expect(google).toHaveAttribute("href", "/api/auth/google/start")

    await expect(page.getByText(LOGIN.divider, { exact: true })).toBeVisible()
    await expect(page.getByLabel(LOGIN.username)).toBeVisible()
    await expect(page.getByLabel(LOGIN.remember)).toBeVisible()
    await expect(page.getByRole("button", { name: LOGIN.submit })).toBeVisible()
  })

  test("แสดงข้อความเมื่อ callback ของ Google ส่งรหัสเหตุผลกลับมา", async ({ page }) => {
    await page.goto("/login?error=google_no_account")

    await expect(page.getByText(LOGIN_ERRORS.google_no_account!)).toBeVisible()
  })

  test("รหัสเหตุผลที่ไม่รู้จักต้องไม่ขึ้นข้อความอะไรเลย", async ({ page }) => {
    // ใครก็ใส่ ?error= อะไรก็ได้แล้วส่งลิงก์ไปหลอกคนอื่นว่าเป็นข้อความจากระบบ
    const injected = "บัญชีของคุณถูกยึด โทร 02-000-0000"

    await page.goto(`/login?error=${encodeURIComponent(injected)}`)

    // ⚠️ **ห้ามใช้ getByRole("alert") ตรงนี้** — Next มี route announcer ของตัวเอง
    // ที่มี role="alert" อยู่ใน shadow DOM และโผล่มาหลัง hydration เสมอ
    // เทสต์จะกลายเป็นการแข่งเวลากับ hydration (แดงราว 7 ใน 10 ครั้ง · CI #10)
    await expect(page.locator("[data-slot='alert']")).toHaveCount(0)

    // ข้อความที่ผู้โจมตียัดมาต้องไม่ถูกเรนเดอร์ที่ไหนเลยบนหน้า
    await expect(page.getByText("บัญชีของคุณถูกยึด")).toHaveCount(0)
  })
})
