"use client"

import { useActionState, useState } from "react"
import { Hash, Loader2 } from "lucide-react"

import { DOCUMENTS } from "@/constants"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/primitives"
import { bulkIssueNumberAction } from "@/server/actions/document.actions"
import { IDLE_STATE, type ActionState } from "@/server/actions/types"
import type { DocumentListRow } from "@/server/services/document-list.service"

import { DocumentTable } from "./document-table"

// คิวออกเลข — ติ๊กเลือกหลายฉบับแล้วออกเลขทีเดียว (spec §10.1)
//
// ⚠️ การออกเลขย้อนกลับไม่ได้ (§6.4) หน้านี้จึงไม่มีปุ่ม "ออกเลขทั้งหมด" แบบกดครั้งเดียวจบ
// ผู้ใช้ต้องเลือกเองว่าฉบับไหน — และปุ่มจะบอกจำนวนที่กำลังจะออกเลขเสมอ
//
// ตัวช่องติ๊กใช้ชื่อ `documentId` ทั้งหมด ฟอร์มจึงส่งเป็นหลายค่าในชื่อเดียว
// ตรงกับที่ action อ่านด้วย getAll() — ไม่ต้องแปลงเป็น JSON กลางทาง

export function IssueQueueForm({
  rows,
  emptyMessage,
}: {
  rows: DocumentListRow[]
  emptyMessage: string
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await bulkIssueNumberAction(prev, formData)

      // ฉบับที่ออกเลขแล้วหลุดจากคิวไป การเลือกเดิมจึงชี้ไปที่แถวที่ไม่มีอยู่แล้ว
      if (result.status === "success") setSelectedIds([])

      return result
    },
    IDLE_STATE,
  )

  const toggle = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    )

  const toggleAll = (checked: boolean) => setSelectedIds(checked ? rows.map((row) => row.id) : [])

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.status !== "idle" && state.message ? (
        <Alert tone={state.status === "error" ? "danger" : "success"} title={state.message} />
      ) : null}

      <DocumentTable
        rows={rows}
        variant="queue"
        emptyMessage={emptyMessage}
        selection={{
          selectedIds,
          onToggle: toggle,
          onToggleAll: toggleAll,
          selectAllLabel: DOCUMENTS.selectAll,
        }}
      />

      {rows.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12.5px] text-text-subtle">
            {selectedIds.length > 0
              ? `${DOCUMENTS.selectedCount(selectedIds.length)} · ${DOCUMENTS.queueIrreversible}`
              : DOCUMENTS.selectNone}
          </p>

          <Button type="submit" disabled={pending || selectedIds.length === 0}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Hash className="size-4" aria-hidden />
            )}
            {selectedIds.length > 0
              ? DOCUMENTS.bulkIssue(selectedIds.length)
              : DOCUMENTS.bulkIssueAll}
          </Button>
        </div>
      ) : null}
    </form>
  )
}
