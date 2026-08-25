"use server"

import { revalidatePath } from "next/cache"

import { AUDIT_ENTITY_TYPES } from "@/lib/audit"

import { deleteAttachment, uploadAttachment } from "../services/attachment.service"
import { requireSession } from "../session"
import { readOptionalString, readString, toActionError } from "./helpers"
import { errorState, successState, type ActionState } from "./types"

// อัปโหลด/ลบไฟล์แนบ — ตรวจ auth → อ่านไฟล์ → เรียก service → revalidate
//
// ⚠️ ขนาดสูงสุดของ Server Action ตั้งไว้ที่ 52MB ใน next.config.ts เพื่อรับไฟล์ 50MB ตาม §8.3
// ถ้าเกิน Next จะปฏิเสธตั้งแต่ก่อนเข้ามาถึงที่นี่ ผู้ใช้จะเห็นเป็น error ของเบราว์เซอร์

export async function uploadAttachmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession()

  const documentId = readString(formData, "documentId")
  const file = formData.get("file")

  if (!(file instanceof File) || file.size === 0) {
    return errorState("กรุณาเลือกไฟล์ที่ต้องการแนบ")
  }

  try {
    await uploadAttachment(session.ctx, {
      documentId,
      fileName: file.name,
      mimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
      note: readOptionalString(formData, "note"),
    })
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "attachment.upload",
      entityType: AUDIT_ENTITY_TYPES.ATTACHMENT,
      entityId: documentId,
    })
  }

  revalidatePath(`/documents/${documentId}`)
  return successState(`แนบไฟล์ "${file.name}" เรียบร้อยแล้ว`)
}

export async function deleteAttachmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession()

  const attachmentId = readString(formData, "attachmentId")
  const documentId = readString(formData, "documentId")

  try {
    await deleteAttachment(session.ctx, attachmentId, readOptionalString(formData, "note"))
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "attachment.delete",
      entityType: AUDIT_ENTITY_TYPES.ATTACHMENT,
      entityId: attachmentId,
    })
  }

  revalidatePath(`/documents/${documentId}`)
  return successState("ลบไฟล์แนบแล้ว")
}
