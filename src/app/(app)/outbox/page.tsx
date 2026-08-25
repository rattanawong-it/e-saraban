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
import type { DocumentDirectionValue } from "@/schemas/document.schema"

export const metadata: Metadata = {
  title: `${DOCUMENTS.outboxTitle} · ${APP_NAME}`,
}

const CHIPS = [
  { key: "", label: DOCUMENTS.filterAll },
  { key: "INTERNAL", label: "บันทึกข้อความ" },
  { key: "OUTGOING", label: "หนังสือส่งภายนอก" },
]

export default async function OutboxPage({ searchParams }: PageProps<"/outbox">) {
  const session = await requireSession()
  const params = await searchParams

  const q = typeof params.q === "string" ? params.q : ""
  const direction = typeof params.direction === "string" ? params.direction : ""
  const page = Number(typeof params.page === "string" ? params.page : 1) || 1

  const result = await listDocuments(session.ctx, {
    scope: "outbox",
    q,
    direction: (direction || undefined) as DocumentDirectionValue | undefined,
    page,
  })

  return (
    <>
      <PageHeader
        title={DOCUMENTS.outboxTitle}
        description={DOCUMENTS.outboxDescription}
        action={
          <Button asChild size="sm">
            <Link href="/documents/new">
              <Plus className="size-4" aria-hidden />
              {DOCUMENTS.create}
            </Link>
          </Button>
        }
      />

      <DocumentToolbar
        basePath="/outbox"
        q={q}
        chips={CHIPS}
        activeChip={direction}
        chipParam="direction"
      />

      <DocumentTable
        rows={result.rows}
        variant="outbox"
        emptyMessage={q || direction ? DOCUMENTS.emptySearch : DOCUMENTS.emptyOutbox}
      />

      <DocumentPager
        basePath="/outbox"
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        params={{ q, direction }}
      />
    </>
  )
}
