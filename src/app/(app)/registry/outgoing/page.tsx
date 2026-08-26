import type { Metadata } from "next"

import { APP_NAME, DOCUMENTS } from "@/constants"
import { PERMISSIONS } from "@/lib/authz"
import { DocumentPager, DocumentToolbar } from "@/components/documents/document-toolbar"
import { IssueQueueForm } from "@/components/documents/issue-queue-form"
import { Alert, Badge, PageHeader } from "@/components/ui/primitives"
import { listDocuments } from "@/server/services/document-list.service"
import { requirePermission } from "@/server/session"
import type { DocumentDirectionValue } from "@/schemas/document.schema"

// คิวหนังสือที่รอสารบรรณออกเลข (spec §7 · §10.1)
//
// เห็นได้เฉพาะผู้ที่มีสิทธิ์ออกเลข — ด่านนี้เป็นแค่การเลือกว่าจะ render หน้าไหม
// `issueNumber()` ยังตรวจสิทธิ์รายฉบับเองอีกครั้งตอนกดออกเลขจริง (spec §11.3)

export const metadata: Metadata = {
  title: `${DOCUMENTS.queueTitle} · ${APP_NAME}`,
}

const CHIPS = [
  { key: "", label: DOCUMENTS.filterAll },
  { key: "INTERNAL", label: "บันทึกข้อความ" },
  { key: "OUTGOING", label: "หนังสือส่งภายนอก" },
]

export default async function IssueQueuePage({ searchParams }: PageProps<"/registry/outgoing">) {
  const session = await requirePermission(PERMISSIONS.DOCUMENT_NUMBER_ISSUE)
  const params = await searchParams

  const q = typeof params.q === "string" ? params.q : ""
  const direction = typeof params.direction === "string" ? params.direction : ""
  const page = Number(typeof params.page === "string" ? params.page : 1) || 1

  const result = await listDocuments(session.ctx, {
    scope: "queue",
    q,
    direction: (direction || undefined) as DocumentDirectionValue | undefined,
    page,
  })

  return (
    <>
      <PageHeader
        title={DOCUMENTS.queueTitle}
        description={DOCUMENTS.queueDescription}
        action={
          <Badge tone={result.total > 0 ? "warning" : "neutral"}>
            {DOCUMENTS.resultCount(result.total)}
          </Badge>
        }
      />

      <Alert tone="info" className="mb-4">
        {DOCUMENTS.queueOrderHint}
      </Alert>

      <DocumentToolbar
        basePath="/registry/outgoing"
        q={q}
        chips={CHIPS}
        activeChip={direction}
        chipParam="direction"
      />

      <IssueQueueForm
        rows={result.rows}
        emptyMessage={q || direction ? DOCUMENTS.emptySearch : DOCUMENTS.emptyQueue}
      />

      <DocumentPager
        basePath="/registry/outgoing"
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        params={{ q, direction }}
      />
    </>
  )
}
