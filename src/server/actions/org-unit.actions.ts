"use server"

import { revalidatePath } from "next/cache"

import { PERMISSIONS } from "@/lib/authz"
import {
  archiveOrgUnitSchema,
  createOrgUnitSchema,
  moveOrgUnitSchema,
  updateOrgUnitSchema,
} from "@/schemas/org-unit.schema"

import {
  createOrgUnit,
  moveOrgUnit,
  setOrgUnitActive,
  updateOrgUnit,
} from "../services/org-unit.service"
import { requirePermission } from "../session"
import { readCheckbox, readOptionalString, readString, toActionError } from "./helpers"
import { successState, zodErrorState, type ActionState } from "./types"

const ADMIN_ORG_UNITS = "/admin/org-units"

export async function createOrgUnitAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission(PERMISSIONS.ORGUNIT_MANAGE)

  const parsed = createOrgUnitSchema.safeParse({
    parentId: readOptionalString(formData, "parentId") ?? null,
    code: readString(formData, "code"),
    nameTh: readString(formData, "nameTh"),
    shortName: readOptionalString(formData, "shortName"),
    type: readString(formData, "type"),
    headUserId: readOptionalString(formData, "headUserId") ?? null,
    sortOrder: readString(formData, "sortOrder") || 0,
    canIssueNumber: readCheckbox(formData, "canIssueNumber"),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    await createOrgUnit(session.ctx, parsed.data)
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "orgunit.create",
      entityType: "OrgUnit",
    })
  }

  revalidatePath(ADMIN_ORG_UNITS)
  return successState(`เพิ่มหน่วยงาน "${parsed.data.nameTh}" เรียบร้อยแล้ว`)
}

export async function updateOrgUnitAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission(PERMISSIONS.ORGUNIT_MANAGE)

  const parsed = updateOrgUnitSchema.safeParse({
    id: readString(formData, "id"),
    parentId: readOptionalString(formData, "parentId") ?? null,
    code: readString(formData, "code"),
    nameTh: readString(formData, "nameTh"),
    shortName: readOptionalString(formData, "shortName"),
    type: readString(formData, "type"),
    headUserId: readOptionalString(formData, "headUserId") ?? null,
    sortOrder: readString(formData, "sortOrder") || 0,
    canIssueNumber: readCheckbox(formData, "canIssueNumber"),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    await updateOrgUnit(session.ctx, parsed.data)
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "orgunit.update",
      entityType: "OrgUnit",
      entityId: parsed.data.id,
    })
  }

  revalidatePath(ADMIN_ORG_UNITS)
  return successState("บันทึกการแก้ไขเรียบร้อยแล้ว")
}

export async function moveOrgUnitAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission(PERMISSIONS.ORGUNIT_MANAGE)

  const parsed = moveOrgUnitSchema.safeParse({
    id: readString(formData, "id"),
    newParentId: readOptionalString(formData, "newParentId") ?? null,
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    await moveOrgUnit(session.ctx, parsed.data.id, parsed.data.newParentId)
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "orgunit.move",
      entityType: "OrgUnit",
      entityId: parsed.data.id,
    })
  }

  // ย้ายหน่วยงานเปลี่ยน path ของทั้ง subtree → สิทธิ์ SUBTREE ของทุกคนเปลี่ยนตาม
  revalidatePath("/", "layout")
  return successState("ย้ายหน่วยงานเรียบร้อยแล้ว")
}

export async function setOrgUnitActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission(PERMISSIONS.ORGUNIT_MANAGE)

  const parsed = archiveOrgUnitSchema.safeParse({
    id: readString(formData, "id"),
    isActive: readCheckbox(formData, "isActive"),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    await setOrgUnitActive(session.ctx, parsed.data.id, parsed.data.isActive)
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "orgunit.archive",
      entityType: "OrgUnit",
      entityId: parsed.data.id,
    })
  }

  revalidatePath(ADMIN_ORG_UNITS)
  return successState(
    parsed.data.isActive ? "นำหน่วยงานกลับมาใช้งานแล้ว" : "เก็บถาวรหน่วยงานเรียบร้อยแล้ว",
  )
}
