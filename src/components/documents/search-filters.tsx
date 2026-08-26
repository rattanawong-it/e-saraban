import Link from "next/link"
import { RotateCcw, Search } from "lucide-react"

import { CONFIDENTIALITY_LEVELS, SEARCH, URGENCY_LEVELS } from "@/constants"
import {
  DIRECTION_LABELS,
  DOCUMENT_DIRECTIONS,
  DOCUMENT_STATUSES,
  STATUS_LABELS,
} from "@/schemas/document.schema"
import { Button } from "@/components/ui/button"
import { Checkbox, Field, Select, TextInput } from "@/components/ui/field"
import { Card } from "@/components/ui/primitives"

// ตัวกรองของหน้าค้นหาขั้นสูง (spec §10.1)
//
// เป็น server component ล้วน · ทุกช่องส่งผ่าน query string ด้วย method=get
// ผู้ใช้จึงบุ๊กมาร์กเงื่อนไขที่ใช้บ่อยได้ ส่งลิงก์ให้เพื่อนร่วมงานได้ และกด back ได้ตามปกติ
// (ผลการค้นหายังถูกจำกัดด้วยสิทธิ์ของผู้เปิดลิงก์เสมอ ลิงก์จึงไม่ใช่ช่องทางแชร์ข้อมูล)

export interface SearchFilterValues {
  q: string
  direction: string
  status: string
  documentTypeId: string
  ownerUnitId: string
  confidentiality: string
  urgency: string
  dateField: string
  from: string
  to: string
  hasAttachment: boolean
  sort: string
}

export interface SearchOption {
  id: string
  label: string
}

export function SearchFilters({
  values,
  documentTypes,
  orgUnits,
}: {
  values: SearchFilterValues
  documentTypes: SearchOption[]
  orgUnits: SearchOption[]
}) {
  return (
    <Card className="mb-5 p-5">
      <form method="get" action="/search" className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label={SEARCH.keyword}
            htmlFor="q"
            hint={SEARCH.keywordHint}
            className="sm:col-span-2"
          >
            <TextInput
              id="q"
              name="q"
              type="search"
              defaultValue={values.q}
              placeholder={SEARCH.keywordPlaceholder}
            />
          </Field>

          <Field label={SEARCH.sort} htmlFor="sort">
            <Select id="sort" name="sort" defaultValue={values.sort}>
              <option value="latest">{SEARCH.sortOptions.latest}</option>
              <option value="oldest">{SEARCH.sortOptions.oldest}</option>
              <option value="docNo">{SEARCH.sortOptions.docNo}</option>
            </Select>
          </Field>

          <Field label={SEARCH.direction} htmlFor="direction">
            <Select id="direction" name="direction" defaultValue={values.direction}>
              <option value="">{SEARCH.anyOption}</option>
              {DOCUMENT_DIRECTIONS.map((direction) => (
                <option key={direction} value={direction}>
                  {DIRECTION_LABELS[direction]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={SEARCH.status} htmlFor="status">
            <Select id="status" name="status" defaultValue={values.status}>
              <option value="">{SEARCH.anyOption}</option>
              {DOCUMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={SEARCH.documentType} htmlFor="documentTypeId">
            <Select id="documentTypeId" name="documentTypeId" defaultValue={values.documentTypeId}>
              <option value="">{SEARCH.anyOption}</option>
              {documentTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={SEARCH.ownerUnit}
            htmlFor="ownerUnitId"
            hint={SEARCH.ownerUnitHint}
            className="sm:col-span-2"
          >
            <Select id="ownerUnitId" name="ownerUnitId" defaultValue={values.ownerUnitId}>
              <option value="">{SEARCH.anyOption}</option>
              {orgUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={SEARCH.confidentiality} htmlFor="confidentiality">
            <Select
              id="confidentiality"
              name="confidentiality"
              defaultValue={values.confidentiality}
            >
              <option value="">{SEARCH.anyOption}</option>
              {CONFIDENTIALITY_LEVELS.map((level) => (
                <option key={level.level} value={String(level.level)}>
                  {level.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={SEARCH.urgency} htmlFor="urgency">
            <Select id="urgency" name="urgency" defaultValue={values.urgency}>
              <option value="">{SEARCH.anyOption}</option>
              {URGENCY_LEVELS.map((level) => (
                <option key={level.level} value={String(level.level)}>
                  {level.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={SEARCH.dateField} htmlFor="dateField">
            <Select id="dateField" name="dateField" defaultValue={values.dateField}>
              <option value="docDate">{SEARCH.dateFieldOptions.docDate}</option>
              <option value="receivedDate">{SEARCH.dateFieldOptions.receivedDate}</option>
              <option value="createdAt">{SEARCH.dateFieldOptions.createdAt}</option>
            </Select>
          </Field>

          <Field label={SEARCH.from} htmlFor="from">
            <TextInput id="from" name="from" type="date" defaultValue={values.from} />
          </Field>

          <Field label={SEARCH.to} htmlFor="to">
            <TextInput id="to" name="to" type="date" defaultValue={values.to} />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text-strong">
            <Checkbox name="hasAttachment" value="1" defaultChecked={values.hasAttachment} />
            {SEARCH.hasAttachment}
          </label>

          <div className="flex gap-2">
            <Button asChild type="button" variant="ghost" size="sm">
              <Link href="/search">
                <RotateCcw className="size-4" aria-hidden />
                {SEARCH.reset}
              </Link>
            </Button>

            <Button type="submit" size="sm">
              <Search className="size-4" aria-hidden />
              {SEARCH.submit}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  )
}
