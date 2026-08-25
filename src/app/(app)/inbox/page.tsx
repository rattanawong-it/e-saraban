import type { Metadata } from "next"

import { APP_NAME, DOCUMENTS } from "@/constants"
import { DocumentTable } from "@/components/documents/document-table"
import { DocumentPager, DocumentToolbar } from "@/components/documents/document-toolbar"
import { PageHeader } from "@/components/ui/primitives"
import { listDocuments } from "@/server/services/document-list.service"
import { requireSession } from "@/server/session"
import type { DocumentStatusValue } from "@/schemas/document.schema"

export const metadata: Metadata = {
  title: `${DOCUMENTS.inboxTitle} · ${APP_NAME}`,
}

const CHIPS = [
  { key: "", label: DOCUMENTS.filterAll },
  { key: "CIRCULATING", label: "รอรับทราบ" },
  { key: "FORWARDED", label: "ส่งต่อมา" },
  { key: "CLOSED", label: "ปิดเรื่องแล้ว" },
]

export default async function InboxPage({ searchParams }: PageProps<"/inbox">) {
  const session = await requireSession()
  const params = await searchParams

  const q = typeof params.q === "string" ? params.q : ""
  const status = typeof params.status === "string" ? params.status : ""
  const page = Number(typeof params.page === "string" ? params.page : 1) || 1

  const result = await listDocuments(session.ctx, {
    scope: "inbox",
    q,
    status: (status || undefined) as DocumentStatusValue | undefined,
    page,
  })

  return (
    <>
      <PageHeader title={DOCUMENTS.inboxTitle} description={DOCUMENTS.inboxDescription} />

      <DocumentToolbar basePath="/inbox" q={q} chips={CHIPS} activeChip={status} />

      <DocumentTable
        rows={result.rows}
        variant="inbox"
        emptyMessage={q || status ? DOCUMENTS.emptySearch : DOCUMENTS.emptyInbox}
      />

      <DocumentPager
        basePath="/inbox"
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        params={{ q, status }}
      />
    </>
  )
}
