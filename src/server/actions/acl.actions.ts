"use server"

import { revalidatePath } from "next/cache"

import { AUDIT_ENTITY_TYPES } from "@/lib/audit"
import { grantAclSchema, revokeAclSchema } from "@/schemas/acl.schema"

import {
  grantDocumentAcl,
  revokeDocumentAcl,
  searchGrantees,
  type GranteeCandidate,
} from "../services/acl.service"
import { requireSession } from "../session"
import { readOptionalString, readString, toActionError } from "./helpers"
import { errorState, successState, zodErrorState, type ActionState } from "./types"

// ให้/ถอนสิทธิ์เฉพาะรายบนเอกสาร (spec §9.1)
// ตรวจ auth → validate ด้วย Zod → เรียก service → revalidate · ห้ามมี logic ที่นี่

export async function searchGranteesAction(
  _prev: ActionState<GranteeCandidate[]>,
  formData: FormData,
): Promise<ActionState<GranteeCandidate[]>> {
  const session = await requireSession()

  const documentId = readString(formData, "documentId")
  const query = readString(formData, "query")

  if (query.trim().length < 2) {
    return errorState("พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา")
  }

  try {
    const results = await searchGrantees(session.ctx, documentId, query)

    if (results.length === 0) return errorState(`ไม่พบผู้ใช้ที่ตรงกับ "${query}"`)

    return successState(undefined, results)
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "document.acl.search",
      entityType: AUDIT_ENTITY_TYPES.DOCUMENT,
      entityId: documentId,
    })
  }
}

export async function grantAclAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession()

  const expiresAt = readOptionalString(formData, "expiresAt")

  const parsed = grantAclSchema.safeParse({
    documentId: readString(formData, "documentId"),
    userId: readString(formData, "userId"),
    permission: readString(formData, "permission"),
    effect: readString(formData, "effect"),
    ...(expiresAt ? { expiresAt } : {}),
    reason: readString(formData, "reason"),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    await grantDocumentAcl(session.ctx, parsed.data)
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "document.acl.grant",
      entityType: AUDIT_ENTITY_TYPES.DOCUMENT,
      entityId: parsed.data.documentId,
    })
  }

  revalidatePath(`/documents/${parsed.data.documentId}`)
  return successState("ให้สิทธิ์เรียบร้อยแล้ว")
}

export async function revokeAclAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession()

  const parsed = revokeAclSchema.safeParse({
    aclId: readString(formData, "aclId"),
    documentId: readString(formData, "documentId"),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    await revokeDocumentAcl(session.ctx, parsed.data.documentId, parsed.data.aclId)
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "document.acl.revoke",
      entityType: AUDIT_ENTITY_TYPES.DOCUMENT,
      entityId: parsed.data.documentId,
    })
  }

  revalidatePath(`/documents/${parsed.data.documentId}`)
  return successState("ถอนสิทธิ์เรียบร้อยแล้ว")
}
