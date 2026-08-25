import type { Metadata } from "next"

import { APP_NAME, DOCUMENTS } from "@/constants"
import { DocumentTable } from "@/components/documents/document-table"
import { DocumentPager, DocumentToolbar } from "@/components/documents/document-toolbar"
import { PageHeader } from "@/components/ui/primitives"
import { listDocuments } from "@/server/services/document-list.service"
import { requireSession } from "@/server/session"
import type { DocumentDirectionValue } from "@/schemas/document.schema"

// ทะเบียนส่ง (spec §7) — หนังสือที่ออกเลขไปแล้วทุกฉบับ **รวมฉบับที่ยกเลิก**
//
// ⚠️ ฉบับที่ยกเลิกต้องยังอยู่ในทะเบียนพร้อมสถานะ "ยกเลิก" (§6.4)
// เลขที่หายไปจากทะเบียนคือสัญญาณของการทุจริต จึงห้ามกรองออกจากหน้านี้
//
// ต่างจากกล่องส่ง: กล่องส่งคือของหน่วยงานที่กำลังทำงานอยู่ ส่วนที่นี่คือทะเบียน
// เต็มเท่าที่ขอบเขตสิทธิ์ `document.read` ของผู้ใช้จะมองเห็นได้

export const metadata: Metadata = {
  title: `${DOCUMENTS.registrySentTitle} · ${APP_NAME}`,
}

const CHIPS = [
  { key: "", label: DOCUMENTS.filterAll },
  { key: "INTERNAL", label: "บันทึกข้อความ" },
  { key: "OUTGOING", label: "หนังสือส่งภายนอก" },
]

export default async function RegistrySentPage({ searchParams }: PageProps<"/registry/sent">) {
  const session = await requireSession()
  const params = await searchParams

  const q = typeof params.q === "string" ? params.q : ""
  const direction = typeof params.direction === "string" ? params.direction : ""
  const page = Number(typeof params.page === "string" ? params.page : 1) || 1

  const result = await listDocuments(session.ctx, {
    scope: "sent",
    q,
    direction: (direction || undefined) as DocumentDirectionValue | undefined,
    page,
  })

  return (
    <>
      <PageHeader
        title={DOCUMENTS.registrySentTitle}
        description={DOCUMENTS.registrySentDescription}
      />

      <DocumentToolbar
        basePath="/registry/sent"
        q={q}
        chips={CHIPS}
        activeChip={direction}
        chipParam="direction"
      />

      <DocumentTable
        rows={result.rows}
        variant="registry"
        emptyMessage={q || direction ? DOCUMENTS.emptySearch : DOCUMENTS.emptyRegistry}
      />

      <DocumentPager
        basePath="/registry/sent"
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        params={{ q, direction }}
      />
    </>
  )
}
