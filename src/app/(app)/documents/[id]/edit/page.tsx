import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { APP_NAME, COMMON, DOCUMENTS } from "@/constants"
import { can, PERMISSIONS } from "@/lib/authz"
import { prisma } from "@/lib/db"
import { toAuthzResource } from "@/lib/documents/authz-resource"
import { EDITABLE_STATUSES, isEditable } from "@/lib/documents/state-machine"
import { toDateInputValue } from "@/lib/thai"
import { DocumentForm } from "@/components/documents/document-form"
import { Button } from "@/components/ui/button"
import { Alert, PageHeader } from "@/components/ui/primitives"
import { getDocumentDetail, type DocumentDetail } from "@/server/services/document-list.service"
import { isServiceError } from "@/server/services/errors"
import { requireSession } from "@/server/session"

// แก้ไขร่างหนังสือ (spec §6.4 — เฉพาะ DRAFT กับ RETURNED)
//
// ⚠️ สามด่านที่นี่เป็นแค่การเลือกว่าจะ render ฟอร์มไหม — `updateDocument()`
// ตรวจซ้ำทั้งสิทธิ์ สถานะ และทิศทางของประเภทหนังสือเองอีกครั้งตอนบันทึกจริง

export const metadata: Metadata = {
  title: `${DOCUMENTS.editTitle} · ${APP_NAME}`,
}

export default async function EditDocumentPage({ params }: PageProps<"/documents/[id]/edit">) {
  const session = await requireSession()
  const { id } = await params

  let document: DocumentDetail

  try {
    document = await getDocumentDetail(session.ctx, id)
  } catch (error) {
    if (isServiceError(error)) {
      if (error.code === "NOT_FOUND") notFound()

      return (
        <Blocked documentId={id} title={DOCUMENTS.detailForbidden}>
          {error.message}
        </Blocked>
      )
    }

    throw error
  }

  // ออกเลขแล้วแก้ไม่ได้ — พาผู้ใช้กลับไปหน้าเอกสารพร้อมบอกเหตุผล ดีกว่าปล่อยให้กรอกจนเสร็จแล้วโดนปฏิเสธ
  if (!isEditable(document.status)) {
    return (
      <Blocked documentId={document.id} title={DOCUMENTS.editNotAllowed}>
        {DOCUMENTS.editNotAllowedHint}
      </Blocked>
    )
  }

  const allowed = can(session.ctx, PERMISSIONS.DOCUMENT_UPDATE, toAuthzResource(document), {
    allowedStatuses: EDITABLE_STATUSES,
  })

  if (!allowed.allowed) {
    return (
      <Blocked documentId={document.id} title={DOCUMENTS.editNotAllowed}>
        {DOCUMENTS.detailForbidden}
      </Blocked>
    )
  }

  // เฉพาะประเภทที่อยู่ในทิศทางเดียวกัน — service ปฏิเสธการสลับข้ามทิศทางอยู่แล้ว
  // ประเภทที่ถูกปิดใช้งานไปแล้วยังต้องอยู่ในรายการถ้าเอกสารฉบับนี้ใช้อยู่ ไม่งั้นการบันทึก
  // จะเปลี่ยนประเภทให้เงียบ ๆ โดยที่ผู้ใช้ไม่ได้สั่ง
  const documentTypes = await prisma.documentType.findMany({
    where: {
      tenantId: session.ctx.tenantId,
      direction: document.direction,
      OR: [{ isActive: true }, { id: document.documentTypeId }],
    },
    orderBy: { sortOrder: "asc" },
    select: { id: true, nameTh: true, direction: true },
  })

  return (
    <>
      <div className="mb-4">
        <Button asChild size="sm" variant="ghost">
          <Link href={`/documents/${document.id}`}>
            <ArrowLeft className="size-4" aria-hidden />
            {COMMON.back}
          </Link>
        </Button>
      </div>

      <PageHeader title={DOCUMENTS.editTitle} description={DOCUMENTS.editDescription} />

      <DocumentForm
        mode="edit"
        documentId={document.id}
        documentTypes={documentTypes}
        ownerUnitName={document.ownerUnit.shortName ?? document.ownerUnit.nameTh}
        values={{
          documentTypeId: document.documentTypeId,
          subject: document.subject,
          summary: document.summary ?? "",
          externalRecipientName: document.externalRecipientName ?? "",
          externalSenderName: document.externalSenderName ?? "",
          docDate: document.docDate ? toDateInputValue(document.docDate) : "",
          receivedDate: document.receivedDate ? toDateInputValue(document.receivedDate) : "",
          dueDate: document.dueDate ? toDateInputValue(document.dueDate) : "",
          refDocNo: document.refDocNo ?? "",
          confidentialityLevel: document.confidentialityLevel,
          urgencyLevel: document.urgencyLevel,
          parentDocumentId: document.parentDocumentId ?? "",
        }}
      />
    </>
  )
}

function Blocked({
  documentId,
  title,
  children,
}: {
  documentId: string
  title: string
  children: React.ReactNode
}) {
  return (
    <>
      <div className="mb-4">
        <Button asChild size="sm" variant="ghost">
          <Link href={`/documents/${documentId}`}>
            <ArrowLeft className="size-4" aria-hidden />
            {COMMON.back}
          </Link>
        </Button>
      </div>

      <Alert tone="warning" title={title}>
        {children}
      </Alert>
    </>
  )
}
