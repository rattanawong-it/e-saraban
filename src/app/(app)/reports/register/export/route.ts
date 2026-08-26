import { NextResponse, type NextRequest } from "next/server"

import { can, PERMISSIONS } from "@/lib/authz"
import { buildRegisterPdf, buildRegisterWorkbook } from "@/lib/reports"
import { exportRegisterReport, type RegisterBook } from "@/server/services/report.service"
import { getAppSession } from "@/server/session"

// ดึงทะเบียนหนังสือออกเป็นไฟล์ (spec D12)
//
// เป็น Route Handler ไม่ใช่ Server Action ด้วยเหตุผลเดียวกับ /admin/audit/export —
// Server Action ส่งไฟล์ให้เบราว์เซอร์ดาวน์โหลดตรง ๆ ไม่ได้
//
// ⚠️ ตรวจสิทธิ์ที่นี่เองด้วย เพราะ endpoint นี้ถูกเรียกตรงจากภายนอกได้ ไม่ได้ผ่านหน้าเว็บเสมอ
// และ `report.export` เป็นคนละสิทธิ์กับ `report.view` โดยตั้งใจ — ดูบนจอกับดึงไฟล์ออกไป
// ไม่เท่ากัน ไฟล์ที่ออกไปแล้วเรียกคืนไม่ได้

export async function GET(request: NextRequest) {
  const session = await getAppSession()
  if (!session) return new NextResponse(null, { status: 401 })

  if (!can(session.ctx, PERMISSIONS.REPORT_EXPORT).allowed) {
    return new NextResponse(null, { status: 403 })
  }

  const params = request.nextUrl.searchParams
  const format = params.get("format") === "pdf" ? "pdf" : "xlsx"
  const book: RegisterBook = params.get("book") === "incoming" ? "incoming" : "outgoing"

  const report = await exportRegisterReport(
    session.ctx,
    {
      book,
      orgUnitId: params.get("orgUnitId") || undefined,
      year: Number(params.get("year")) || undefined,
      documentTypeId: params.get("documentTypeId") || undefined,
      from: toDate(params.get("from")),
      to: toDate(params.get("to"), true),
    },
    format,
  )

  const stem = `${book === "incoming" ? "ทะเบียนหนังสือรับ" : "ทะเบียนหนังสือส่ง"}-${report.year}`

  if (format === "pdf") {
    const pdf = await buildRegisterPdf(report)

    return fileResponse(pdf, `${stem}.pdf`, "application/pdf")
  }

  const workbook = await buildRegisterWorkbook(report)

  return fileResponse(
    workbook,
    `${stem}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  )
}

function toDate(value: string | null, endOfDay = false): Date | undefined {
  if (!value) return undefined

  const parsed = new Date(endOfDay ? `${value}T23:59:59.999` : `${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

/**
 * ชื่อไฟล์เป็นภาษาไทย จึงต้องส่ง `filename*` แบบ RFC 5987 ด้วย
 *
 * ⚠️ ถ้าส่งแต่ `filename=` เบราว์เซอร์จะได้ชื่อไฟล์เป็นตัวอักษรเพี้ยนหรือเครื่องหมายคำถาม
 * และ header ที่มีอักขระนอก ASCII ทำให้ Node โยน error ตั้งแต่ตอนสร้าง response
 */
function fileResponse(body: Buffer, filename: string, contentType: string): NextResponse {
  const encoded = encodeURIComponent(filename)

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="register.${filename.split(".").pop()}"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "no-store",
    },
  })
}
