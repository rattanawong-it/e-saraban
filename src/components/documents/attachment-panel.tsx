"use client"

import { useActionState } from "react"
import { Download, Eye, Loader2, Paperclip, Trash2, Upload } from "lucide-react"

import { DOCUMENTS } from "@/constants"
import { formatThaiDateTime } from "@/lib/thai"
import { formatFileSize } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/field"
import { Alert, Card, CardHeader, EmptyState } from "@/components/ui/primitives"
import { deleteAttachmentAction, uploadAttachmentAction } from "@/server/actions/attachment.actions"
import { IDLE_STATE } from "@/server/actions/types"

// แผงไฟล์แนบของหน้ารายละเอียด (spec §8.3)
//
// ไฟล์เปิดผ่าน /api/files/[id] เท่านั้น — ห้ามลิงก์ตรงถึงไฟล์บนดิสก์
// เพราะทุกครั้งที่เปิดต้องผ่าน can() + ตรวจชั้นความลับ + เขียน audit

export interface AttachmentItem {
  id: string
  fileName: string
  sizeBytes: number
  version: number
  uploadedAt: Date
  uploadedByName: string
}

export function AttachmentPanel({
  documentId,
  attachments,
  canUpload,
  canDelete,
  maxSizeMb,
  lockedReason,
  viewOnly = false,
}: {
  documentId: string
  attachments: AttachmentItem[]
  canUpload: boolean
  canDelete: boolean
  maxSizeMb: number
  lockedReason?: string | undefined
  /** เอกสารชั้นความลับ — เปิดดูได้ แต่ห้ามบันทึกลงเครื่อง (§8.3) */
  viewOnly?: boolean
}) {
  const [uploadState, uploadAction, uploading] = useActionState(uploadAttachmentAction, IDLE_STATE)
  const [deleteState, deleteAction, deleting] = useActionState(deleteAttachmentAction, IDLE_STATE)

  const state = uploadState.status === "idle" ? deleteState : uploadState

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={DOCUMENTS.detailAttachments}
        description={DOCUMENTS.attachmentCount(attachments.length)}
      />

      <div className="flex flex-col gap-3 p-5">
        {state.status !== "idle" && state.message ? (
          <Alert tone={state.status === "error" ? "danger" : "success"} title={state.message} />
        ) : null}

        {viewOnly ? <Alert tone="warning" title={DOCUMENTS.viewOnlyHint} /> : null}

        {attachments.length === 0 ? (
          <EmptyState title={DOCUMENTS.noAttachment} icon={<Paperclip className="size-6" />} />
        ) : (
          <ul className="flex flex-col gap-2">
            {attachments.map((file) => (
              <li
                key={file.id}
                className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2.5"
              >
                <Paperclip className="size-4 shrink-0 text-text-subtle" aria-hidden />

                <div className="min-w-0 flex-1">
                  <div className="truncate text-label font-semibold text-text-strong">
                    {file.fileName}
                  </div>
                  <div className="tabular text-micro text-text-subtle">
                    {DOCUMENTS.attachmentMeta(formatFileSize(file.sizeBytes), file.uploadedByName)}
                    {` · ${DOCUMENTS.versionLabel(file.version)} · ${formatThaiDateTime(file.uploadedAt, "short")}`}
                  </div>
                </div>

                <Button
                  asChild
                  size="icon-sm"
                  variant="ghost"
                  title={viewOnly ? DOCUMENTS.viewOnly : DOCUMENTS.download}
                >
                  {/* เปิดแท็บใหม่ — ผู้ใช้กำลังทำงานกับหน้าเอกสารอยู่ ไม่ควรถูกพาออกไป
                      ⚠️ การซ่อนปุ่มดาวน์โหลดเป็นแค่การบอกทาง ด่านจริงอยู่ที่ Content-Disposition
                      กับ can() ฝั่งเซิร์ฟเวอร์ — UI ห้ามเป็นด่านสุดท้ายของอะไรทั้งนั้น (§10.2) */}
                  <a href={`/api/files/${file.id}`} target="_blank" rel="noopener noreferrer">
                    {viewOnly ? (
                      <Eye className="size-4" aria-hidden />
                    ) : (
                      <Download className="size-4" aria-hidden />
                    )}
                    <span className="sr-only">
                      {viewOnly ? DOCUMENTS.viewOnly : DOCUMENTS.download}
                    </span>
                  </a>
                </Button>

                {canDelete ? (
                  <form action={deleteAction}>
                    <input type="hidden" name="attachmentId" value={file.id} />
                    <input type="hidden" name="documentId" value={documentId} />
                    <Button
                      type="submit"
                      size="icon-sm"
                      variant="ghost"
                      disabled={deleting}
                      title={DOCUMENTS.removeFile}
                    >
                      <Trash2 className="size-4 text-danger-text" aria-hidden />
                      <span className="sr-only">{DOCUMENTS.removeFile}</span>
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canUpload ? (
          <form action={uploadAction} className="flex flex-col gap-2 border-t border-border pt-4">
            <input type="hidden" name="documentId" value={documentId} />

            <Input
              type="file"
              name="file"
              required
              className="text-caption file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-caption file:font-semibold file:text-secondary-foreground"
            />

            <div className="flex items-center justify-between gap-3">
              <p className="text-micro text-text-subtle">{DOCUMENTS.uploadHint(maxSizeMb)}</p>

              <Button type="submit" size="sm" variant="outline" disabled={uploading}>
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Upload className="size-4" aria-hidden />
                )}
                {DOCUMENTS.uploadFile}
              </Button>
            </div>
          </form>
        ) : lockedReason ? (
          <p className="border-t border-border pt-4 text-micro text-text-subtle">{lockedReason}</p>
        ) : null}
      </div>
    </Card>
  )
}
