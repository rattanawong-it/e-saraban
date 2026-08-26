import "server-only"

import { readFile } from "node:fs/promises"
import path from "node:path"

import fontkit from "@pdf-lib/fontkit"
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib"

import { formatThaiDate, formatThaiDateTime } from "@/lib/thai"
import type { RegisterReport, RegisterRow } from "@/server/services/report.service"

import { REGISTER_COLUMNS, registerSubtitle, registerTitle } from "./register-format"

// ทะเบียนหนังสือเป็นไฟล์ PDF สำหรับพิมพ์เก็บเข้าแฟ้ม (spec D12)
//
// ใช้ฟอนต์ Sarabun ที่ฝังมากับโปรเจกต์ตั้งแต่ P3 — ฟอนต์มาตรฐานของ pdf-lib ไม่มีอักขระไทย
// เลยแม้แต่ตัวเดียว ถ้าลืมฝังจะได้ PDF ที่ว่างเปล่าหรือโยน error ตอน encode
//
// A4 แนวนอน เพราะทะเบียนมี 8 คอลัมน์ · แนวตั้งบีบช่อง "เรื่อง" จนอ่านไม่ออก

const FONT_PATH = path.join(process.cwd(), "src", "lib", "pdf", "fonts", "Sarabun-Regular.ttf")

/** A4 แนวนอน (จุด) */
const PAGE_WIDTH = 841.89
const PAGE_HEIGHT = 595.28
const MARGIN = 32

const TITLE_SIZE = 16
const SUBTITLE_SIZE = 11
const HEADER_SIZE = 10
const BODY_SIZE = 10
const LINE_HEIGHT = 13
const CELL_PADDING = 4

const INK = rgb(0.1, 0.12, 0.16)
const LINE = rgb(0.58, 0.64, 0.71)
const HEADER_FILL = rgb(0.93, 0.95, 0.97)

let cachedFont: Promise<Buffer> | null = null

function loadFont(): Promise<Buffer> {
  cachedFont ??= readFile(FONT_PATH)
  return cachedFont
}

export async function buildRegisterPdf(report: RegisterReport): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)

  const font = await pdf.embedFont(await loadFont(), { subset: true })

  pdf.setTitle(`${registerTitle(report)} ${report.orgUnitName} ${report.year}`)

  const tableWidth = PAGE_WIDTH - MARGIN * 2
  const columns = REGISTER_COLUMNS.map((column) => ({
    ...column,
    width: tableWidth * column.pdfRatio,
  }))

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = drawPageHeader(page, font, report)
  y = drawTableHeader(page, font, columns, y)

  for (const row of report.rows) {
    const cells = columns.map((column) =>
      wrapText(font, cellText(row, column.key), column.width - CELL_PADDING * 2, BODY_SIZE),
    )

    const rowHeight = Math.max(...cells.map((lines) => lines.length)) * LINE_HEIGHT + CELL_PADDING

    // ขึ้นหน้าใหม่พร้อม **หัวตารางซ้ำ** — ทะเบียนที่พิมพ์ออกมาแล้วหน้าหลังไม่มีหัวตาราง
    // คืออ่านไม่รู้เรื่องว่าคอลัมน์ไหนคืออะไร
    if (y - rowHeight < MARGIN + 24) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGIN
      y = drawTableHeader(page, font, columns, y)
    }

    drawRow(page, font, columns, cells, y, rowHeight)
    y -= rowHeight
  }

  if (report.rows.length === 0) {
    page.drawText("ไม่มีรายการในช่วงที่เลือก", {
      x: MARGIN + CELL_PADDING,
      y: y - LINE_HEIGHT,
      size: BODY_SIZE,
      font,
      color: INK,
    })
  }

  stampFooters(pdf, font)

  return Buffer.from(await pdf.save())
}

// ---------------------------------------------------------------------------
// การวาด
// ---------------------------------------------------------------------------

function drawPageHeader(page: PDFPage, font: PDFFont, report: RegisterReport): number {
  let y = PAGE_HEIGHT - MARGIN - TITLE_SIZE

  drawCentered(page, font, registerTitle(report), y, TITLE_SIZE)
  y -= TITLE_SIZE + 4

  drawCentered(page, font, report.orgUnitName, y, SUBTITLE_SIZE)
  y -= SUBTITLE_SIZE + 3

  drawCentered(page, font, registerSubtitle(report), y, SUBTITLE_SIZE)

  return y - SUBTITLE_SIZE - 8
}

function drawCentered(page: PDFPage, font: PDFFont, text: string, y: number, size: number) {
  const width = font.widthOfTextAtSize(text, size)

  page.drawText(text, { x: (PAGE_WIDTH - width) / 2, y, size, font, color: INK })
}

