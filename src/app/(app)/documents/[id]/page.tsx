import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Pencil } from "lucide-react"

import { APP_NAME, COMMON, CONFIDENTIALITY_LEVELS, DOCUMENTS, URGENCY_LEVELS } from "@/constants"
import { can, PERMISSIONS, type Permission } from "@/lib/authz"
import { toAuthzResource } from "@/lib/documents/authz-resource"
import {
  availableTransitions,
  canIssueNumber,
  EDITABLE_STATUSES,
  isEditable,
  type DocumentTransition,
} from "@/lib/documents/state-machine"
import { getSystemSettings } from "@/lib/settings"
import { formatThaiDate, formatThaiDateTime } from "@/lib/thai"
import {
  DIRECTION_LABELS,
  RECIPIENT_KIND_LABELS,
  type RecipientStatusValue,
} from "@/schemas/document.schema"
import { AttachmentPanel } from "@/components/documents/attachment-panel"
import { DocumentActionPanel } from "@/components/documents/document-action-panel"
import { DocumentStatusBadge } from "@/components/documents/document-table"
import { DocumentTimeline } from "@/components/documents/document-timeline"
import { Button } from "@/components/ui/button"
import { Alert, Badge, Card, CardHeader, ConfidentialityBadge } from "@/components/ui/primitives"
import type { ServiceContext } from "@/server/context"
import { getDocumentDetail, type DocumentDetail } from "@/server/services/document-list.service"
import { isServiceError } from "@/server/services/errors"
import { listOrgUnitsFlat } from "@/server/services/org-unit.service"
import { requireSession } from "@/server/session"

// รายละเอียดหนังสือหนึ่งฉบับ — ทุกอย่างที่ผู้ใช้ต้องทำกับเอกสารรวมอยู่ที่หน้านี้
//
// ⚠️ ปุ่มที่ขึ้นบนหน้านี้ผ่านสองด่านเสมอ: state machine ว่า "สถานะนี้ทำได้ไหม"
// แล้วจึง can() ว่า "คนนี้ทำได้ไหม" — และ service ยังตรวจซ้ำอีกชั้นตอนกดจริง (spec §11.3)

export const metadata: Metadata = {
  title: `${DOCUMENTS.detailTitle} · ${APP_NAME}`,
}

/** สิทธิ์ที่ต้องมีของแต่ละ transition — ต้องตรงกับที่ document.service ใช้ */
const TRANSITION_PERMISSIONS: Record<DocumentTransition, Permission> = {
  SUBMITTED: PERMISSIONS.DOCUMENT_SUBMIT,
  RETURNED: PERMISSIONS.DOCUMENT_RETURN,
  NUMBER_ISSUED: PERMISSIONS.DOCUMENT_NUMBER_ISSUE,
  CIRCULATED: PERMISSIONS.DOCUMENT_CIRCULATE,
  FORWARDED: PERMISSIONS.DOCUMENT_CIRCULATE,
  ACKNOWLEDGED: PERMISSIONS.DOCUMENT_ACKNOWLEDGE,
  MARKED_SENT: PERMISSIONS.DOCUMENT_SEND_EXTERNAL,
  CLOSED: PERMISSIONS.DOCUMENT_CLOSE,
  CANCELLED: PERMISSIONS.DOCUMENT_DELETE,
}

const RECIPIENT_STATUS_LABELS: Record<RecipientStatusValue, string> = {
  PENDING: "รอส่ง",
  SENT: "ส่งแล้ว",
  READ: "เปิดอ่านแล้ว",
  ACKNOWLEDGED: "รับทราบแล้ว",
}

