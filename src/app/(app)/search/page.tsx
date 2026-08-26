import type { Metadata } from "next"

import { APP_NAME, SEARCH } from "@/constants"
import { DocumentTable } from "@/components/documents/document-table"
import { DocumentPager } from "@/components/documents/document-toolbar"
import { SearchFilters } from "@/components/documents/search-filters"
import { Alert, PageHeader } from "@/components/ui/primitives"
import { getSearchOptions, searchDocuments } from "@/server/services/search.service"
import type { SearchDateField, SearchSort } from "@/server/services/search.service"
import { requireSession } from "@/server/session"
import { DIRECTION_LABELS } from "@/schemas/document.schema"
import type { DocumentDirectionValue, DocumentStatusValue } from "@/schemas/document.schema"

export const metadata: Metadata = {
  title: `${SEARCH.title} · ${APP_NAME}`,
}

// หน้าค้นหาขั้นสูง (spec §10.1)
//
// ทั้งหน้าเป็น server component — ตัวกรองส่งด้วย method=get ไม่มี state ฝั่ง client เลย
// ผลการค้นหาผ่านด่านขอบเขตสิทธิ์ตัวเดียวกับกล่องเอกสาร (documentVisibilityWhere)

function readParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : ""
}

/** วันที่จากช่อง type=date เป็นเวลาท้องถิ่นเสมอ — ปลายช่วงต้องครอบทั้งวัน */
function toDate(value: string, endOfDay = false): Date | undefined {
  if (!value) return undefined

  const parsed = new Date(endOfDay ? `${value}T23:59:59.999` : `${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function toLevel(value: string): number | undefined {
  if (!value) return undefined

  const level = Number(value)
  return Number.isInteger(level) && level >= 0 && level <= 3 ? level : undefined
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const session = await requireSession()
  const params = await searchParams

  const values = {
    q: readParam(params.q),
    direction: readParam(params.direction),
    status: readParam(params.status),
    documentTypeId: readParam(params.documentTypeId),
    ownerUnitId: readParam(params.ownerUnitId),
    confidentiality: readParam(params.confidentiality),
    urgency: readParam(params.urgency),
    dateField: readParam(params.dateField) || "docDate",
    from: readParam(params.from),
    to: readParam(params.to),
    hasAttachment: readParam(params.hasAttachment) === "1",
    sort: readParam(params.sort) || "latest",
  }

  const page = Number(readParam(params.page)) || 1

  const [options, result] = await Promise.all([
    getSearchOptions(session.ctx),
    searchDocuments(session.ctx, {
      q: values.q,
      direction: (values.direction || undefined) as DocumentDirectionValue | undefined,
      status: (values.status || undefined) as DocumentStatusValue | undefined,
      documentTypeId: values.documentTypeId || undefined,
      ownerUnitId: values.ownerUnitId || undefined,
      confidentialityLevel: toLevel(values.confidentiality),
      urgencyLevel: toLevel(values.urgency),
      hasAttachment: values.hasAttachment || undefined,
      dateField: values.dateField as SearchDateField,
      from: toDate(values.from),
      to: toDate(values.to, true),
      sort: values.sort as SearchSort,
      page,
    }),
  ])

  return (
    <>
      <PageHeader title={SEARCH.title} description={SEARCH.description} />

      <SearchFilters
        values={values}
        documentTypes={options.documentTypes.map((type) => ({
          id: type.id,
          label: `${type.nameTh} · ${DIRECTION_LABELS[type.direction as DocumentDirectionValue]}`,
        }))}
        orgUnits={options.orgUnits.map((unit) => ({
          id: unit.id,
          // เยื้องตามระดับชั้นด้วยช่องว่าง — native select จัดรูปแบบอย่างอื่นไม่ได้
          label: `${"  ".repeat(Math.max(unit.level - 1, 0))}${unit.code} ${unit.shortName ?? unit.nameTh}`,
        }))}
      />

      {result.empty ? (
        <Alert tone="info" title={SEARCH.idle} />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="tabular text-[13px] font-semibold text-text-strong">
              {SEARCH.resultCount(result.total)}
            </p>
            <p className="text-[11.5px] text-text-subtle">{SEARCH.scopeNote}</p>
          </div>

          <DocumentTable rows={result.rows} variant="registry" emptyMessage={SEARCH.notFound} />

          <DocumentPager
            basePath="/search"
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            params={{
              q: values.q,
              direction: values.direction,
              status: values.status,
              documentTypeId: values.documentTypeId,
              ownerUnitId: values.ownerUnitId,
              confidentiality: values.confidentiality,
              urgency: values.urgency,
              dateField: values.dateField,
              from: values.from,
              to: values.to,
              ...(values.hasAttachment ? { hasAttachment: "1" } : {}),
              sort: values.sort,
            }}
          />
        </>
      )}
    </>
  )
}
