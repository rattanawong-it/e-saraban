import Link from "next/link"
import { RotateCcw, Search } from "lucide-react"

import { CONFIDENTIALITY_LEVELS, SEARCH, URGENCY_LEVELS } from "@/constants"
import type { SearchFilterValues } from "@/constants"
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

export interface SearchOption {
  id: string
  label: string
}

// นิยามค่าและค่าตั้งต้นย้ายไป `@/constants/filters` แล้ว เพราะชุด e2e ต้องอ่านค่าตั้งต้น
// ชุดเดียวกันนี้ แต่ import ไฟล์ที่มี JSX เข้าไปไม่ได้ · re-export ไว้ให้ที่เรียกเดิมไม่ต้องแก้
export type { SearchFilterValues }

export function SearchFilters({
  values,
  documentTypes,
  orgUnits,
}: {
  values: SearchFilterValues
  documentTypes: SearchOption[]
  orgUnits: SearchOption[]
}) {
  // ⚠️ key ผูกกับค่าที่มาจาก URL — บังคับให้ React ประกอบฟอร์มใหม่ทุกครั้งที่ query เปลี่ยน
  //
  // ทุกช่องในฟอร์มเป็น uncontrolled ที่ใช้ `defaultValue` ซึ่ง **มีผลแค่ตอน mount ครั้งแรก**
  // เวลาเปลี่ยนหน้าแบบ client-side (กด "ล้างเงื่อนไข" · กด back · กดลิงก์ที่มี query อื่น)
  // React ใช้ DOM ก้อนเดิมต่อ ค่าใน `<select>` จึงค้างของเก่าไว้ทั้งที่ URL เปลี่ยนไปแล้ว
  // — อาการคือกดล้างเงื่อนไขแล้วช่องข้อความว่าง แต่ตัวเลือกทุกตัวยังเป็นค่าเดิม
  //
  // ถ้าวันหลังเปลี่ยนช่องไหนไปเป็น controlled input ให้ลบ key นี้ทิ้งพร้อมกัน
  const formKey = JSON.stringify(values)

  return (
    <Card className="mb-4 p-4">
      <form key={formKey} method="get" action="/search" className="flex flex-col gap-4">
        {/* ⚠️ `lg:col-span-2` ที่ช่อง "ช่วงวันที่ของ" คือสิ่งที่ดัน "ตั้งแต่" กับ "ถึง"
            ให้ตกไปอยู่แถวสุดท้ายด้วยกัน (ผู้ดูแลกำหนด · docs/sample_v6.png)
            ของเดิม "ตั้งแต่" อยู่ท้ายแถวหนึ่ง ส่วน "ถึง" ไปโดดอยู่อีกแถว
            ทั้งที่เป็นช่วงเดียวกัน อ่านแล้วไม่รู้ว่าคู่กับอะไร

            ⚠️ `xl:grid-cols-4` ไม่ได้ใส่เพื่อความสวยอย่างเดียว — มันยุบจาก 5 แถว
            เหลือ 4 แถว ซึ่งเป็นสิ่งที่ทำให้หน้านี้เปิดครั้งแรกแล้วไม่มีแถบเลื่อน
            (เดิมล้น 87px) · ถ้าถอดออกหรือเพิ่มช่องใหม่ แถบเลื่อนจะกลับมาทันที
            มี e2e ล็อกไว้แล้ว */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

          <Field label={SEARCH.dateField} htmlFor="dateField" className="lg:col-span-2">
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
          <label className="flex cursor-pointer items-center gap-2 text-label text-text-strong">
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
