import { expect, test } from "@playwright/test"

import { E2E_SEARCH_SUBJECT, E2E_SEARCH_TERM } from "./fixtures/constants"

// ทะเบียนหนังสือและการดึงไฟล์ออก (spec D12)
//
// ⚠️ สองเคสในไฟล์นี้ล็อกบั๊กที่ **เจอจากการเปิดหน้าจริงด้วยมือ** ไม่ใช่จากเทสต์
//   1. หัวทะเบียนเคยประกาศชื่อหน่วยงานที่ผู้ใช้ทำงานอยู่ ทั้งที่ไม่ได้กรองด้วยหน่วยนั้น
//      ทำให้ไฟล์ที่ส่งผู้ตรวจสอบมีหัวกระดาษเท็จ
//   2. ปุ่มดาวน์โหลดต้องได้ไฟล์จริงที่เปิดได้ ไม่ใช่หน้า error ที่มีสถานะ 200

test("หน้าทะเบียน: ไม่เลือกหน่วยงาน = หัวต้องเป็น “ทุกหน่วยงาน”", async ({ page }) => {
  await page.goto("/reports/register")

  await expect(page.getByRole("heading", { name: "ทะเบียนหนังสือ", level: 1 })).toBeVisible()

  // ⚠️ ห้ามเป็นชื่อหน่วยงานที่ผู้ใช้กำลังทำงานในนาม ทั้งที่ตัวกรองเลือก "ทั้งหมด"
  await expect(page.getByText(/ทุกหน่วยงาน · \d+ รายการ/)).toBeVisible()
})

test("information banner อยู่เหนือการ์ดตัวกรอง ไม่ใช่ใต้", async ({ page }) => {
  await page.goto("/reports/register")

  const banner = page.getByRole("status").filter({ hasText: "ทะเบียนแสดงเฉพาะฉบับที่สิทธิ์" })
  const filterCard = page.getByRole("button", { name: "แสดงทะเบียน" })

  await expect(banner).toBeVisible()

  // เทียบตำแหน่งจริงบนหน้า — ตัวเลข y ของ banner ต้องน้อยกว่าของปุ่มในการ์ดตัวกรอง
  const bannerBox = await banner.boundingBox()
  const filterBox = await filterCard.boundingBox()

  expect(bannerBox, "หา banner ไม่เจอ").not.toBeNull()
  expect(filterBox, "หาการ์ดตัวกรองไม่เจอ").not.toBeNull()
  expect(bannerBox!.y).toBeLessThan(filterBox!.y)
})

test("ดาวน์โหลด Excel ได้ไฟล์ .xlsx จริง", async ({ page }) => {
  await page.goto("/reports/register")

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "ดาวน์โหลด Excel" }).click(),
  ])

  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  const buffer = Buffer.concat(chunks)

  // .xlsx คือไฟล์ zip — ลายเซ็น PK ที่ต้นไฟล์คือหลักฐานว่าได้ไฟล์จริง ไม่ใช่หน้า error
  expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK")
  expect(buffer.length).toBeGreaterThan(2_000)
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/)
})

test("ดาวน์โหลด PDF ได้ไฟล์ .pdf จริง", async ({ page }) => {
  await page.goto("/reports/register")

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "ดาวน์โหลด PDF" }).click(),
  ])

  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  const buffer = Buffer.concat(chunks)

  expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-")
  expect(buffer.length).toBeGreaterThan(1_000)
  expect(download.suggestedFilename()).toMatch(/\.pdf$/)
})

test("ค้นภาษาไทยจากคำกลางประโยคได้ (§9.2 — pg_trgm)", async ({ page }) => {
  await page.goto("/search")

  // "อบรม" อยู่กลางคำว่า "โครงการอบรมการใช้งาน..." — full-text search ตัดคำไทยไม่ได้
  // จึงต้องพึ่ง pg_trgm · ถ้าวันหนึ่งมีคนเปลี่ยนไปใช้ tsvector เคสนี้จะแดงทันที
  //
  // ⚠️ เอกสารที่ต้องเจอมาจาก fixture ไม่ใช่ของที่บังเอิญมีอยู่บนฐาน — เดิมเคสนี้
  // แดงบนฐานที่ seed สดเพราะไม่มีเอกสารคำนี้เลย (§23.16 ข้อ 3)
  await page.getByLabel("คำค้น").fill(E2E_SEARCH_TERM)
  await page.getByRole("button", { name: "ค้นหา" }).click()

  await expect(page.getByText(/พบ \d+ ฉบับ/)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(E2E_SEARCH_SUBJECT).first()).toBeVisible()
})
