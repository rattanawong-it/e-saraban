"use client"

import { useActionState, useState } from "react"
import { Ban, CheckCheck, CheckCircle2, Hash, Loader2, Send, Share2, Undo2 } from "lucide-react"

import { COMMON, DOCUMENTS } from "@/constants"
import type { DocumentTransition } from "@/lib/documents/state-machine"
import { Button } from "@/components/ui/button"
import { Field, Textarea } from "@/components/ui/field"
import { Alert, Card, CardHeader } from "@/components/ui/primitives"
import {
  acknowledgeDocumentAction,
  cancelDocumentAction,
  circulateDocumentAction,
  closeDocumentAction,
  forwardDocumentAction,
  issueNumberAction,
  markSentDocumentAction,
  returnDocumentAction,
  submitDocumentAction,
} from "@/server/actions/document.actions"
import { IDLE_STATE, type ActionState } from "@/server/actions/types"

import { OrgUnitPicker, type OrgUnitChoice } from "./org-unit-picker"

// ปุ่มดำเนินการของหน้ารายละเอียด
//
// ⚠️ ที่นี่ **ไม่ตัดสินเองว่าปุ่มไหนขึ้นได้** — หน้าเว็บส่ง transitions ที่ผ่าน
// state machine + can() มาแล้ว (spec §4.3 · §6.1) ที่นี่ทำแค่วาดปุ่มกับรับหมายเหตุ
//
// กดปุ่มแล้วไม่ทำงานทันที แต่กางแผงให้ยืนยันก่อน เพราะ transition ของงานสารบรรณ
// ย้อนกลับไม่ได้ — โดยเฉพาะออกเลขทะเบียนกับยกเลิก (§6.4)

type TransitionAction = (prev: ActionState, formData: FormData) => Promise<ActionState>

interface TransitionSpec {
  label: string
  action: TransitionAction
  Icon: typeof Send
  variant: "default" | "outline" | "danger"
  /** ต้องกรอกหมายเหตุก่อนจึงจะยืนยันได้ */
  noteRequired?: boolean
  /** ต้องเลือกผู้รับอย่างน้อยหนึ่งหน่วยงาน */
  recipientsRequired?: boolean
  warning?: string
}

const SPECS: Record<DocumentTransition, TransitionSpec> = {
  SUBMITTED: {
    label: DOCUMENTS.actionSubmit,
    action: submitDocumentAction,
    Icon: Send,
    variant: "default",
  },
  NUMBER_ISSUED: {
    label: DOCUMENTS.actionIssueNumber,
    action: issueNumberAction,
    Icon: Hash,
    variant: "default",
  },
  RETURNED: {
    label: DOCUMENTS.actionReturn,
    action: returnDocumentAction,
    Icon: Undo2,
    variant: "outline",
    noteRequired: true,
  },
  CIRCULATED: {
    label: DOCUMENTS.actionCirculate,
    action: circulateDocumentAction,
    Icon: Share2,
    variant: "default",
    recipientsRequired: true,
  },
  FORWARDED: {
    label: DOCUMENTS.actionForward,
    action: forwardDocumentAction,
    Icon: Share2,
    variant: "default",
    recipientsRequired: true,
  },
  ACKNOWLEDGED: {
    label: DOCUMENTS.actionAcknowledge,
    action: acknowledgeDocumentAction,
    Icon: CheckCheck,
    variant: "default",
  },
  MARKED_SENT: {
    label: DOCUMENTS.actionMarkSent,
    action: markSentDocumentAction,
    Icon: Send,
    variant: "default",
  },
  CLOSED: {
    label: DOCUMENTS.actionClose,
    action: closeDocumentAction,
    Icon: CheckCircle2,
    variant: "outline",
  },
  CANCELLED: {
    label: DOCUMENTS.actionCancel,
    action: cancelDocumentAction,
    Icon: Ban,
    variant: "danger",
    noteRequired: true,
    warning: DOCUMENTS.cancelWarning,
  },
}

export function DocumentActionPanel({
  documentId,
  transitions,
  orgUnits,
}: {
  documentId: string
  transitions: DocumentTransition[]
  orgUnits: OrgUnitChoice[]
}) {
  const [selected, setSelected] = useState<DocumentTransition | null>(null)

  // ส่งต่อไปยัง action ของ transition ที่เลือกอยู่ — ห่อไว้ชั้นเดียวเพื่อให้ใช้
  // useActionState ตัวเดียวคุมได้ทุกปุ่ม แทนที่จะประกาศ hook แยกรายปุ่ม
  const [state, formAction, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const transition = formData.get("transition")
      const spec = typeof transition === "string" ? SPECS[transition as DocumentTransition] : null

      if (!spec) return prev

      const result = await spec.action(prev, formData)
      if (result.status === "success") setSelected(null)

      return result
    },
    IDLE_STATE,
  )

  const spec = selected ? SPECS[selected] : null

  return (
    <Card className="overflow-hidden">
      <CardHeader title={DOCUMENTS.detailActions} />

      <div className="flex flex-col gap-3 p-5">
        {state.status !== "idle" && state.message ? (
          <Alert tone={state.status === "error" ? "danger" : "success"} title={state.message} />
        ) : null}

        {transitions.length === 0 ? (
          <p className="text-caption text-text-subtle">{DOCUMENTS.actionEmpty}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {transitions.map((transition) => {
              const item = SPECS[transition]

              return (
                <Button
                  key={transition}
                  type="button"
                  variant={selected === transition ? "secondary" : item.variant}
                  block
                  onClick={() => setSelected(selected === transition ? null : transition)}
                >
                  <item.Icon className="size-4" aria-hidden />
                  {item.label}
                </Button>
              )
            })}
          </div>
        )}

        {spec && selected ? (
          <form action={formAction} className="flex flex-col gap-3 border-t border-border pt-4">
            <input type="hidden" name="id" value={documentId} />
            <input type="hidden" name="transition" value={selected} />

            {spec.warning ? <Alert tone="warning" title={spec.warning} /> : null}

            {spec.recipientsRequired ? (
              <OrgUnitPicker units={orgUnits} label={DOCUMENTS.actionRecipients} required />
            ) : null}

            <Field
              label={spec.noteRequired ? DOCUMENTS.noteRequired : DOCUMENTS.actionNote}
              htmlFor="note"
              hint={DOCUMENTS.actionNoteHint}
              errors={state.fieldErrors?.note}
            >
              <Textarea
                id="note"
                name="note"
                rows={3}
                maxLength={1000}
                required={spec.noteRequired}
              />
            </Field>

            <input type="hidden" name="recipientKind" value="TO" />

            <div className="flex gap-2">
              <Button type="submit" variant={spec.variant} disabled={pending} block>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <spec.Icon className="size-4" aria-hidden />
                )}
                {DOCUMENTS.actionConfirm}
              </Button>

              <Button type="button" variant="ghost" onClick={() => setSelected(null)}>
                {COMMON.cancel}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </Card>
  )
}
