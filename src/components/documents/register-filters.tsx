import Link from "next/link"
import { FileSpreadsheet, FileText, RotateCcw, Search } from "lucide-react"

import { REGISTER_REPORT } from "@/constants"
import { Button } from "@/components/ui/button"
import { Field, Select, TextInput } from "@/components/ui/field"
import { Card } from "@/components/ui/primitives"

// ตัวกรองของหน้าทะเบียนหนังสือ (spec §10.1 · D12)
//
// server component ล้วนเหมือนหน้าค้นหา — ส่งด้วย method=get เพื่อให้บุ๊กมาร์ก "ทะเบียน
// ของหน่วยงานฉัน ปีนี้" ไว้ใช้ทุกเดือนได้ · ปุ่มดาวน์โหลดเป็นลิงก์ที่พก query เดิมไปทั้งชุด
// ผู้ใช้จึงได้ไฟล์ที่ตรงกับสิ่งที่เห็นบนจอเป๊ะ ไม่ใช่ทะเบียนคนละชุดกับที่กำลังดูอยู่

export interface RegisterFilterValues {
  book: string
  orgUnitId: string
  year: string
  documentTypeId: string
  from: string
  to: string
}

export interface RegisterOption {
  id: string
  label: string
}

export function RegisterFilters({
  values,
  orgUnits,
  documentTypes,
  years,
  exportQuery,
}: {
  values: RegisterFilterValues
  orgUnits: RegisterOption[]
  documentTypes: RegisterOption[]
  years: number[]
  /** query string เดียวกับที่หน้าจอกำลังแสดง — ใช้ต่อท้ายลิงก์ดาวน์โหลด */
  exportQuery: string
}) {
  return (
    <Card className="mb-5 p-5">
      <form method="get" action="/reports/register" className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={REGISTER_REPORT.book} htmlFor="book" hint={REGISTER_REPORT.bookHint}>
            <Select id="book" name="book" defaultValue={values.book}>
              <option value="outgoing">{REGISTER_REPORT.bookOptions.outgoing}</option>
              <option value="incoming">{REGISTER_REPORT.bookOptions.incoming}</option>
            </Select>
          </Field>

          <Field
            label={REGISTER_REPORT.orgUnit}
            htmlFor="orgUnitId"
            hint={REGISTER_REPORT.orgUnitHint}
          >
            <Select id="orgUnitId" name="orgUnitId" defaultValue={values.orgUnitId}>
              <option value="">{REGISTER_REPORT.anyOption}</option>
              {orgUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={REGISTER_REPORT.year} htmlFor="year">
            <Select id="year" name="year" defaultValue={values.year}>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={REGISTER_REPORT.documentType} htmlFor="documentTypeId">
            <Select id="documentTypeId" name="documentTypeId" defaultValue={values.documentTypeId}>
              <option value="">{REGISTER_REPORT.anyOption}</option>
              {documentTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={REGISTER_REPORT.from} htmlFor="from">
            <TextInput id="from" name="from" type="date" defaultValue={values.from} />
          </Field>

          <Field label={REGISTER_REPORT.to} htmlFor="to">
            <TextInput id="to" name="to" type="date" defaultValue={values.to} />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit">
            <Search className="size-4" aria-hidden />
            {REGISTER_REPORT.submit}
          </Button>

          <Button type="button" variant="ghost" asChild>
            <Link href="/reports/register">
              <RotateCcw className="size-4" aria-hidden />
              {REGISTER_REPORT.reset}
            </Link>
          </Button>

          <span className="grow" />

          {/* ดาวน์โหลดเป็นลิงก์ ไม่ใช่ปุ่ม submit — ต้องไม่ไปรบกวนฟอร์มกรองที่ครอบอยู่ */}
          <Button variant="outline" asChild>
            <Link href={`/reports/register/export?format=xlsx&${exportQuery}`} prefetch={false}>
              <FileSpreadsheet className="size-4" aria-hidden />
              {REGISTER_REPORT.exportExcel}
            </Link>
          </Button>

          <Button variant="outline" asChild>
            <Link href={`/reports/register/export?format=pdf&${exportQuery}`} prefetch={false}>
              <FileText className="size-4" aria-hidden />
              {REGISTER_REPORT.exportPdf}
            </Link>
          </Button>
        </div>

        <p className="text-[11.5px] text-text-subtle">{REGISTER_REPORT.exportNote}</p>
      </form>
    </Card>
  )
}
