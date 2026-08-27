import Link from "next/link"
import { Paperclip, Users } from "lucide-react"

import { CONFIDENTIALITY_LEVELS, DOCUMENTS, URGENCY_LEVELS } from "@/constants"
import { formatThaiDate, formatThaiDateTime } from "@/lib/thai"
import { cn } from "@/lib/utils"
import { STATUS_LABELS, type DocumentStatusValue } from "@/schemas/document.schema"
import { Checkbox } from "@/components/ui/field"
import { Badge, ConfidentialityBadge, Card, EmptyState } from "@/components/ui/primitives"
import type { DocumentListRow } from "@/server/services/document-list.service"

// ตารางรายการเอกสารที่ใช้ร่วมกันทุกกล่อง — ตาม project-ui/{Drafts,Inbox,Outbox}.dc.html
//
// สามกล่องใช้คอลัมน์ไม่เหมือนกันแต่โครงเดียวกัน จึงทำเป็นตารางเดียวที่สลับคอลัมน์ตาม variant
// ดีกว่าก๊อปตารางสามรอบแล้วต้องไล่แก้ทุกที่เมื่อสถานะหรือป้ายเปลี่ยน

export type DocumentTableVariant = "drafts" | "inbox" | "outbox" | "queue" | "registry"

/**
 * เลือกหลายแถวเพื่อสั่งงานทีเดียว (ใช้ที่หน้าคิวออกเลข)
 *
 * ช่องติ๊กชื่อ `documentId` ทั้งหมด — ฟอร์มจึงส่งค่ามาเป็นหลายค่าในชื่อเดียว
 * ตรงกับที่ `bulkIssueNumberAction` อ่านด้วย `formData.getAll("documentId")`
 */
export interface DocumentTableSelection {
  selectedIds: readonly string[]
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
  selectAllLabel: string
}

/** สีของป้ายสถานะ — ให้ผู้ใช้กวาดตาเห็นได้ว่าฉบับไหนต้องลงมือทำ */
const STATUS_TONES: Record<
  DocumentStatusValue,
  "neutral" | "brand" | "success" | "warning" | "danger" | "info"
> = {
  DRAFT: "neutral",
  PENDING_NUMBER: "warning",
  RETURNED: "danger",
  REGISTERED: "brand",
  CIRCULATING: "info",
  SENT: "info",
  RECEIVED: "info",
  FORWARDED: "info",
  CLOSED: "success",
  CANCELLED: "neutral",
}

