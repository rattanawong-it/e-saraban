import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"

import { APP_NAME, DOCUMENTS } from "@/constants"
import { can, PERMISSIONS } from "@/lib/authz"
import { DocumentTable } from "@/components/documents/document-table"
import { DocumentPager, DocumentToolbar } from "@/components/documents/document-toolbar"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/primitives"
import { listDocuments } from "@/server/services/document-list.service"
import { requireSession } from "@/server/session"
import type { DocumentStatusValue } from "@/schemas/document.schema"

// ทะเบียนรับ (A1 · spec §6.3) — หนังสือรับทุกฉบับที่ลงทะเบียนไว้
//
// ใช้ scope "registry" ซึ่งคือ "ออกเลขแล้วเท่านั้น" — หนังสือรับได้เลขตั้งแต่ลงทะเบียน
// ทุกฉบับจึงอยู่ในทะเบียนเสมอ รวมฉบับที่ยกเลิกภายหลังด้วย (§6.4)

export const metadata: Metadata = {
  title: `${DOCUMENTS.registryIncomingTitle} · ${APP_NAME}`,
}

const CHIPS = [
  { key: "", label: DOCUMENTS.filterAll },
  { key: "RECEIVED", label: "ลงทะเบียนรับแล้ว" },
  { key: "FORWARDED", label: "ส่งต่อแล้ว" },
  { key: "CLOSED", label: "ปิดเรื่อง" },
]

export default async function RegistryIncomingPage({
  searchParams,
}: PageProps<"/registry/incoming">) {
  const session = await requireSession()
  const params = await searchParams

  const q = typeof params.q === "string" ? params.q : ""
  const status = typeof params.status === "string" ? params.status : ""
  const page = Number(typeof params.page === "string" ? params.page : 1) || 1

  const result = await listDocuments(session.ctx, {
    scope: "registry",
    direction: "INCOMING",
    q,
    status: (status || undefined) as DocumentStatusValue | undefined,
    page,
  })

  // ลงทะเบียนรับ = สร้างเอกสาร + ออกเลขรับ จึงต้องมีทั้งสองสิทธิ์ เหมือนที่ service ตรวจ
  const canRegister =
    can(session.ctx, PERMISSIONS.DOCUMENT_CREATE).allowed &&
    can(session.ctx, PERMISSIONS.DOCUMENT_NUMBER_ISSUE).allowed

  return (
    <>
      <PageHeader
        title={DOCUMENTS.registryIncomingTitle}
        description={DOCUMENTS.registryIncomingDescription}
        action={
          canRegister ? (
            <Button asChild size="sm">
              <Link href="/registry/incoming/new">
                <Plus className="size-4" aria-hidden />
                {DOCUMENTS.registerIncoming}
              </Link>
            </Button>
          ) : null
        }
      />

      <DocumentToolbar basePath="/registry/incoming" q={q} chips={CHIPS} activeChip={status} />

      {/* ใช้คอลัมน์ชุดเดียวกับกล่องรับ — ทะเบียนรับสนใจ "ใครส่งมา" กับ "รับเมื่อไร" เหมือนกัน */}
      <DocumentTable
        rows={result.rows}
        variant="inbox"
        emptyMessage={q || status ? DOCUMENTS.emptySearch : DOCUMENTS.emptyRegistry}
      />

      <DocumentPager
        basePath="/registry/incoming"
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        params={{ q, status }}
      />
    </>
  )
}
