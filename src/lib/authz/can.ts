// อัลกอริทึมตัดสินสิทธิ์ — spec §4.3
//
// ⚠️ ข้อบังคับของ spec §4.3: **ห้าม** เขียน logic ตัดสินสิทธิ์กระจายอยู่ในหน้า UI
// หรือ component — ทุกการตัดสินใจต้องผ่าน `can()` ในไฟล์นี้ไฟล์เดียว
// UI ซ่อนปุ่มตาม can() ได้ แต่ service layer ต้องเรียก can() ซ้ำเสมอ (spec §10.2)

import type { AuthzContext } from "./context"
import type { Permission, PermissionScope } from "./permissions"

/**
 * เอกสาร/ทรัพยากรที่กำลังขอเข้าถึง
 *
 * ทุกฟิลด์เป็น optional เพราะสิทธิ์บางตัวไม่ผูกกับทรัพยากร (เช่น `user.manage`)
 * — เรียก `can(ctx, permission)` โดยไม่ส่ง resource ได้เลย
 */
export interface AuthzResource {
  /** หน่วยงานเจ้าของทรัพยากร */
  ownerUnitId?: string | null

  /** materialized path ของหน่วยงานเจ้าของ — จำเป็นสำหรับ scope SUBTREE */
  ownerUnitPath?: string | null

  /** ผู้สร้าง — ใช้ตัดสิน scope OWN */
  createdById?: string | null

  /** หน่วยงานผู้รับ (spec §4.3 ข้อ 3: UNIT ผ่านได้ถ้า C อยู่ใน D.recipients) */
  recipientUnitIds?: readonly string[]

  /** ผู้รับรายบุคคล */
  recipientUserIds?: readonly string[]

  /** ชั้นความลับ 0–3 (spec §8.1) — ไม่ระบุ = 0 (ปกติ) */
  confidentialityLevel?: number

  /** ACL เฉพาะราย (spec §9.1 DocumentAcl) */
  acl?: readonly AuthzAclEntry[]

  /** สถานะปัจจุบันของทรัพยากร — ใช้กับด่าน STATE */
  status?: string | null
}

export interface AuthzAclEntry {
  principalType: "USER" | "ORG_UNIT" | "ROLE"
  principalId: string
  /** สิทธิ์ที่ ACL นี้ให้ — ใช้ชุดหยาบตาม spec §9.1 */
  permission: "VIEW" | "DOWNLOAD" | "EDIT" | "MANAGE"
  effect: "ALLOW" | "DENY"
  expiresAt?: Date | null
}

export interface CanOptions {
  /**
   * ด่าน STATE (spec §4.3 ข้อ 6) — สถานะที่อนุญาตให้ทำ action นี้
   * ไม่ระบุ = ไม่ตรวจสถานะ
   */
  allowedStatuses?: readonly string[]

  /** เวลาอ้างอิงสำหรับตรวจวันหมดอายุของ ACL — ใส่เองได้เพื่อให้ test คุมเวลาได้ */
  now?: Date
}

/** เหตุผลที่ปฏิเสธ — ใช้เขียนลง audit log และแสดงข้อความให้ผู้ใช้ */
export type DenyReason =
  | "NOT_AUTHENTICATED"
  | "NO_PERMISSION"
  | "OUT_OF_SCOPE"
  | "ACL_DENY"
  | "CLEARANCE_TOO_LOW"
  | "NO_EXPLICIT_ACL"
  | "INVALID_STATE"

export type CanResult =
  { allowed: true; scope: PermissionScope } | { allowed: false; reason: DenyReason }

const DENY_REASON_LABELS: Record<DenyReason, string> = {
  NOT_AUTHENTICATED: "เซสชันหมดอายุหรือบัญชีถูกระงับ",
  NO_PERMISSION: "บทบาทของคุณไม่มีสิทธิ์นี้",
  OUT_OF_SCOPE: "รายการนี้อยู่นอกขอบเขตข้อมูลของคุณ",
  ACL_DENY: "ถูกปฏิเสธการเข้าถึงรายการนี้เป็นการเฉพาะ",
  CLEARANCE_TOO_LOW: "ชั้นความลับของเอกสารสูงกว่าสิทธิ์ที่คุณได้รับ",
  NO_EXPLICIT_ACL: "เอกสารลับต้องได้รับสิทธิ์เป็นรายบุคคลก่อน",
  INVALID_STATE: "สถานะปัจจุบันของรายการไม่อนุญาตให้ทำรายการนี้",
}

export function denyReasonLabel(reason: DenyReason): string {
  return DENY_REASON_LABELS[reason]
}

/**
 * ตัดสินว่าผู้ใช้ใน context `ctx` ทำ `permission` กับ `resource` ได้หรือไม่
 *
 * ลำดับด่านตาม spec §4.3 — เรียงตามนี้เท่านั้น เพราะ "deny ชนะเสมอ"
 * ต้องมาก่อนการ rescue ด้วย ACL ALLOW
 */
