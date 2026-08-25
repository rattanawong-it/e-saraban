import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"

import { APP_NAME, DOCUMENTS } from "@/constants"
import { DocumentTable } from "@/components/documents/document-table"
import { DocumentPager, DocumentToolbar } from "@/components/documents/document-toolbar"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/primitives"
import { listDocuments } from "@/server/services/document-list.service"
import { requireSession } from "@/server/session"
import type { DocumentStatusValue } from "@/schemas/document.schema"

export const metadata: Metadata = {
  title: `${DOCUMENTS.draftsTitle} · ${APP_NAME}`,
}

// ตัวกรองตรงกับ project-ui/Drafts.dc.html — ทั้งหมด / ร่าง / ถูกตีกลับ
const CHIPS = [
  { key: "", label: DOCUMENTS.filterAll },
  { key: "DRAFT", label: "ร่าง" },
  { key: "RETURNED", label: "ถูกตีกลับ" },
]

export default async function DraftsPage({ searchParams }: PageProps<"/drafts">) {
  const session = await requireSession()
  const params = await searchParams

  const q = typeof params.q === "string" ? params.q : ""
  const status = typeof params.status === "string" ? params.status : ""
  const page = Number(typeof params.page === "string" ? params.page : 1) || 1

  const result = await listDocuments(session.ctx, {
    scope: "drafts",
    q,
    status: (status || undefined) as DocumentStatusValue | undefined,
    page,
  })

  return (
    <>
      <PageHeader
        title={DOCUMENTS.draftsTitle}
        description={DOCUMENTS.draftsDescription}
        action={
          <Button asChild size="sm">
            <Link href="/documents/new">
              <Plus className="size-4" aria-hidden />
              {DOCUMENTS.create}
            </Link>
          </Button>
        }
      />

      <DocumentToolbar basePath="/drafts" q={q} chips={CHIPS} activeChip={status} />

      <DocumentTable
        rows={result.rows}
        variant="drafts"
        emptyMessage={q || status ? DOCUMENTS.emptySearch : DOCUMENTS.emptyDrafts}
      />

      <DocumentPager
        basePath="/drafts"
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        params={{ q, status }}
      />
    </>
  )
}