type SizedColumn = (typeof REGISTER_COLUMNS)[number] & { width: number }

function drawTableHeader(
  page: PDFPage,
  font: PDFFont,
  columns: SizedColumn[],
  top: number,
): number {
  const height = LINE_HEIGHT + CELL_PADDING * 2

  page.drawRectangle({
    x: MARGIN,
    y: top - height,
    width: PAGE_WIDTH - MARGIN * 2,
    height,
    color: HEADER_FILL,
    borderColor: LINE,
    borderWidth: 0.5,
  })

  let x = MARGIN

  for (const column of columns) {
    const width = font.widthOfTextAtSize(column.label, HEADER_SIZE)

    page.drawText(column.label, {
      x: x + (column.width - width) / 2,
      y: top - height + CELL_PADDING + 2,
      size: HEADER_SIZE,
      font,
      color: INK,
    })

    x += column.width
    page.drawLine({
      start: { x, y: top },
      end: { x, y: top - height },
      thickness: 0.5,
      color: LINE,
    })
  }

  return top - height
}

function drawRow(
  page: PDFPage,
  font: PDFFont,
  columns: SizedColumn[],
  cells: string[][],
  top: number,
  height: number,
) {
  page.drawRectangle({
    x: MARGIN,
    y: top - height,
    width: PAGE_WIDTH - MARGIN * 2,
    height,
    borderColor: LINE,
    borderWidth: 0.5,
  })

  let x = MARGIN

  columns.forEach((column, index) => {
    const lines = cells[index] ?? []

    lines.forEach((line, lineIndex) => {
      const textWidth = font.widthOfTextAtSize(line, BODY_SIZE)
      const offset =
        column.align === "center"
          ? (column.width - textWidth) / 2
          : column.align === "right"
            ? column.width - textWidth - CELL_PADDING
            : CELL_PADDING

      page.drawText(line, {
        x: x + offset,
        y: top - CELL_PADDING - (lineIndex + 1) * LINE_HEIGHT + 4,
        size: BODY_SIZE,
        font,
        color: INK,
      })
    })

    x += column.width

    page.drawLine({
      start: { x, y: top },
      end: { x, y: top - height },
      thickness: 0.5,
      color: LINE,
    })
  })
}

/** เลขหน้าและเวลาที่พิมพ์ — ทะเบียนที่พิมพ์ออกมาต้องรู้ว่าเป็นข้อมูล ณ เวลาใด */
function stampFooters(pdf: PDFDocument, font: PDFFont) {
  const pages = pdf.getPages()
  const printedAt = `พิมพ์เมื่อ ${formatThaiDateTime(new Date())}`

  pages.forEach((page, index) => {
    page.drawText(printedAt, {
      x: MARGIN,
      y: MARGIN - 12,
      size: 8,
      font,
      color: LINE,
    })

    const label = `หน้า ${index + 1} / ${pages.length}`
    const width = font.widthOfTextAtSize(label, 8)

    page.drawText(label, {
      x: PAGE_WIDTH - MARGIN - width,
      y: MARGIN - 12,
      size: 8,
      font,
      color: LINE,
    })
  })
}

// ---------------------------------------------------------------------------
// ข้อความ
// ---------------------------------------------------------------------------

function cellText(row: RegisterRow, key: SizedColumn["key"]): string {
  switch (key) {
    case "seq":
      return row.seq === null ? "" : String(row.seq)
    case "docDate":
      return row.docDate ? formatThaiDate(row.docDate, "short") : ""
    default:
      return row[key]
  }
}

/**
 * ตัดบรรทัดให้พอดีความกว้างคอลัมน์
 *
 * ⚠️ ภาษาไทยไม่มีเว้นวรรคระหว่างคำ การตัดตามช่องว่างอย่างเดียวจึงได้บรรทัดเดียวยาวทะลุ
 * ออกนอกกระดาษ · ที่นี่จึงตัดทีละอักขระเมื่อคำเดียวยาวเกินช่อง ยอมให้ตัดกลางคำ
 * (เล่มทะเบียนกระดาษก็ตัดแบบนี้) ดีกว่าข้อความหายไปนอกขอบโดยไม่มีใครเห็น
 */
function wrapText(font: PDFFont, text: string, maxWidth: number, size: number): string[] {
  if (!text) return [""]

  const lines: string[] = []
  let current = ""

  for (const char of text) {
    const candidate = current + char

    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current)
      current = char
      continue
    }

    current = candidate
  }

  if (current) lines.push(current)

  // กันแถวสูงเกินหน้ากระดาษเมื่อมีคนใส่ชื่อเรื่องยาวผิดปกติ
  return lines.slice(0, 6)
}