export function can(
  ctx: AuthzContext,
  permission: Permission,
  resource?: AuthzResource,
  options: CanOptions = {},
): CanResult {
  const now = options.now ?? new Date()

  // ── 1. AUTHENTICATED ────────────────────────────────────────────────────
  if (!ctx.userId || !ctx.isActive) {
    return { allowed: false, reason: "NOT_AUTHENTICATED" }
  }

  // ── 2. ROLE GRANT ───────────────────────────────────────────────────────
  const scope = ctx.permissions[permission]
  if (!scope) {
    return { allowed: false, reason: "NO_PERMISSION" }
  }

  // สิทธิ์ที่ไม่ผูกกับทรัพยากร (เช่น user.manage) — ผ่านตั้งแต่ด่านนี้
  if (!resource) {
    return { allowed: true, scope }
  }

  // ── 4a. EXPLICIT DENY — ต้องตรวจก่อน scope เพราะ deny ชนะเสมอ ───────────
  const acl = resource.acl ?? []
  const activeAcl = acl.filter((entry) => !entry.expiresAt || entry.expiresAt > now)

  if (activeAcl.some((entry) => entry.effect === "DENY" && matchesPrincipal(ctx, entry))) {
    return { allowed: false, reason: "ACL_DENY" }
  }

  // ── 3. SCOPE MATCH ──────────────────────────────────────────────────────
  const inScope = matchesScope(ctx, scope, resource)

  // ── 4b. ACL ALLOW — ช่วยกู้กรณีที่ scope ไม่ผ่าน ────────────────────────
  const hasAclAllow = activeAcl.some(
    (entry) => entry.effect === "ALLOW" && matchesPrincipal(ctx, entry),
  )

  if (!inScope && !hasAclAllow) {
    return { allowed: false, reason: "OUT_OF_SCOPE" }
  }

  // ── 5. CLEARANCE ────────────────────────────────────────────────────────
  const level = resource.confidentialityLevel ?? 0
  if (level > 0) {
    if (ctx.clearanceLevel < level) {
      return { allowed: false, reason: "CLEARANCE_TOO_LOW" }
    }

    // spec §4.3 ข้อ 5: "เอกสารระดับลับขึ้นไป ต้องมี ACL ระบุตัวบุคคลเสมอ
    // ห้าม inherit สิทธิ์จาก scope เพียงอย่างเดียว"
    const hasPersonalAcl = activeAcl.some(
      (entry) =>
        entry.effect === "ALLOW" &&
        entry.principalType === "USER" &&
        entry.principalId === ctx.userId,
    )

    if (!hasPersonalAcl) {
      return { allowed: false, reason: "NO_EXPLICIT_ACL" }
    }
  }

  // ── 6. STATE ────────────────────────────────────────────────────────────
  if (options.allowedStatuses && resource.status) {
    if (!options.allowedStatuses.includes(resource.status)) {
      return { allowed: false, reason: "INVALID_STATE" }
    }
  }

  return { allowed: true, scope }
}

/** รุ่นย่อของ `can()` เมื่อสนใจแค่ผ่าน/ไม่ผ่าน */
export function canOrFalse(
  ctx: AuthzContext,
  permission: Permission,
  resource?: AuthzResource,
  options?: CanOptions,
): boolean {
  return can(ctx, permission, resource, options).allowed
}

/**
 * ตรวจ scope ตาม spec §4.3 ข้อ 3
 *
 * SUBTREE ใช้ materialized path เทียบแบบ prefix — ตรงกับที่ฐานข้อมูล query
 * ด้วย `path LIKE '<ctx.path>%'` (spec §5.1) จึงไม่มีทางที่ผลต่างกัน
 */
function matchesScope(ctx: AuthzContext, scope: PermissionScope, resource: AuthzResource): boolean {
  switch (scope) {
    case "ORG":
      return true

    case "OWN":
      return Boolean(resource.createdById) && resource.createdById === ctx.userId

    case "UNIT": {
      if (!ctx.activeOrgUnitId) return false
      if (resource.ownerUnitId === ctx.activeOrgUnitId) return true
      return (resource.recipientUnitIds ?? []).includes(ctx.activeOrgUnitId)
    }

    case "SUBTREE": {
      if (!ctx.activeOrgUnitPath || !resource.ownerUnitPath) return false
      return resource.ownerUnitPath.startsWith(ctx.activeOrgUnitPath)
    }
  }
}

function matchesPrincipal(ctx: AuthzContext, entry: AuthzAclEntry): boolean {
  switch (entry.principalType) {
    case "USER":
      return entry.principalId === ctx.userId
    case "ORG_UNIT":
      return ctx.orgUnitIds.includes(entry.principalId)
    case "ROLE":
      return (ctx.roleCodes as readonly string[]).includes(entry.principalId)
  }
}
