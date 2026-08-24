import { NextResponse, type NextRequest } from "next/server"

import { PERMISSIONS } from "@/lib/authz"
import { exportAuditCsv, type AuditFilter } from "@/server/services/audit.service"
import { getAppSession } from "@/server/session"
import { can } from "@/lib/authz"

// ส่งออก audit log เป็น CSV (spec §8.5 — "export CSV")
//
// ทำเป็น Route Handler ไม่ใช่ Server Action เพราะต้องส่งไฟล์กลับไปให้เบราว์เซอร์
// ดาวน์โหลด ซึ่ง Server Action ทำไม่ได้ตรง ๆ
//
// ตรวจสิทธิ์เองที่นี่ด้วย — endpoint นี้ถูกเรียกตรงจากภายนอกได้

export async function GET(request: NextRequest) {
  const session = await getAppSession()
  if (!session) return new NextResponse(null, { status: 401 })

  if (!can(session.ctx, PERMISSIONS.AUDIT_READ).allowed) {
    return new NextResponse(null, { status: 403 })
  }

  const chip = request.nextUrl.searchParams.get("filter") ?? ""
  const filter: AuditFilter =
    chip === "denied"
      ? { result: "DENY" }
      : chip === "critical"
        ? { severity: "CRITICAL" }
        : chip === "login"
          ? { entityType: "Session" }
          : chip === "admin"
            ? { entityType: "Role" }
            : {}

  const csv = await exportAuditCsv(session.ctx, filter)
  const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
