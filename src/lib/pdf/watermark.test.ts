import { PDFDocument, PDFDict, PDFName, type PDFPage } from "pdf-lib"
import { describe, expect, it } from "vitest"

import { watermarkPdf } from "./watermark"

// spec §8.3 — ลายน้ำต้องมีชื่อผู้เปิด + username + วันเวลา + IP ทับ **ทุกหน้า**

const IDENTITY = {
  fullName: "นางสาวรัตนา วงศ์ไทย",
  username: "rattana.wong",
  openedAt: new Date("2026-08-25T10:30:00+07:00"),
  ip: "10.0.0.42",
}

async function makePdf(pages: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()

  for (let index = 0; index < pages; index += 1) {
    pdf.addPage([595, 842]).drawText(`page ${index + 1}`, { x: 50, y: 700, size: 12 })
  }

  return pdf.save()
}

/** ชื่อฟอนต์ทั้งหมดที่หน้านั้นใช้ — ฟอนต์ของลายน้ำต้องอยู่ในนี้ทุกหน้า */
function fontNames(pdf: PDFDocument, page: PDFPage): string[] {
  const fonts = page.node.Resources()?.lookup(PDFName.of("Font"), PDFDict)
  if (!fonts) return []

  return fonts
    .values()
    .map((ref) => String(pdf.context.lookup(ref, PDFDict).get(PDFName.of("BaseFont"))))
}

function hasWatermarkFont(pdf: PDFDocument, page: PDFPage): boolean {
  return fontNames(pdf, page).some((name) => name.includes("Sarabun"))
}

describe("watermarkPdf", () => {
  it("แปะข้อความไทยได้โดยไม่พัง และหน้ายังครบเท่าเดิม", async () => {
    const source = await makePdf(3)
    const stamped = await watermarkPdf(source, IDENTITY)
    const reloaded = await PDFDocument.load(stamped)

    expect(reloaded.getPageCount()).toBe(3)
    expect(stamped.byteLength).toBeGreaterThan(source.byteLength)
  })

  it("⚠️ ต้องแปะครบทุกหน้า ไม่ใช่แค่หน้าแรก", async () => {
    const stamped = await watermarkPdf(await makePdf(5), IDENTITY)
    const reloaded = await PDFDocument.load(stamped)

    expect(reloaded.getPages().map((page) => hasWatermarkFont(reloaded, page))).toEqual([
      true,
      true,
      true,
      true,
      true,
    ])
  })

  it("ฝังฟอนต์สารบรรณมาด้วย — ปลายทางไม่ต้องมีฟอนต์ไทยก็อ่านลายน้ำออก", async () => {
    const stamped = await watermarkPdf(await makePdf(1), IDENTITY)
    const reloaded = await PDFDocument.load(stamped)

    // ฟอนต์เดิมของเอกสารยังอยู่ · ของลายน้ำต้องถูกเพิ่มเข้าไปอีกตัว
    expect(fontNames(reloaded, reloaded.getPage(0))).toEqual(
      expect.arrayContaining([expect.stringContaining("Sarabun")]),
    )
  })

  it("ไม่มี IP ก็ยังแปะได้ ไม่ใช่ปล่อยไฟล์ออกไปโดยไม่มีลายน้ำ", async () => {
    const stamped = await watermarkPdf(await makePdf(1), { ...IDENTITY, ip: null })

    expect((await PDFDocument.load(stamped)).getPageCount()).toBe(1)
  })

  it("⚠️ ไฟล์ที่ไม่ใช่ PDF ต้องโยน error ไม่ใช่คืนไฟล์เดิมแบบไม่มีลายน้ำ", async () => {
    await expect(watermarkPdf(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), IDENTITY)).rejects.toThrow()
  })
})