export default async function DocumentDetailPage({ params }: PageProps<"/documents/[id]">) {
  const session = await requireSession()
  const { id } = await params

  let document: DocumentDetail

  try {
    document = await getDocumentDetail(session.ctx, id)
  } catch (error) {
    // ไม่พบ = 404 · ไม่มีสิทธิ์ = บอกตรง ๆ ว่าเข้าไม่ได้ ไม่แกล้งทำเป็นว่าไม่มีเอกสาร
    // เพราะคนในหน่วยงานเดียวกันรู้อยู่แล้วว่าเอกสารมีอยู่ การซ่อนจึงได้แค่ความสับสน
    if (isServiceError(error)) {
      if (error.code === "NOT_FOUND") notFound()

      return (
        <>
          <BackLink />
          <Alert tone="danger" title={DOCUMENTS.detailForbidden}>
            {error.message}
          </Alert>
        </>
      )
    }

    throw error
  }

  const transitions = allowedTransitions(session.ctx, document)
  const needsRecipients = transitions.includes("CIRCULATED") || transitions.includes("FORWARDED")

  const [orgUnits, settings] = await Promise.all([
    needsRecipients ? listOrgUnitsFlat(session.ctx.tenantId) : Promise.resolve([]),
    getSystemSettings(session.ctx.tenantId),
  ])

  const resource = toAuthzResource(document)

  // แนบไฟล์ได้เมื่อมีสิทธิ์และเอกสารยังไม่จบเรื่อง — เงื่อนไขเดียวกับที่ service ตรวจ
  const canUpload =
    can(session.ctx, PERMISSIONS.ATTACHMENT_UPLOAD, resource).allowed &&
    document.status !== "CLOSED" &&
    document.status !== "CANCELLED"

  const canEdit =
    isEditable(document.status) &&
    can(session.ctx, PERMISSIONS.DOCUMENT_UPDATE, resource, {
      allowedStatuses: EDITABLE_STATUSES,
    }).allowed

  const lastReturn = document.actions.find((action) => action.actionType === "RETURNED")

  return (
    <>
      <BackLink />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="tabular flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-bold text-primary">
              {document.docNo ?? DOCUMENTS.noDocNo}
            </span>
            <DocumentStatusBadge status={document.status} />
            <ConfidentialityBadge
              level={document.confidentialityLevel}
              label={levelLabel(document.confidentialityLevel)}
            />
            {document.urgencyLevel > 0 ? (
              <Badge tone={document.urgencyLevel >= 2 ? "danger" : "warning"}>
                {URGENCY_LEVELS[document.urgencyLevel]?.label ?? ""}
              </Badge>
            ) : null}
          </div>

          <h1 className="mt-1.5 text-[22px] leading-snug font-bold text-text-strong">
            {document.subject}
          </h1>
          <p className="mt-1 text-[13px] text-text-subtle">
            {`${document.documentType.nameTh} · ${DIRECTION_LABELS[document.direction]}`}
          </p>
        </div>

        {canEdit ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/documents/${document.id}/edit`}>
              <Pencil className="size-4" aria-hidden />
              {COMMON.edit}
            </Link>
          </Button>
        ) : null}
      </div>

      {document.status === "RETURNED" && lastReturn?.note ? (
        <div className="mb-5">
          <Alert tone="danger" title={DOCUMENTS.colReturnNote}>
            {lastReturn.note}
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr] xl:items-start">
        <div className="flex flex-col gap-5">
          <Card className="overflow-hidden">
            <CardHeader title={DOCUMENTS.detailInfo} />

            <div className="flex flex-col gap-5 p-5">
              <div>
                <div className="text-[11px] font-bold tracking-wide text-text-subtle uppercase">
                  {DOCUMENTS.detailSummary}
                </div>
                <p className="mt-1 text-[13.5px] leading-relaxed whitespace-pre-line text-text-medium">
                  {document.summary ?? (
                    <span className="text-text-subtle italic">{DOCUMENTS.noSummary}</span>
                  )}
                </p>
              </div>

              <dl className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
                <Info label={DOCUMENTS.fieldOwnerUnit}>
                  {`${document.ownerUnit.code} · ${document.ownerUnit.shortName ?? document.ownerUnit.nameTh}`}
                </Info>
                <Info label={DOCUMENTS.fieldCreatedBy}>{fullName(document.createdBy)}</Info>
                <Info label={DOCUMENTS.fieldDocDate}>{dateOrDash(document.docDate)}</Info>
                <Info label={DOCUMENTS.fieldDueDate}>{dateOrDash(document.dueDate)}</Info>

                {document.direction === "INCOMING" ? (
                  <>
                    <Info label={DOCUMENTS.fieldExternalSender}>
                      {document.externalSenderName ?? COMMON.none}
                    </Info>
                    <Info label={DOCUMENTS.fieldReceivedDate}>
                      {dateOrDash(document.receivedDate)}
                    </Info>
                  </>
                ) : null}

                {document.direction === "OUTGOING" ? (
                  <Info label={DOCUMENTS.fieldExternalRecipient}>
                    {document.externalRecipientName ?? COMMON.none}
                  </Info>
                ) : null}

                <Info label={DOCUMENTS.fieldRefDocNo}>{document.refDocNo ?? COMMON.none}</Info>
                <Info label={DOCUMENTS.fieldCreatedAt}>
                  {formatThaiDateTime(document.createdAt, "short")}
                </Info>
                <Info label={DOCUMENTS.fieldUpdatedAt}>
                  {formatThaiDateTime(document.updatedAt, "short")}
                </Info>
              </dl>
            </div>
          </Card>

          <DocumentTimeline
            entries={document.actions.map((action) => ({
              id: action.id,
              actionType: action.actionType,
              fromStatus: action.fromStatus,
              toStatus: action.toStatus,
              note: action.note,
              createdAt: action.createdAt,
              actorName: action.actorUser ? fullName(action.actorUser) : null,
              actorUnitName: action.actorUnit
                ? (action.actorUnit.shortName ?? action.actorUnit.nameTh)
                : null,
            }))}
          />
        </div>

        <div className="flex flex-col gap-5">
          <DocumentActionPanel
            documentId={document.id}
            transitions={transitions}
            orgUnits={orgUnits.map((unit) => ({
              id: unit.id,
              code: unit.code,
              label: unit.nameTh,
              level: unit.level,
            }))}
          />

          <AttachmentPanel
            documentId={document.id}
            attachments={document.attachments.map((file) => ({
              id: file.id,
              fileName: file.fileName,
              sizeBytes: file.sizeBytes,
              version: file.version,
              uploadedAt: file.uploadedAt,
              uploadedByName: `${file.uploadedBy.firstName} ${file.uploadedBy.lastName}`.trim(),
            }))}
            canUpload={canUpload}
            canDelete={canUpload}
            maxSizeMb={settings.file.maxSizeMb}
            lockedReason={canUpload ? undefined : DOCUMENTS.attachmentLocked}
          />

          <Card className="overflow-hidden">
            <CardHeader title={DOCUMENTS.detailRecipients} />

            {document.recipients.length === 0 ? (
              <p className="px-5 py-6 text-center text-[12.5px] text-text-subtle">
                {DOCUMENTS.noRecipient}
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5 p-5">
                {document.recipients.map((recipient) => (
                  <li key={recipient.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-text-strong">
                        {recipientName(recipient)}
                      </div>
                      <div className="text-[11px] text-text-subtle">
                        {RECIPIENT_KIND_LABELS[recipient.kind]}
                      </div>
                    </div>

                    <Badge tone={recipient.status === "ACKNOWLEDGED" ? "success" : "neutral"}>
                      {RECIPIENT_STATUS_LABELS[recipient.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// ภายใน
// ---------------------------------------------------------------------------

function BackLink() {
  return (
    <div className="mb-4">
      <Button asChild size="sm" variant="ghost">
        <Link href="/drafts">
          <ArrowLeft className="size-4" aria-hidden />
          {COMMON.back}
        </Link>
      </Button>
    </div>
  )
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold tracking-wide text-text-subtle uppercase">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-text-medium">{children}</dd>
    </div>
  )
}

/** transition ที่ทั้งสถานะและสิทธิ์ของผู้ใช้อนุญาตให้ทำได้ */
function allowedTransitions(ctx: ServiceContext, document: DocumentDetail): DocumentTransition[] {
  const resource = toAuthzResource(document)

  return availableTransitions(document.direction, document.status)
    .filter((transition) => can(ctx, TRANSITION_PERMISSIONS[transition], resource).allowed)
    .filter((transition) => {
      // หนังสือรับที่ออกเลขแล้วยังอยู่ที่ RECEIVED ตาราง transition จึงยังยอมให้ออกเลขซ้ำ
      // — ตัดออกด้วยกติกาเดียวกับที่ service ใช้ ไม่ให้ปุ่มพาผู้ใช้ไปทำสิ่งที่ระบบจะปฏิเสธ
      if (transition === "NUMBER_ISSUED") {
        return canIssueNumber(document.direction, document.status, document.docNo)
      }

      // รับทราบเป็นการกระทำของ "ผู้รับ" ไม่ใช่ของทุกคนที่มีสิทธิ์ (service ตรวจซ้ำอีกชั้น)
      if (transition === "ACKNOWLEDGED") return isRecipient(ctx, document)

      return true
    })
}

/** ผู้ใช้คนนี้เป็นผู้รับของเอกสารฉบับนี้หรือไม่ — ตัวเองหรือหน่วยงานที่สังกัด */
function isRecipient(ctx: ServiceContext, document: DocumentDetail): boolean {
  return document.recipients.some(
    (recipient) =>
      recipient.userId === ctx.userId ||
      (recipient.orgUnitId !== null && ctx.orgUnitIds.includes(recipient.orgUnitId)),
  )
}

function recipientName(recipient: DocumentDetail["recipients"][number]): string {
  if (recipient.orgUnit) return recipient.orgUnit.shortName ?? recipient.orgUnit.nameTh
  if (recipient.user) return fullName(recipient.user)

  return COMMON.none
}

function fullName(user: { prefix?: string | null; firstName: string; lastName: string }): string {
  return `${user.prefix ?? ""}${user.firstName} ${user.lastName}`.trim()
}

function dateOrDash(value: Date | null): string {
  return value ? formatThaiDate(value) : COMMON.none
}

function levelLabel(level: number): string {
  return CONFIDENTIALITY_LEVELS[level]?.label ?? CONFIDENTIALITY_LEVELS[0].label
}
