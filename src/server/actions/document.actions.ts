"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { AUDIT_ENTITY_TYPES } from "@/lib/audit"
import {
  circulateDocumentSchema,
  createDocumentSchema,
  documentNoteSchema,
  registerIncomingSchema,
  returnDocumentSchema,
  updateDocumentSchema,
} from "@/schemas/document.schema"

import {
  acknowledgeDocument,
  cancelDocument,
  circulateDocument,
  closeDocument,
  createDocument,
  forwardDocument,
  markSentDocument,
  registerIncoming,
  returnDocument,
  submitDocument,
  updateDocument,
} from "../services/document.service"
import { issueNumber } from "../services/numbering.service"
import { requireSession } from "../session"
import { readOptionalString, readString, toActionError } from "./helpers"
import { errorState, successState, zodErrorState, type ActionState } from "./types"

// Server Action ของเอกสาร — ตาม spec §11.3 ข้อ 1:
// "ทำแค่ ตรวจ auth → validate ด้วย Zod → เรียก service → revalidate"
// **ห้ามมี business logic ที่นี่** กติกาสถานะทั้งหมดอยู่ใน state machine

/** อ่านผู้รับจากฟอร์ม — ช่องเดียวส่งได้หลายค่า (checkbox/multi-select) */
function readRecipients(formData: FormData) {
  const orgUnitIds = formData.getAll("recipientOrgUnitId").filter((v): v is string => v !== null)
  const userIds = formData.getAll("recipientUserId").filter((v): v is string => v !== null)
  const kind = readString(formData, "recipientKind") || "TO"

  return [
    ...orgUnitIds.filter(Boolean).map((orgUnitId) => ({ orgUnitId, kind })),
    ...userIds.filter(Boolean).map((userId) => ({ userId, kind })),
  ]
}

function readDocumentFields(formData: FormData) {
  return {
    documentTypeId: readString(formData, "documentTypeId"),
    subject: readString(formData, "subject"),
    summary: readOptionalString(formData, "summary"),
    docDate: readOptionalString(formData, "docDate"),
    dueDate: readOptionalString(formData, "dueDate"),
    confidentialityLevel: readString(formData, "confidentialityLevel") || 0,
    urgencyLevel: readString(formData, "urgencyLevel") || 0,
    externalSenderName: readOptionalString(formData, "externalSenderName"),
    externalRecipientName: readOptionalString(formData, "externalRecipientName"),
    refDocNo: readOptionalString(formData, "refDocNo"),
    parentDocumentId: readOptionalString(formData, "parentDocumentId"),
  }
}

export async function createDocumentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession()

  const parsed = createDocumentSchema.safeParse({
    ...readDocumentFields(formData),
    ownerUnitId: readOptionalString(formData, "ownerUnitId"),
    recipients: readRecipients(formData),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  let documentId: string

  try {
    const document = await createDocument(session.ctx, parsed.data)
    documentId = document.id
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "document.create",
      entityType: AUDIT_ENTITY_TYPES.DOCUMENT,
    })
  }

  revalidatePath("/drafts")
  // redirect ต้องอยู่นอก try — Next ใช้ error พิเศษในการเปลี่ยนหน้า ถ้าอยู่ในนั้นจะถูก catch กลืน
  redirect(`/documents/${documentId}`)
}

export async function registerIncomingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession()

  const parsed = registerIncomingSchema.safeParse({
    ...readDocumentFields(formData),
    ownerUnitId: readOptionalString(formData, "ownerUnitId"),
    receivedDate: readOptionalString(formData, "receivedDate"),
    externalSenderName: readString(formData, "externalSenderName"),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  let documentId: string

  try {
    const result = await registerIncoming(session.ctx, parsed.data)
    documentId = result.document.id
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "document.incoming.register",
      entityType: AUDIT_ENTITY_TYPES.DOCUMENT,
    })
  }

  revalidatePath("/registry/incoming")
  redirect(`/documents/${documentId}`)
}

export async function updateDocumentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession()

  const parsed = updateDocumentSchema.safeParse({
    id: readString(formData, "id"),
    ...readDocumentFields(formData),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    await updateDocument(session.ctx, parsed.data)
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "document.update",
      entityType: AUDIT_ENTITY_TYPES.DOCUMENT,
      entityId: parsed.data.id,
    })
  }

  revalidateDocument(parsed.data.id)
  return successState("บันทึกการแก้ไขเรียบร้อยแล้ว")
}

/** transition ที่ใช้ฟอร์มหน้าตาเดียวกันหมด — id + หมายเหตุ */
function makeNoteAction(
  auditAction: string,
  run: (
    ctx: Awaited<ReturnType<typeof requireSession>>["ctx"],
    id: string,
    note?: string,
  ) => Promise<unknown>,
  successMessage: string,
) {
  return async function action(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const session = await requireSession()

    const parsed = documentNoteSchema.safeParse({
      id: readString(formData, "id"),
      note: readOptionalString(formData, "note"),
    })

    if (!parsed.success) return zodErrorState(parsed.error)

    try {
      await run(session.ctx, parsed.data.id, parsed.data.note)
    } catch (error) {
      return toActionError(error, {
        ctx: session.ctx,
        action: auditAction,
        entityType: AUDIT_ENTITY_TYPES.DOCUMENT,
        entityId: parsed.data.id,
      })
    }

    revalidateDocument(parsed.data.id)
    return successState(successMessage)
  }
}

