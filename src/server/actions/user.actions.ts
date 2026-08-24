"use server"

import { revalidatePath } from "next/cache"

import { PERMISSIONS } from "@/lib/authz"
import {
  addAffiliationSchema,
  createUserSchema,
  removeAffiliationSchema,
  resetPasswordSchema,
  reviewRegistrationSchema,
  setUserActiveSchema,
  updateUserSchema,
} from "@/schemas/user.schema"

import { resetPasswordByAdmin } from "../services/auth.service"
import {
  addAffiliation,
  createUser,
  removeAffiliation,
  reviewRegistration,
  setUserActive,
  updateUser,
} from "../services/user.service"
import { requirePermission } from "../session"
import { readCheckbox, readOptionalString, readString, toActionError } from "./helpers"
import { successState, zodErrorState, type ActionState } from "./types"

const ADMIN_USERS = "/admin/users"

/** ผลลัพธ์ที่ต้องแสดงรหัสผ่านชั่วคราวให้ผู้ดูแลเห็นครั้งเดียว (MVP ไม่มีอีเมล — D10) */
export interface TemporaryPasswordData {
  username: string
  temporaryPassword: string
}

export async function createUserAction(
  _prev: ActionState<TemporaryPasswordData>,
  formData: FormData,
): Promise<ActionState<TemporaryPasswordData>> {
  const session = await requirePermission(PERMISSIONS.USER_MANAGE)

  const parsed = createUserSchema.safeParse({
    prefix: readOptionalString(formData, "prefix"),
    firstName: readString(formData, "firstName"),
    lastName: readString(formData, "lastName"),
    username: readString(formData, "username"),
    email: readOptionalString(formData, "email") ?? "",
    clearanceLevel: readString(formData, "clearanceLevel") || 0,
    orgUnitId: readString(formData, "orgUnitId"),
    positionTitle: readOptionalString(formData, "positionTitle"),
    roleCode: readString(formData, "roleCode"),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    const result = await createUser(session.ctx, parsed.data)
    revalidatePath(ADMIN_USERS)

    return successState(
      `เพิ่มผู้ใช้ "${result.user.username}" เรียบร้อยแล้ว — แจ้งรหัสผ่านชั่วคราวให้ผู้ใช้`,
      { username: result.user.username, temporaryPassword: result.temporaryPassword },
    )
  } catch (error) {
    return toActionError(error, { ctx: session.ctx, action: "user.create", entityType: "User" })
  }
}

export async function updateUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission(PERMISSIONS.USER_MANAGE)

  const parsed = updateUserSchema.safeParse({
    id: readString(formData, "id"),
    prefix: readOptionalString(formData, "prefix"),
    firstName: readString(formData, "firstName"),
    lastName: readString(formData, "lastName"),
    email: readOptionalString(formData, "email") ?? "",
    clearanceLevel: readString(formData, "clearanceLevel") || 0,
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    await updateUser(session.ctx, parsed.data)
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "user.update",
      entityType: "User",
      entityId: parsed.data.id,
    })
  }

  revalidatePath(ADMIN_USERS)
  return successState("บันทึกข้อมูลผู้ใช้เรียบร้อยแล้ว")
}

export async function addAffiliationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission(PERMISSIONS.USER_MANAGE)

  const parsed = addAffiliationSchema.safeParse({
    userId: readString(formData, "userId"),
    orgUnitId: readString(formData, "orgUnitId"),
    positionTitle: readOptionalString(formData, "positionTitle"),
    roleCode: readString(formData, "roleCode"),
    isPrimary: readCheckbox(formData, "isPrimary"),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    await addAffiliation(session.ctx, parsed.data)
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "user.affiliation.add",
      entityType: "User",
      entityId: parsed.data.userId,
    })
  }

  revalidatePath(ADMIN_USERS)
  return successState("เพิ่มสังกัดเรียบร้อยแล้ว")
}

export async function removeAffiliationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission(PERMISSIONS.USER_MANAGE)

  const parsed = removeAffiliationSchema.safeParse({
    userId: readString(formData, "userId"),
    orgUnitId: readString(formData, "orgUnitId"),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    await removeAffiliation(session.ctx, parsed.data.userId, parsed.data.orgUnitId)
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "user.affiliation.remove",
      entityType: "User",
      entityId: parsed.data.userId,
    })
  }

  revalidatePath(ADMIN_USERS)
  return successState("ถอดสังกัดเรียบร้อยแล้ว")
}

export async function setUserActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission(PERMISSIONS.USER_MANAGE)

  const parsed = setUserActiveSchema.safeParse({
    userId: readString(formData, "userId"),
    isActive: readCheckbox(formData, "isActive"),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    await setUserActive(session.ctx, parsed.data.userId, parsed.data.isActive)
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "user.set-active",
      entityType: "User",
      entityId: parsed.data.userId,
    })
  }

  revalidatePath(ADMIN_USERS)
  return successState(parsed.data.isActive ? "เปิดใช้งานบัญชีแล้ว" : "ระงับบัญชีเรียบร้อยแล้ว")
}

export async function resetPasswordAction(
  _prev: ActionState<TemporaryPasswordData>,
  formData: FormData,
): Promise<ActionState<TemporaryPasswordData>> {
  const session = await requirePermission(PERMISSIONS.USER_MANAGE)

  const parsed = resetPasswordSchema.safeParse({ userId: readString(formData, "userId") })
  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    const temporaryPassword = await resetPasswordByAdmin(session.ctx, parsed.data.userId)
    revalidatePath(ADMIN_USERS)

    return successState("รีเซ็ตรหัสผ่านแล้ว — แจ้งรหัสผ่านชั่วคราวให้ผู้ใช้ทราบ", {
      username: readString(formData, "username"),
      temporaryPassword,
    })
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "user.password.reset",
      entityType: "User",
      entityId: parsed.data.userId,
    })
  }
}

export async function reviewRegistrationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission(PERMISSIONS.USER_MANAGE)

  const parsed = reviewRegistrationSchema.safeParse({
    requestId: readString(formData, "requestId"),
    approve: readString(formData, "decision") === "approve",
    roleCode: readOptionalString(formData, "roleCode"),
    rejectReason: readOptionalString(formData, "rejectReason"),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    const result = await reviewRegistration(session.ctx, parsed.data)
    revalidatePath(ADMIN_USERS)

    return successState(
      result.approved ? "อนุมัติคำขอและสร้างบัญชีเรียบร้อยแล้ว" : "ปฏิเสธคำขอเรียบร้อยแล้ว",
    )
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "registration.review",
      entityType: "RegistrationRequest",
      entityId: parsed.data.requestId,
    })
  }
}
