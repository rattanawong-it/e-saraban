import "server-only"

import ExcelJS from "exceljs"

import { formatThaiDate } from "@/lib/thai"
import type { RegisterReport } from "@/server/services/report.service"

import { REGISTER_COLUMNS, registerTitle, registerSubtitle } from "./register-format"

// ทะเบียนหนังสือเป็นไฟล์ Excel (spec D12 · DoD ของ P4: "เปิดใน Excel ได้ฟอนต์ไม่เพี้ยน")
//
// ⚠️ ตั้งฟอนต์เป็น **TH SarabunPSK** ทุกเซลล์ ไม่ปล่อยให้ Excel เลือกเอง — ฟอนต์ปริยาย
// (Calibri/Aptos) เรนเดอร์สระกับวรรณยุกต์ไทยลอยผิดตำแหน่ง และเป็นฟอนต์มาตรฐานของ
// หนังสือราชการตามมติคณะรัฐมนตรี 2553 · เครื่องที่ไม่มีฟอนต์นี้จะ fallback เอง
// แต่ไฟล์ยังพกชื่อฟอนต์ที่ถูกต้องไปด้วยเสมอ
//
// เขียนเป็น .xlsx ไม่ใช่ CSV เพราะ CSV คุมฟอนต์ ความกว้างคอลัมน์ และหัวตารางไม่ได้เลย
// และผู้ตรวจสอบต้องได้ไฟล์ที่หน้าตาเหมือนเล่มทะเบียนที่ใช้อยู่ ไม่ใช่ข้อความคั่นด้วยจุลภาค

const FONT = "TH SarabunPSK"
const FONT_SIZE = 14

export async function buildRegisterWorkbook(report: RegisterReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "ระบบสารบรรณอิเล็กทรอนิกส์"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(
    report.book === "incoming" ? "ทะเบียนหนังสือรับ" : "ทะเบียนหนังสือส่ง",
    {
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
      },
      views: [{ state: "frozen", ySplit: 5 }],
    },
  )

  sheet.columns = REGISTER_COLUMNS.map((column) => ({
    key: column.key,
    width: column.excelWidth,
  }))

  const lastColumn = REGISTER_COLUMNS.length

  // ── หัวกระดาษตามแบบของระเบียบ ──────────────────────────────────────
  addTitleRow(sheet, 1, lastColumn, registerTitle(report), 18, true)
  addTitleRow(sheet, 2, lastColumn, report.orgUnitName, 15, false)
  addTitleRow(sheet, 3, lastColumn, registerSubtitle(report), 14, false)
  sheet.getRow(4).height = 6

  // ── หัวตาราง ──────────────────────────────────────────────────────
  const headerRow = sheet.getRow(5)
  headerRow.values = REGISTER_COLUMNS.map((column) => column.label)
  headerRow.height = 24

  headerRow.eachCell((cell) => {
    cell.font = { name: FONT, size: FONT_SIZE, bold: true }
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDF2F7" } }
    cell.border = BORDER
  })

  // ── แถวข้อมูล ─────────────────────────────────────────────────────
  for (const row of report.rows) {
    const excelRow = sheet.addRow({
      seq: row.seq ?? "",
      docNo: row.docNo,
      docDate: row.docDate ? formatThaiDate(row.docDate, "short") : "",
      from: row.from,
      to: row.to,
      subject: row.subject,
      action: row.action,
      note: row.note,
    })

    excelRow.eachCell((cell, columnNumber) => {
      const column = REGISTER_COLUMNS[columnNumber - 1]

      cell.font = { name: FONT, size: FONT_SIZE }
      cell.alignment = {
        horizontal: column?.align ?? "left",
        vertical: "top",
        wrapText: true,
      }
      cell.border = BORDER
    })
  }

  if (report.rows.length === 0) {
    const empty = sheet.addRow([])
    sheet.mergeCells(empty.number, 1, empty.number, lastColumn)

    const cell = empty.getCell(1)
    cell.value = "ไม่มีรายการในช่วงที่เลือก"
    cell.font = { name: FONT, size: FONT_SIZE, italic: true }
    cell.alignment = { horizontal: "center" }
    cell.border = BORDER
  }

  // exceljs คืน ArrayBuffer ในบางเส้นทาง — แปลงเป็น Buffer ให้ Response ส่งได้แน่นอน
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer as ArrayBuffer)
}

const BORDER = {
  top: { style: "thin" as const, color: { argb: "FF94A3B8" } },
  left: { style: "thin" as const, color: { argb: "FF94A3B8" } },
  bottom: { style: "thin" as const, color: { argb: "FF94A3B8" } },
  right: { style: "thin" as const, color: { argb: "FF94A3B8" } },
}

function addTitleRow(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  lastColumn: number,
  text: string,
  size: number,
  bold: boolean,
) {
  sheet.mergeCells(rowNumber, 1, rowNumber, lastColumn)

  const cell = sheet.getRow(rowNumber).getCell(1)
  cell.value = text
  cell.font = { name: FONT, size, bold }
  cell.alignment = { horizontal: "center", vertical: "middle" }
}
