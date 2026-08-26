import { expect, test } from "@playwright/test"

import { AUDIT, DASHBOARD, DOCUMENTS, REGISTER_REPORT, SEARCH } from "@/constants/ui"

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

test("เมนูข้างไม่แสดงเมนูที่ผู้ใช้ไม่มีสิทธิ์ (§10.2 — ซ่อน ไม่ใช่ disable)", async ({ page }) => {
  await page.goto("/dashboard")

  // สารบรรณกลางไม่มีสิทธิ์ user.manage/role.manage จึงต้องไม่เห็นเมนูจัดการผู้ใช้เลย
  const sidebar = page.getByRole("navigation")

  await expect(sidebar.getByRole("link", { name: "ผู้ใช้งาน" })).toHaveCount(0)
  await expect(sidebar.getByRole("link", { name: "บทบาทและสิทธิ์" })).toHaveCount(0)
})
