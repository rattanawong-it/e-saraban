import type { Metadata } from "next"

import { APP_NAME, REGISTER_REPORT, registerFilterDefaults } from "@/constants"
import { PERMISSIONS } from "@/lib/authz"
import { RegisterFilters } from "@/components/documents/register-filters"
import { RegisterTable } from "@/components/documents/register-table"
import { Alert, PageHeader } from "@/components/ui/primitives"
import { DIRECTION_LABELS, type DocumentDirectionValue } from "@/schemas/document.schema"
import { getSearchOptions } from "@/server/services/search.service"
import { getRegisterReport, type RegisterBook } from "@/server/services/report.service"
import { requirePermission } from "@/server/session"

export const metadata: Metadata = {
  title: `${REGISTER_REPORT.title} · ${APP_NAME}`,
}

// หน้าทะเบียนหนังสือ (spec §10.1 · D12)
//
// ทั้งหน้าเป็น server component เหมือนหน้าค้นหา — เงื่อนไขอยู่ใน query string ทั้งหมด
// ปุ่มดาวน์โหลดจึงส่ง query ชุดเดียวกันต่อไปได้ ไฟล์ที่ได้ตรงกับที่เห็นบนจอเสมอ

function readParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : ""
}

function toDate(value: string, endOfDay = false): Date | undefined {
  if (!value) return undefined

  const parsed = new Date(endOfDay ? `${value}T23:59:59.999` : `${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

/** ปีที่เลือกได้ — ปีปัจจุบันย้อนหลังห้าปี พอสำหรับการตรวจสอบตามปกติ */
function selectableYears(): number[] {
  const current = new Date().getFullYear() + 543
  return [0, 1, 2, 3, 4, 5].map((offset) => current - offset)
}

export default async function RegisterReportPage({ searchParams }: PageProps<"/reports/register">) {
  const session = await requirePermission(PERMISSIONS.REPORT_VIEW)
  const params = await searchParams

  const years = selectableYears()

  // ช่องที่ไม่มีใน query string = ผู้ใช้ไม่ได้เลือก → ใช้ค่าตั้งต้น
  //
  // ⚠️ ต้องเติมจาก registerFilterDefaults() เท่านั้น ห้ามเขียนค่าตั้งต้นซ้ำตรงนี้ —
  // ปุ่ม "ล้างเงื่อนไข" พากลับมาที่ URL ที่ไม่มี query เลย ค่าที่ผู้ใช้เห็นหลังกดล้าง
  // จึงเป็นผลของบรรทัดพวกนี้ล้วน ๆ · ของหน้านี้พลาดแล้วเจ็บกว่าหน้าค้นหา เพราะปุ่ม
  // ดาวน์โหลดพก query ไปทั้งชุด ไฟล์ที่ได้จะไม่ตรงกับตัวกรองที่เห็นบนจอ
  const defaults = registerFilterDefaults(years)

  const values = {
    book: readParam(params.book) === "incoming" ? "incoming" : defaults.book,
    orgUnitId: readParam(params.orgUnitId) || defaults.orgUnitId,
    year: readParam(params.year) || defaults.year,
    documentTypeId: readParam(params.documentTypeId) || defaults.documentTypeId,
    from: readParam(params.from) || defaults.from,
    to: readParam(params.to) || defaults.to,
  }

  const [options, report] = await Promise.all([
    getSearchOptions(session.ctx),
    getRegisterReport(session.ctx, {
      book: values.book as RegisterBook,
      orgUnitId: values.orgUnitId || undefined,
      year: Number(values.year),
      documentTypeId: values.documentTypeId || undefined,
      from: toDate(values.from),
      to: toDate(values.to, true),
    }),
  ])

  const exportQuery = new URLSearchParams({
    book: values.book,
    year: values.year,
    ...(values.orgUnitId ? { orgUnitId: values.orgUnitId } : {}),
    ...(values.documentTypeId ? { documentTypeId: values.documentTypeId } : {}),
    ...(values.from ? { from: values.from } : {}),
    ...(values.to ? { to: values.to } : {}),
  }).toString()

  return (
    <>
      <PageHeader title={REGISTER_REPORT.title} description={REGISTER_REPORT.description} />

      <Alert tone="info" className="mb-5">
        {REGISTER_REPORT.scopeNote}
      </Alert>

      <RegisterFilters
        values={values}
        exportQuery={exportQuery}
        years={years}
        orgUnits={options.orgUnits.map((unit) => ({
          id: unit.id,
          label: `${"  ".repeat(Math.max(unit.level - 1, 0))}${unit.code} ${unit.shortName ?? unit.nameTh}`,
        }))}
        documentTypes={options.documentTypes.map((type) => ({
          id: type.id,
          label: `${type.nameTh} · ${DIRECTION_LABELS[type.direction as DocumentDirectionValue]}`,
        }))}
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="tabular text-label font-semibold text-text-strong">
          {report.orgUnitName} · {REGISTER_REPORT.rowCount(report.rows.length)}
        </p>
      </div>

      <RegisterTable rows={report.rows} />
    </>
  )
}