export function DocumentStatusBadge({ status }: { status: DocumentStatusValue }) {
  return (
    <Badge tone={STATUS_TONES[status]} dot>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

export function DocumentTable({
  rows,
  variant,
  emptyMessage,
  selection,
}: {
  rows: DocumentListRow[]
  variant: DocumentTableVariant
  emptyMessage: string
  selection?: DocumentTableSelection | undefined
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState title={emptyMessage} />
      </Card>
    )
  }

  const columns = COLUMNS[variant]
  const allSelected = selection
    ? rows.every((row) => selection.selectedIds.includes(row.id))
    : false

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-sunken">
              {selection ? (
                <th scope="col" className="w-12 px-5 py-3">
                  <Checkbox
                    checked={allSelected}
                    onChange={(event) => selection.onToggleAll(event.target.checked)}
                    aria-label={selection.selectAllLabel}
                  />
                </th>
              ) : null}

              {columns.map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="px-5 py-3 text-left text-micro font-bold tracking-wide text-text-subtle uppercase"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-row-border transition-colors last:border-b-0 hover:bg-muted/60"
              >
                {selection ? (
                  <td className="px-5 py-3">
                    <Checkbox
                      name="documentId"
                      value={row.id}
                      checked={selection.selectedIds.includes(row.id)}
                      onChange={() => selection.onToggle(row.id)}
                      aria-label={row.subject}
                    />
                  </td>
                ) : null}

                <td className="max-w-lg px-5 py-3">
                  <Link
                    href={`/documents/${row.id}`}
                    className="block truncate text-label font-semibold text-text-strong hover:text-primary hover:underline"
                  >
                    {row.subject}
                  </Link>
                  <div className="tabular mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-micro text-text-subtle">
                    <span className={cn(!row.docNo && "italic")}>
                      {row.docNo ?? DOCUMENTS.noDocNo}
                    </span>
                    {row.attachmentCount > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Paperclip className="size-3" aria-hidden />
                        {DOCUMENTS.attachmentCount(row.attachmentCount)}
                      </span>
                    ) : null}
                    {row.recipientCount > 0 && variant !== "drafts" ? (
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" aria-hidden />
                        {DOCUMENTS.recipientCount(row.recipientCount)}
                      </span>
                    ) : null}
                  </div>
                </td>

                {variant === "drafts" ? (
                  <>
                    <td className="px-5 py-3 text-caption text-text-medium">
                      {row.documentTypeName}
                    </td>
                    <td className="px-5 py-3">
                      <DocumentStatusBadge status={row.status} />
                    </td>
                    <td className="tabular px-5 py-3 text-caption whitespace-nowrap text-text-medium">
                      {formatThaiDateTime(row.updatedAt, "short")}
                    </td>
                    <td className="max-w-xs px-5 py-3 text-caption text-danger-text">
                      {row.lastReturnNote ? (
                        <span className="line-clamp-2">{row.lastReturnNote}</span>
                      ) : (
                        <span className="text-text-subtle">—</span>
                      )}
                    </td>
                  </>
                ) : null}

                {variant === "inbox" ? (
                  <>
                    <td className="px-5 py-3 text-caption text-text-medium">
                      {row.externalSenderName ?? row.ownerUnitName}
                    </td>
                    <td className="tabular px-5 py-3 text-caption whitespace-nowrap text-text-medium">
                      {formatThaiDate(row.receivedDate ?? row.docDate ?? row.updatedAt, "short")}
                    </td>
                    <td className="px-5 py-3">
                      <ConfidentialityBadge
                        level={row.confidentialityLevel}
                        label={levelLabel(row.confidentialityLevel)}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <DocumentStatusBadge status={row.status} />
                    </td>
                  </>
                ) : null}

                {variant === "outbox" || variant === "registry" ? (
                  <>
                    <td className="px-5 py-3 text-caption text-text-medium">
                      {row.externalRecipientName ??
                        (row.recipientCount > 0
                          ? DOCUMENTS.recipientCount(row.recipientCount)
                          : row.ownerUnitName)}
                    </td>
                    <td className="px-5 py-3">
                      <ConfidentialityBadge
                        level={row.confidentialityLevel}
                        label={levelLabel(row.confidentialityLevel)}
                      />
                    </td>
                    <td className="tabular px-5 py-3 text-caption whitespace-nowrap text-text-medium">
                      {row.docDate ? formatThaiDate(row.docDate, "short") : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <DocumentStatusBadge status={row.status} />
                    </td>
                  </>
                ) : null}

                {variant === "queue" ? (
                  <>
                    <td className="px-5 py-3 text-caption text-text-medium">
                      {row.ownerUnitName}
                      <div className="text-micro text-text-subtle">{row.createdByName}</div>
                    </td>
                    <td className="px-5 py-3">
                      {row.urgencyLevel > 0 ? (
                        <Badge tone={row.urgencyLevel >= 2 ? "danger" : "warning"}>
                          {URGENCY_LEVELS[row.urgencyLevel]?.label ?? ""}
                        </Badge>
                      ) : (
                        <span className="text-caption text-text-subtle">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <ConfidentialityBadge
                        level={row.confidentialityLevel}
                        label={levelLabel(row.confidentialityLevel)}
                      />
                    </td>
                    <td className="tabular px-5 py-3 text-caption whitespace-nowrap text-text-medium">
                      {formatThaiDateTime(row.updatedAt, "short")}
                    </td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

const COLUMNS: Record<DocumentTableVariant, string[]> = {
  drafts: [
    DOCUMENTS.colSubject,
    DOCUMENTS.colType,
    DOCUMENTS.colStatus,
    DOCUMENTS.colUpdated,
    DOCUMENTS.colReturnNote,
  ],
  inbox: [
    DOCUMENTS.colSubject,
    DOCUMENTS.colSender,
    DOCUMENTS.colDate,
    DOCUMENTS.colConfidentiality,
    DOCUMENTS.colStatus,
  ],
  outbox: [
    DOCUMENTS.colSubject,
    DOCUMENTS.colRecipient,
    DOCUMENTS.colConfidentiality,
    DOCUMENTS.colSentDate,
    DOCUMENTS.colStatus,
  ],
  registry: [
    DOCUMENTS.colSubject,
    DOCUMENTS.colRecipient,
    DOCUMENTS.colConfidentiality,
    DOCUMENTS.colSentDate,
    DOCUMENTS.colStatus,
  ],
  queue: [
    DOCUMENTS.colSubject,
    DOCUMENTS.colOwnerUnit,
    "ความเร่งด่วน",
    DOCUMENTS.colConfidentiality,
    DOCUMENTS.colWaiting,
  ],
}

function levelLabel(level: number): string {
  return CONFIDENTIALITY_LEVELS[level]?.label ?? CONFIDENTIALITY_LEVELS[0].label
}
