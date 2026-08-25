import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { APP_NAME, COMMON, DOCUMENTS } from "@/constants"
import { PERMISSIONS } from "@/lib/authz"
import { prisma } from "@/lib/db"
import { toDateInputValue } from "@/lib/thai"
import { DocumentForm } from "@/components/documents/document-form"
import { Button } from "@/components/ui/button"
import { Alert, PageHeader } from "@/components/ui/primitives"
import { requirePermission } from "@/server/session"

// ลงทะเบียนหนังสือรับ (A1 · spec §6.3) — สร้างเอกสารและออกเลขรับในทรานแซกชันเดียว
//
// ⚠️ หน้านี้เป็นทางเข้าเดียวของหนังสือรับ — `createDocument()` ปฏิเสธประเภท INCOMING
// โดยตั้งใจ เพราะการรับหนังสือต้องได้เลขรับทันที ไม่มีสถานะ "ร่างหนังสือรับ"

export const metadata: Metadata = {
  title: `${DOCUMENTS.registerIncoming} · ${APP_NAME}`,
}

export default async function RegisterIncomingPage() {
  const session = await requirePermission(PERMISSIONS.DOCUMENT_NUMBER_ISSUE)

  const documentTypes = await prisma.documentType.findMany({
    where: { tenantId: session.ctx.tenantId, isActive: true, direction: "INCOMING" },
    orderBy: { sortOrder: "asc" },
    select: { id: true, nameTh: true, direction: true },
  })

  const activeUnit = session.affiliations.find(
    (item) => item.orgUnitId === session.ctx.activeOrgUnitId,
  )

  return (
    <>
      <div className="mb-4">
        <Button asChild size="sm" variant="ghost">
          <Link href="/registry/incoming">
            <ArrowLeft className="size-4" aria-hidden />
            {COMMON.back}
          </Link>
        </Button>
      </div>

      <PageHeader
        title={DOCUMENTS.registerIncoming}
        description={DOCUMENTS.registerIncomingDescription}
      />

      {documentTypes.length === 0 ? (
        <Alert tone="warning" title={DOCUMENTS.noIncomingType}>
          {DOCUMENTS.noDocumentTypeHint}
        </Alert>
      ) : (
        <DocumentForm
          mode="incoming"
          documentTypes={documentTypes}
          ownerUnitName={activeUnit?.orgUnitName ?? COMMON.none}
          values={{
            documentTypeId: documentTypes[0]?.id ?? "",
            subject: "",
            summary: "",
            externalRecipientName: "",
            externalSenderName: "",
            docDate: "",
            // วันที่รับตั้งต้นเป็นวันนี้ตามเวลาไทย คำนวณฝั่ง server เพื่อไม่ให้ค่าต่างกับตอน hydrate
            receivedDate: toDateInputValue(new Date()),
            dueDate: "",
            refDocNo: "",
            confidentialityLevel: 0,
            urgencyLevel: 0,
            parentDocumentId: "",
          }}
        />
      )}
    </>
  )
}