export const submitDocumentAction = makeNoteAction(
  "document.submit",
  (ctx, id, note) => submitDocument(ctx, id, note),
  "ส่งให้สารบรรณออกเลขแล้ว",
)

export const issueNumberAction = makeNoteAction(
  "document.number.issue",
  (ctx, id, note) => issueNumber(ctx, id, { note }),
  "ออกเลขทะเบียนเรียบร้อยแล้ว",
)

export const markSentDocumentAction = makeNoteAction(
  "document.send.external",
  (ctx, id, note) => markSentDocument(ctx, id, note),
  "บันทึกว่าส่งออกแล้ว",
)

export const acknowledgeDocumentAction = makeNoteAction(
  "document.acknowledge",
  (ctx, id, note) => acknowledgeDocument(ctx, id, note),
  "บันทึกการรับทราบแล้ว",
)

export const closeDocumentAction = makeNoteAction(
  "document.close",
  (ctx, id, note) => closeDocument(ctx, id, note),
  "ปิดเรื่องเรียบร้อยแล้ว",
)

export const cancelDocumentAction = makeNoteAction(
  "document.cancel",
  (ctx, id, note) => cancelDocument(ctx, id, note),
  "ยกเลิกเอกสารแล้ว — เลขทะเบียนที่ออกไปแล้วจะไม่ถูกนำกลับมาใช้ซ้ำ",
)

export async function returnDocumentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession()

  const parsed = returnDocumentSchema.safeParse({
    id: readString(formData, "id"),
    note: readString(formData, "note"),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    await returnDocument(session.ctx, parsed.data.id, parsed.data.note)
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "document.return",
      entityType: AUDIT_ENTITY_TYPES.DOCUMENT,
      entityId: parsed.data.id,
    })
  }

  revalidateDocument(parsed.data.id)
  return successState("ตีกลับให้แก้ไขแล้ว")
}

export async function circulateDocumentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession()

  const parsed = circulateDocumentSchema.safeParse({
    id: readString(formData, "id"),
    recipients: readRecipients(formData),
    note: readOptionalString(formData, "note"),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    await circulateDocument(session.ctx, parsed.data.id, parsed.data.recipients, parsed.data.note)
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "document.circulate",
      entityType: AUDIT_ENTITY_TYPES.DOCUMENT,
      entityId: parsed.data.id,
    })
  }

  revalidateDocument(parsed.data.id)
  return successState("เวียนหนังสือเรียบร้อยแล้ว")
}

export async function forwardDocumentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession()

  const parsed = circulateDocumentSchema.safeParse({
    id: readString(formData, "id"),
    recipients: readRecipients(formData),
    note: readOptionalString(formData, "note"),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    await forwardDocument(session.ctx, parsed.data.id, parsed.data.recipients, parsed.data.note)
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "document.forward",
      entityType: AUDIT_ENTITY_TYPES.DOCUMENT,
      entityId: parsed.data.id,
    })
  }

  revalidateDocument(parsed.data.id)
  return successState("ส่งต่อหนังสือเรียบร้อยแล้ว")
}

/** ออกเลขทีละหลายฉบับจากหน้าคิว (spec §10.1 — bulk issue) */
export async function bulkIssueNumberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession()

  const ids = formData.getAll("documentId").filter((value): value is string => Boolean(value))

  if (ids.length === 0) return errorState("กรุณาเลือกอย่างน้อยหนึ่งฉบับ")

  let issued = 0
  const failures: string[] = []

  // ทำทีละฉบับโดยตั้งใจ ไม่ใช่ Promise.all — ตัวนับเลขถูกล็อกทีละฉบับอยู่แล้ว
  // การยิงพร้อมกันจึงได้แค่คิวที่ยาวขึ้น แต่ทำให้บอกไม่ได้ว่าฉบับไหนพลาดเพราะอะไร
  for (const id of ids) {
    try {
      await issueNumber(session.ctx, id)
      issued += 1
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error))
    }
  }

  revalidatePath("/registry/outgoing")
  revalidatePath("/outbox")

  if (issued === 0) {
    return errorState(`ออกเลขไม่สำเร็จ — ${failures[0] ?? "ไม่ทราบสาเหตุ"}`)
  }

  return successState(
    failures.length === 0
      ? `ออกเลขเรียบร้อย ${issued} ฉบับ`
      : `ออกเลขสำเร็จ ${issued} ฉบับ · ไม่สำเร็จ ${failures.length} ฉบับ (${failures[0]})`,
  )
}

function revalidateDocument(id: string) {
  revalidatePath(`/documents/${id}`)
  revalidatePath("/drafts")
  revalidatePath("/inbox")
  revalidatePath("/outbox")
  revalidatePath("/registry/outgoing")
}
