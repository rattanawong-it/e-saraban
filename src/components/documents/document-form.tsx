"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { Loader2, Save } from "lucide-react"

import { COMMON, CONFIDENTIALITY_LEVELS, DOCUMENTS, URGENCY_LEVELS } from "@/constants"
import { cn } from "@/lib/utils"
import { DIRECTION_LABELS, type DocumentDirectionValue } from "@/schemas/document.schema"
import { Button } from "@/components/ui/button"
import { Field, Select, Textarea, TextInput } from "@/components/ui/field"
import { Alert, Card, CardHeader } from "@/components/ui/primitives"

import { OrgUnitPicker, type OrgUnitChoice } from "./org-unit-picker"
import {
  createDocumentAction,
  registerIncomingAction,
  updateDocumentAction,
} from "@/server/actions/document.actions"
import { IDLE_STATE } from "@/server/actions/types"

// ฟอร์มหนังสือ — ใช้ทั้งตอนสร้างร่างและตอนแก้ไขร่าง (ตาม project-ui/Create Document.dc.html)
//
// สองโหมดใช้ช่องกรอกชุดเดียวกันทั้งหมด ต่างกันแค่สามอย่าง: action ที่ยิง ·
// การ์ดผู้รับ (มีเฉพาะตอนสร้าง เพราะแก้ไขผู้รับทำที่ปุ่มเวียนหนังสือ) · ปลายทางตอนกดยกเลิก
// จึงคุ้มกว่าที่จะรวมเป็นคอมโพเนนต์เดียว ไม่งั้นเพิ่มช่องกรอกทีต้องไล่แก้สองที่
//
// ⚠️ แก้ไขได้เฉพาะ DRAFT/RETURNED (§6.4) — ด่านจริงอยู่ที่ service
// หน้าเว็บมีหน้าที่แค่ไม่พาผู้ใช้ไปเจอทางตัน

export interface DocumentTypeOption {
  id: string
  nameTh: string
  direction: DocumentDirectionValue
}

export interface DocumentFormValues {
  documentTypeId: string
  subject: string
  summary: string
  externalRecipientName: string
  externalSenderName: string
  /** รูปแบบ YYYY-MM-DD ตามที่ <input type="date"> ต้องการ */
  docDate: string
  receivedDate: string
  dueDate: string
  refDocNo: string
  confidentialityLevel: number
  urgencyLevel: number
  /** หนังสือต้นเรื่องของสายสนทนา — ไม่มีช่องให้แก้ แต่ต้องส่งกลับไปด้วยไม่งั้นจะถูกล้างทิ้ง */
  parentDocumentId: string
}

const EMPTY_VALUES: DocumentFormValues = {
  documentTypeId: "",
  subject: "",
  summary: "",
  externalRecipientName: "",
  externalSenderName: "",
  docDate: "",
  receivedDate: "",
  dueDate: "",
  refDocNo: "",
  confidentialityLevel: 0,
  urgencyLevel: 0,
  parentDocumentId: "",
}

type DocumentFormProps = { documentTypes: DocumentTypeOption[]; ownerUnitName: string } & (
  | { mode: "create"; orgUnits: OrgUnitChoice[]; values?: undefined }
  | { mode: "edit"; documentId: string; values: DocumentFormValues }
  // ลงทะเบียนหนังสือรับ — ค่าตั้งต้นมาจากฝั่ง server (วันที่รับ = วันนี้ตามเวลาไทย)
  | { mode: "incoming"; values: DocumentFormValues }
)

const ACTIONS = {
  create: createDocumentAction,
  edit: updateDocumentAction,
  incoming: registerIncomingAction,
}

