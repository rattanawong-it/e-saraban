import { formatThaiDate } from "@/lib/thai"
import type { RegisterReport } from "@/server/services/report.service"

// นิยามคอลัมน์ของทะเบียนหนังสือ — **ที่เดียว** ที่ Excel · PDF · หน้าเว็บใช้ร่วมกัน
//
// ถ้าแยกกันเขียนสามที่ วันหนึ่งไฟล์ Excel กับหน้าจอจะมีคอลัมน์ไม่ตรงกัน แล้วคนที่เอาไฟล์
// ไปส่งผู้ตรวจสอบจะไม่รู้ว่าอันไหนถูก
//
// ชุดคอลัมน์ตามแบบทะเบียนหนังสือรับ/ส่งของระเบียบสำนักนายกรัฐมนตรีว่าด้วยงานสารบรรณ
//   เลขทะเบียน · ที่ · ลงวันที่ · จาก · ถึง · เรื่อง · การปฏิบัติ · หมายเหตุ

export interface RegisterColumn {
  key: "seq" | "docNo" | "docDate" | "from" | "to" | "subject" | "action" | "note"
  label: string
  /** ความกว้างในหน่วยของ Excel (จำนวนอักขระโดยประมาณ) */
  excelWidth: number
  /** สัดส่วนความกว้างบนหน้า PDF — รวมกันได้ 1 */
  pdfRatio: number
  align?: "left" | "center" | "right"
}

export const REGISTER_COLUMNS: RegisterColumn[] = [
  { key: "seq", label: "เลขทะเบียน", excelWidth: 11, pdfRatio: 0.07, align: "center" },
  { key: "docNo", label: "ที่", excelWidth: 18, pdfRatio: 0.12 },
  { key: "docDate", label: "ลงวันที่", excelWidth: 12, pdfRatio: 0.08, align: "center" },
  { key: "from", label: "จาก", excelWidth: 22, pdfRatio: 0.13 },
  { key: "to", label: "ถึง", excelWidth: 22, pdfRatio: 0.13 },
  { key: "subject", label: "เรื่อง", excelWidth: 42, pdfRatio: 0.25 },
  { key: "action", label: "การปฏิบัติ", excelWidth: 16, pdfRatio: 0.11 },
  { key: "note", label: "หมายเหตุ", excelWidth: 20, pdfRatio: 0.11 },
]

export function registerTitle(report: Pick<RegisterReport, "book">): string {
  return report.book === "incoming" ? "ทะเบียนหนังสือรับ" : "ทะเบียนหนังสือส่ง"
}

/** บรรทัดรองใต้ชื่อทะเบียน — ปี พ.ศ. และช่วงวันที่ที่กรองไว้ (ถ้ามี) */
export function registerSubtitle(report: Pick<RegisterReport, "year" | "from" | "to">): string {
  const parts = [`ประจำปี พ.ศ. ${report.year}`]

  if (report.from || report.to) {
    const from = report.from ? formatThaiDate(report.from) : "เริ่มต้น"
    const to = report.to ? formatThaiDate(report.to) : "ปัจจุบัน"
    parts.push(`ช่วงวันที่ ${from} – ${to}`)
  }

  return parts.join(" · ")
}
