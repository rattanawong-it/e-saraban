"use server"

import { revalidatePath } from "next/cache"

import { PERMISSIONS, PERMISSION_SCOPES, type PermissionScope } from "@/lib/authz"
import { updateRolePermissionsSchema, updateRoleSchema } from "@/schemas/role.schema"
import { updateSettingsSchema } from "@/schemas/setting.schema"

import { runChainVerification } from "../services/audit.service"
import { updateRole, updateRolePermissions } from "../services/role.service"
import { updateSettings } from "../services/setting.service"
import { requirePermission } from "../session"
import { readCheckbox, readOptionalString, readString, toActionError } from "./helpers"
import { successState, zodErrorState, type ActionState } from "./types"

// Action ของหน้า /admin/roles · /admin/settings · /admin/audit

export async function updateRolePermissionsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission(PERMISSIONS.ROLE_MANAGE)

  // ฟอร์มส่งมาเป็นคู่ `perm:<code>` (ติ๊กแล้ว) และ `scope:<code>` (ค่า scope)
  // อ่านจาก scope ทุกตัวแล้วกรองเฉพาะที่ติ๊ก — ทำให้ค่า scope ของช่องที่ไม่ติ๊ก
  // ไม่หลุดเข้าไปโดยไม่ตั้งใจ
  const permissions: { code: string; scope: PermissionScope }[] = []

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("scope:")) continue

    const code = key.slice("scope:".length)
    if (!readCheckbox(formData, `perm:${code}`)) continue

    const scope = String(value)
    if (!(PERMISSION_SCOPES as readonly string[]).includes(scope)) continue

    permissions.push({ code, scope: scope as PermissionScope })
  }

  const parsed = updateRolePermissionsSchema.safeParse({
    roleId: readString(formData, "roleId"),
    permissions,
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    await updateRolePermissions(session.ctx, parsed.data)
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "role.permissions.update",
      entityType: "Role",
      entityId: parsed.data.roleId,
    })
  }

  // สิทธิ์ของทุกคนที่ถือบทบาทนี้เปลี่ยนทันที — ล้าง cache ทั้งแอป
  revalidatePath("/", "layout")
  return successState(`บันทึกสิทธิ์แล้ว ${parsed.data.permissions.length} รายการ`)
}

export async function updateRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission(PERMISSIONS.ROLE_MANAGE)

  const parsed = updateRoleSchema.safeParse({
    roleId: readString(formData, "roleId"),
    nameTh: readString(formData, "nameTh"),
    description: readOptionalString(formData, "description"),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    await updateRole(session.ctx, parsed.data)
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "role.update",
      entityType: "Role",
      entityId: parsed.data.roleId,
    })
  }

  revalidatePath("/admin/roles")
  return successState("บันทึกข้อมูลบทบาทเรียบร้อยแล้ว")
}

export async function updateSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requirePermission(PERMISSIONS.SETTING_MANAGE)

  const parsed = updateSettingsSchema.safeParse({
    yearMode: readString(formData, "yearMode"),
    maxSizeMb: readString(formData, "maxSizeMb"),
    allowedMimeTypes: formData.getAll("allowedMimeTypes").map(String),
    minLength: readString(formData, "minLength"),
    mustChangeOnFirstLogin: readCheckbox(formData, "mustChangeOnFirstLogin"),
    checkCommonPasswordList: readCheckbox(formData, "checkCommonPasswordList"),
    idleMinutes: readString(formData, "idleMinutes"),
    absoluteHours: readString(formData, "absoluteHours"),
    lockoutThreshold: readString(formData, "lockoutThreshold"),
    lockoutBaseMinutes: readString(formData, "lockoutBaseMinutes"),
  })

  if (!parsed.success) return zodErrorState(parsed.error)

  try {
    await updateSettings(session.ctx, parsed.data)
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "setting.update",
      entityType: "SystemSetting",
    })
  }

  revalidatePath("/admin/settings")
  return successState("บันทึกค่าระบบเรียบร้อยแล้ว")
}

export interface ChainCheckData {
  valid: boolean
  checked: number
  durationMs: number
  brokenAtSeq: string | null
}

export async function verifyAuditChainAction(
  _prev: ActionState<ChainCheckData>,
): Promise<ActionState<ChainCheckData>> {
  const session = await requirePermission(PERMISSIONS.AUDIT_READ)

  try {
    const result = await runChainVerification(session.ctx)

    const data: ChainCheckData = {
      valid: result.valid,
      checked: result.checked,
      durationMs: result.durationMs,
      brokenAtSeq: result.brokenAt?.seq ?? null,
    }

    if (!result.valid) {
      return {
        status: "error",
        message: `⚠️ พบความผิดปกติของ hash chain ที่ลำดับ ${data.brokenAtSeq} — มีการแก้ไขย้อนหลัง`,
        data,
      }
    }

    return successState(
      `ห่วงโซ่ hash สมบูรณ์ — ตรวจสอบ ${result.checked.toLocaleString("th-TH")} รายการ ไม่พบการแก้ไขย้อนหลัง (ใช้เวลา ${(result.durationMs / 1000).toFixed(1)} วินาที)`,
      data,
    )
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "audit.chain.verify",
      entityType: "AuditLog",
    })
  }
}