export function DocumentForm(props: DocumentFormProps) {
  const { documentTypes, ownerUnitName } = props
  const isEdit = props.mode === "edit"
  const isIncoming = props.mode === "incoming"
  const values = props.values ?? EMPTY_VALUES

  const [state, formAction, pending] = useActionState(ACTIONS[props.mode], IDLE_STATE)

  const [documentTypeId, setDocumentTypeId] = useState(
    values.documentTypeId || (documentTypes[0]?.id ?? ""),
  )

  const selectedType = documentTypes.find((type) => type.id === documentTypeId)
  const isOutgoing = selectedType?.direction === "OUTGOING"

  const cancelHref =
    props.mode === "edit"
      ? `/documents/${props.documentId}`
      : props.mode === "incoming"
        ? "/registry/incoming"
        : "/drafts"

  return (
    <form action={formAction} className="grid gap-5 xl:grid-cols-[2fr_1fr] xl:items-start">
      <div className="flex flex-col gap-5">
        <Card className="overflow-hidden">
          <CardHeader
            title={DOCUMENTS.formSection}
            description={DOCUMENTS.formOwner(ownerUnitName)}
          />

          <div className="flex flex-col gap-4 p-5">
            {props.mode === "edit" ? (
              <input type="hidden" name="id" value={props.documentId} />
            ) : null}

            {values.parentDocumentId ? (
              <input type="hidden" name="parentDocumentId" value={values.parentDocumentId} />
            ) : null}

            {/* ช่องที่โหมดนี้ไม่ได้แสดง ต้องส่งค่าเดิมกลับไปด้วย ไม่งั้น service จะเขียนทับเป็น null */}
            {!isIncoming && values.externalSenderName ? (
              <input type="hidden" name="externalSenderName" value={values.externalSenderName} />
            ) : null}

            {state.status !== "idle" && state.message ? (
              <Alert tone={state.status === "error" ? "danger" : "success"} title={state.message} />
            ) : null}

            <Field
              label={DOCUMENTS.fieldType}
              htmlFor="documentTypeId"
              errors={state.fieldErrors?.documentTypeId}
              hint={isEdit ? DOCUMENTS.editTypeHint : undefined}
            >
              <Select
                id="documentTypeId"
                name="documentTypeId"
                value={documentTypeId}
                onChange={(event) => setDocumentTypeId(event.target.value)}
              >
                {documentTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {`${type.nameTh} · ${DIRECTION_LABELS[type.direction]}`}
                  </option>
                ))}
              </Select>
            </Field>

            {isIncoming ? (
              <Field
                label={DOCUMENTS.fieldExternalSender}
                htmlFor="externalSenderName"
                errors={state.fieldErrors?.externalSenderName}
              >
                <TextInput
                  id="externalSenderName"
                  name="externalSenderName"
                  required
                  maxLength={200}
                  defaultValue={values.externalSenderName}
                />
              </Field>
            ) : null}

            <Field
              label={DOCUMENTS.fieldSubject}
              htmlFor="subject"
              errors={state.fieldErrors?.subject}
            >
              <TextInput
                id="subject"
                name="subject"
                required
                maxLength={500}
                defaultValue={values.subject}
              />
            </Field>

            <Field
              label={DOCUMENTS.fieldSummary}
              htmlFor="summary"
              errors={state.fieldErrors?.summary}
            >
              <Textarea
                id="summary"
                name="summary"
                rows={4}
                maxLength={2000}
                defaultValue={values.summary}
              />
            </Field>

            {isOutgoing ? (
              <Field
                label={DOCUMENTS.fieldExternalRecipient}
                htmlFor="externalRecipientName"
                errors={state.fieldErrors?.externalRecipientName}
              >
                <TextInput
                  id="externalRecipientName"
                  name="externalRecipientName"
                  defaultValue={values.externalRecipientName}
                />
              </Field>
            ) : null}

            <div className={cn("grid gap-4", isIncoming ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
              {isIncoming ? (
                <Field label={DOCUMENTS.fieldReceivedDate} htmlFor="receivedDate">
                  <TextInput
                    id="receivedDate"
                    name="receivedDate"
                    type="date"
                    defaultValue={values.receivedDate}
                  />
                </Field>
              ) : null}

              <Field label={DOCUMENTS.fieldDocDate} htmlFor="docDate">
                <TextInput id="docDate" name="docDate" type="date" defaultValue={values.docDate} />
              </Field>
              <Field label={DOCUMENTS.fieldDueDate} htmlFor="dueDate">
                <TextInput id="dueDate" name="dueDate" type="date" defaultValue={values.dueDate} />
              </Field>
            </div>

            <Field label={DOCUMENTS.fieldRefDocNo} htmlFor="refDocNo">
              <TextInput
                id="refDocNo"
                name="refDocNo"
                className="tabular"
                defaultValue={values.refDocNo}
              />
            </Field>
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-5">
        <Card className="overflow-hidden">
          <CardHeader title={DOCUMENTS.sectionLevels} />

          <div className="flex flex-col gap-4 p-5">
            <Field label={DOCUMENTS.fieldConfidentiality} htmlFor="confidentialityLevel">
              <Select
                id="confidentialityLevel"
                name="confidentialityLevel"
                defaultValue={String(values.confidentialityLevel)}
              >
                {CONFIDENTIALITY_LEVELS.map((item) => (
                  <option key={item.level} value={item.level}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={DOCUMENTS.fieldUrgency} htmlFor="urgencyLevel">
              <Select
                id="urgencyLevel"
                name="urgencyLevel"
                defaultValue={String(values.urgencyLevel)}
              >
                {URGENCY_LEVELS.map((item) => (
                  <option key={item.level} value={item.level}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>

            {isEdit ? null : (
              <p className="text-[11.5px] leading-relaxed text-text-subtle">
                {isIncoming ? DOCUMENTS.incomingNumberHint : DOCUMENTS.attachAfterSaveHint}
              </p>
            )}
          </div>
        </Card>

        {props.mode === "create" ? (
          <Card className="overflow-hidden">
            <CardHeader
              title={DOCUMENTS.sectionRecipients}
              description={DOCUMENTS.sectionRecipientsHint}
            />

            <div className="flex flex-col gap-3 p-5">
              <OrgUnitPicker units={props.orgUnits} label={DOCUMENTS.fieldRecipientUnits} />

              <input type="hidden" name="recipientKind" value="TO" />
            </div>
          </Card>
        ) : null}

        <div className="flex gap-2.5">
          <Button type="submit" disabled={pending} block>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            {isEdit
              ? COMMON.saveChanges
              : isIncoming
                ? DOCUMENTS.registerIncoming
                : DOCUMENTS.saveDraft}
          </Button>
          <Button asChild variant="ghost">
            <Link href={cancelHref}>{COMMON.cancel}</Link>
          </Button>
        </div>

        <p className="text-center text-[11.5px] text-text-subtle">
          {isEdit
            ? DOCUMENTS.editHint
            : isIncoming
              ? DOCUMENTS.registerIncomingDescription
              : DOCUMENTS.draftsDescription}
        </p>
      </div>
    </form>
  )
}
