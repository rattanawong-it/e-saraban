"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  switchContextSchema,
} from "@/schemas/auth.schema"

import {
  changeOwnPassword,
  login,
  logout,
  requestPasswordReset,
  submitRegistration,
  switchContext,
} from "../services/auth.service"
import { getAppSession, requireSession } from "../session"
import { readCheckbox, readOptionalString, readString, toActionError } from "./helpers"
import { errorState, successState, zodErrorState, type ActionState } from "./types"

// spec §11.3 ข้อ 1 — Action บาง: ตรวจ auth → validate ด้วย Zod → เรียก service → revalidate

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    username: readString(formData, "username"),
    password: String(formData.get("password") ?? ""),
    remember: readCheckbox(formData, "remember"),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  let mustChangePassword = false

  try {
    const result = await login(parsed.data)
    mustChangePassword = result.mustChangePassword
  } catch (error) {
    return toActionError(error)
  }

  // redirect ต้องอยู่นอก try — Next ใช้ exception เป็นกลไก redirect
  redirect(mustChangePassword ? "/change-password" : "/dashboard")
}

export async function logoutAction(): Promise<void> {
  const session = await getAppSession()
  if (session) await logout(session.ctx)
  redirect("/login")
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession({ skipPasswordCheck: true })

  const parsed = changePasswordSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    await changeOwnPassword(session.ctx, parsed.data)
  } catch (error) {
    return toActionError(error, { ctx: session.ctx, action: "auth.password.change" })
  }

  redirect("/dashboard")
}

export async function switchContextAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession()

  const parsed = switchContextSchema.safeParse({
    orgUnitId: readString(formData, "orgUnitId"),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    await switchContext(session.ctx, parsed.data.orgUnitId)
  } catch (error) {
    return toActionError(error, { ctx: session.ctx, action: "auth.context.switch" })
  }

  // สิทธิ์เปลี่ยนทั้งแอปเมื่อสลับหน่วยงาน — ต้องล้าง cache ทุกหน้า
  revalidatePath("/", "layout")
  return successState("สลับหน่วยงานเรียบร้อยแล้ว")
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    prefix: readOptionalString(formData, "prefix"),
    firstName: readString(formData, "firstName"),
    lastName: readString(formData, "lastName"),
    email: readString(formData, "email"),
    username: readString(formData, "username"),
    orgUnitId: readString(formData, "orgUnitId"),
    positionTitle: readOptionalString(formData, "positionTitle"),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    note: readOptionalString(formData, "note"),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    await submitRegistration(parsed.data)
  } catch (error) {
    return toActionError(error)
  }

  return successState("ส่งคำขอเรียบร้อยแล้ว")
}

export async function forgotPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: readString(formData, "email") })
  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    await requestPasswordReset(parsed.data.email)
  } catch {
    // ตอบเหมือนเดิมเสมอ ไม่ว่าอีเมลจะมีอยู่จริงหรือไม่ (ดูเหตุผลใน auth.service.ts)
    return errorState("ส่งคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
  }

  return successState("ส่งคำขอถึงผู้ดูแลระบบเรียบร้อยแล้ว")
}
