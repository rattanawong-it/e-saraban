import "server-only"

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, writeAudit, writeAuditStandalone } from "@/lib/audit"
import {
  computeLockUntil,
  createSession,
  destroySession,
  generateTemporaryPassword,
  getRequestMeta,
  hashPassword,
  checkRateLimit,
  PUBLIC_FORM_LIMIT,
  PUBLIC_FORM_WINDOW_MS,
  LOGIN_IP_LIMIT,
  LOGIN_IP_WINDOW_MS,
  resetRateLimit,
  revokeAllSessions,
  setActiveOrgUnit,
  usernameCandidate,
  usernameFromEmail,
  validatePassword,
  verifyPassword,
} from "@/lib/auth"
import type { Prisma } from "@/generated/prisma/client"
import type { GoogleProfile } from "@/lib/auth/providers/google"
import { prisma } from "@/lib/db"
import { getSystemSettings } from "@/lib/settings"
import type { ChangePasswordInput, LoginInput, RegisterInput } from "@/schemas/auth.schema"

import type { ServiceContext } from "../context"
import { ServiceError } from "./errors"

// การเข้าสู่ระบบและจัดการรหัสผ่าน (spec §8.4)
//
// หลักที่ยึด: **ไม่บอกผู้โจมตีว่าอะไรผิด** — ชื่อผู้ใช้ไม่มี กับ รหัสผ่านผิด
// ต้องได้ข้อความเดียวกันและใช้เวลาใกล้เคียงกัน ไม่งั้นจะกลายเป็นเครื่องมือ
// ไล่หาว่าบัญชีไหนมีอยู่จริงในองค์กร

const GENERIC_LOGIN_ERROR = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"

export interface LoginResult {
  ok: true
  mustChangePassword: boolean
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const { ip, userAgent } = await getRequestMeta()

  // ── ชั้นที่ 1: rate limit ต่อ IP ────────────────────────────────────────
  const limit = checkRateLimit(`login:${ip ?? "unknown"}`, LOGIN_IP_LIMIT, LOGIN_IP_WINDOW_MS)
  if (!limit.allowed) {
    throw new ServiceError("พยายามเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่แล้วลองใหม่", "RATE_LIMIT")
  }

  // ผู้ใช้กรอกได้ทั้งชื่อผู้ใช้และอีเมล — อีเมลเทียบแบบไม่สนตัวพิมพ์
  const identifier = input.username.trim()

  const user = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [{ username: identifier }, { email: identifier.toLowerCase() }],
    },
    include: {
      orgUnits: {
        where: { orgUnit: { isActive: true } },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        take: 1,
      },
    },
  })

  const settings = user ? await getSystemSettings(user.tenantId) : await getDefaultTenantSettings()

  // บัญชีไม่มีอยู่จริง — ยังคง hash ทิ้งหนึ่งครั้งให้เวลาตอบใกล้เคียงกับกรณีปกติ
  if (!user) {
    await hashPassword(input.password)
    throw new ServiceError(GENERIC_LOGIN_ERROR, "VALIDATION")
  }

  // ── บัญชีถูกล็อกอยู่ ────────────────────────────────────────────────────
  const now = new Date()
  if (user.lockedUntil && user.lockedUntil > now) {
    await writeAuditStandalone({
      tenantId: user.tenantId,
      action: AUDIT_ACTIONS.LOGIN_LOCKED,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: user.id,
      actorUserId: user.id,
      result: "DENY",
      severity: "WARNING",
      ip,
      userAgent,
      metadata: { username: user.username, lockedUntil: user.lockedUntil.toISOString() },
    })

    const minutes = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60000)
    throw new ServiceError(
      `บัญชีถูกล็อกชั่วคราว กรุณารออีก ${minutes} นาที หรือติดต่อผู้ดูแลระบบ`,
      "RATE_LIMIT",
    )
  }

  const passwordOk = await verifyPassword(user.passwordHash, input.password)

  // ── รหัสผ่านผิด: นับครั้ง + คำนวณเวลาล็อกแบบ exponential backoff ────────
  if (!passwordOk) {
    const failedLoginCount = user.failedLoginCount + 1
    const lockedUntil = computeLockUntil(
      failedLoginCount,
      settings.session.lockoutThreshold,
      settings.session.lockoutBaseMinutes,
      now,
    )

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount, lockedUntil },
    })

    await writeAuditStandalone({
      tenantId: user.tenantId,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: user.id,
      actorUserId: user.id,
      result: "DENY",
      severity: lockedUntil ? "WARNING" : "NOTICE",
      ip,
      userAgent,
      metadata: { username: user.username, failedLoginCount },
    })

    if (lockedUntil) {
      throw new ServiceError(
        `กรอกรหัสผ่านผิดเกินกำหนด บัญชีถูกล็อก ${settings.session.lockoutBaseMinutes} นาที`,
        "RATE_LIMIT",
      )
    }

    const remaining = settings.session.lockoutThreshold - failedLoginCount
    throw new ServiceError(
      remaining > 0
        ? `${GENERIC_LOGIN_ERROR} — เหลือโอกาสอีก ${remaining} ครั้งก่อนบัญชีจะถูกล็อกชั่วคราว`
        : GENERIC_LOGIN_ERROR,
      "VALIDATION",
    )
  }

  // ── บัญชีถูกระงับ — ตรวจ **หลัง** รหัสผ่าน เพื่อไม่บอกใบ้ว่าบัญชีมีอยู่จริง ─
  if (!user.isActive) {
    await writeAuditStandalone({
      tenantId: user.tenantId,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: user.id,
      actorUserId: user.id,
      result: "DENY",
      severity: "WARNING",
      ip,
      userAgent,
      metadata: { username: user.username, reason: "INACTIVE" },
    })

    throw new ServiceError("บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ", "FORBIDDEN")
  }

  const primaryUnitId = user.orgUnits[0]?.orgUnitId ?? null

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
  })

  const sessionId = await createSession({
    userId: user.id,
    activeOrgUnitId: primaryUnitId,
    remember: input.remember,
    absoluteHours: settings.session.absoluteHours,
  })

  resetRateLimit(`login:${ip ?? "unknown"}`)

  await writeAuditStandalone({
    tenantId: user.tenantId,
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: user.id,
    actorUserId: user.id,
    actorOrgUnitId: primaryUnitId,
    sessionId,
    ip,
    userAgent,
    metadata: { username: user.username, remember: input.remember },
  })

  return { ok: true, mustChangePassword: user.mustChangePassword }
}

export async function logout(ctx: ServiceContext): Promise<void> {
  await writeAuditStandalone({
    tenantId: ctx.tenantId,
    action: AUDIT_ACTIONS.LOGOUT,
    entityType: AUDIT_ENTITY_TYPES.SESSION,
    entityId: ctx.sessionId,
    actorUserId: ctx.userId,
    actorOrgUnitId: ctx.activeOrgUnitId,
    sessionId: ctx.sessionId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  })

  await destroySession(ctx.sessionId)
}

export async function changeOwnPassword(
  ctx: ServiceContext,
  input: ChangePasswordInput,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: ctx.userId } })
  if (!user) throw new ServiceError("ไม่พบบัญชีผู้ใช้", "NOT_FOUND")

  // บัญชีที่ผูกกับ Google อย่างเดียวยังไม่มีรหัสผ่านให้เปลี่ยน (D19 · spec §17.3)
  // บอกตรง ๆ ได้เพราะเป็นบัญชีของผู้ที่ล็อกอินอยู่เอง ไม่ใช่ข้อมูลของคนอื่น
  if (user.passwordHash === null) {
    throw new ServiceError(
      "บัญชีนี้เข้าสู่ระบบด้วย Google จึงยังไม่มีรหัสผ่านให้เปลี่ยน — ติดต่อผู้ดูแลระบบหากต้องการตั้งรหัสผ่าน",
      "VALIDATION",
    )
  }

  const currentOk = await verifyPassword(user.passwordHash, input.currentPassword)
  if (!currentOk) throw new ServiceError("รหัสผ่านปัจจุบันไม่ถูกต้อง", "VALIDATION")

  const settings = await getSystemSettings(ctx.tenantId)
  const issues = validatePassword(input.newPassword, settings.password, user.username)

  if (issues.length > 0) {
    throw new ServiceError(issues.map((issue) => issue.message).join(" · "), "VALIDATION")
  }

  const passwordHash = await hashPassword(input.newPassword)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
      },
    })

    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      action: AUDIT_ACTIONS.PASSWORD_CHANGED,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: user.id,
      actorUserId: ctx.userId,
      actorOrgUnitId: ctx.activeOrgUnitId,
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      severity: "NOTICE",
      metadata: { username: user.username },
    })

    // ปิดคำขอรีเซ็ตที่ค้างอยู่ เพราะผู้ใช้เข้าถึงบัญชีได้แล้ว
    await tx.passwordResetRequest.updateMany({
      where: { userId: user.id, status: "PENDING" },
      data: { status: "APPROVED", resolvedAt: new Date(), note: "ผู้ใช้เปลี่ยนรหัสผ่านเองแล้ว" },
    })
  })
}

/** สลับหน่วยงานที่กำลังทำงานอยู่ (Context Switcher · spec §5.2) */
export async function switchContext(ctx: ServiceContext, orgUnitId: string): Promise<void> {
  if (!ctx.orgUnitIds.includes(orgUnitId)) {
    throw new ServiceError("คุณไม่ได้สังกัดหน่วยงานนี้", "FORBIDDEN")
  }

  await prisma.$transaction(async (tx) => {
    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      action: AUDIT_ACTIONS.CONTEXT_SWITCHED,
      entityType: AUDIT_ENTITY_TYPES.SESSION,
      entityId: ctx.sessionId,
      actorUserId: ctx.userId,
      actorOrgUnitId: orgUnitId,
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { from: ctx.activeOrgUnitId, to: orgUnitId },
    })
  })

  await setActiveOrgUnit(ctx.sessionId, orgUnitId)
}

/** ข้อมูลที่หน้า /register เอาไปแสดงบนจอ "ส่งคำขอแล้ว" */
export interface RegistrationSummary {
  fullName: string
  email: string
  orgUnitName: string
  /** ชื่อผู้ใช้ที่ระบบสร้างให้ — ต้องบอกผู้สมัคร เพราะ MVP ยังไม่มีอีเมลแจ้ง (D10) */
  username: string
}

/** จำนวนครั้งสูงสุดที่ยอมต่อท้ายเลขเพื่อหาชื่อผู้ใช้ที่ยังว่าง */
const MAX_USERNAME_ATTEMPTS = 50

/**
 * หาชื่อผู้ใช้ที่ยังว่างจากฐานที่สร้างจากอีเมล — ซ้ำแล้วต่อท้ายด้วยเลขเรียงไป
 * นับคำขอที่ยัง PENDING ว่า "ถูกจองแล้ว" ด้วย ไม่งั้นสองคำขอจะชนกันตอนอนุมัติ
 */
async function reserveUsername(email: string): Promise<string> {
  const base = usernameFromEmail(email)

  for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt += 1) {
    const candidate = usernameCandidate(base, attempt)

    const [takenByUser, takenByRequest] = await Promise.all([
      prisma.user.findUnique({ where: { username: candidate }, select: { id: true } }),
      prisma.registrationRequest.findFirst({
        where: { username: candidate, status: "PENDING" },
        select: { id: true },
      }),
    ])

    if (!takenByUser && !takenByRequest) return candidate
  }

  throw new ServiceError(
    "ไม่สามารถสร้างชื่อผู้ใช้จากอีเมลนี้ได้ กรุณาติดต่อผู้ดูแลระบบ",
    "CONFLICT",
  )
}

/**
 * คำขอสมัครใช้งาน (หน้า /register)
 *
 * ไม่สร้าง User จนกว่าผู้ดูแลจะอนุมัติ — บัญชีที่ยังไม่ผ่านการตรวจสอบ
 * ต้องไม่มีตัวตนในระบบเลย ไม่ใช่มีอยู่แต่ปิดใช้งาน
 */
export async function submitRegistration(input: RegisterInput): Promise<RegistrationSummary> {
  const { ip, userAgent } = await getRequestMeta()

  assertPublicFormRate("register", ip, "ส่งคำขอสมัครถี่เกินไป กรุณารอสักครู่แล้วลองใหม่")

  const orgUnit = await prisma.orgUnit.findFirst({
    where: { id: input.orgUnitId, isActive: true },
  })

  if (!orgUnit) throw new ServiceError("ไม่พบหน่วยงานที่เลือก", "NOT_FOUND")

  // อีเมลกลายเป็นตัวระบุตัวตนเดียวของหน้านี้ (ไม่มีช่องชื่อผู้ใช้แล้ว)
  // จึงต้องกันคนเดิมส่งคำขอซ้ำที่ตรงนี้แทน
  const email = input.email.toLowerCase()

  const [existingUser, existingRequest] = await Promise.all([
    prisma.user.findFirst({ where: { email, deletedAt: null }, select: { id: true } }),
    prisma.registrationRequest.findFirst({
      where: { email, status: "PENDING" },
      select: { id: true },
    }),
  ])

  if (existingUser || existingRequest) {
    throw new ServiceError(`อีเมล "${email}" ถูกใช้ลงทะเบียนไว้แล้ว`, "CONFLICT")
  }

  const username = await reserveUsername(email)

  const settings = await getSystemSettings(orgUnit.tenantId)
  const issues = validatePassword(input.password, settings.password, username)

  if (issues.length > 0) {
    throw new ServiceError(issues.map((issue) => issue.message).join(" · "), "VALIDATION")
  }

  const passwordHash = await hashPassword(input.password)

  await prisma.$transaction(async (tx) => {
    const request = await tx.registrationRequest.create({
      data: {
        tenantId: orgUnit.tenantId,
        firstName: input.firstName,
        lastName: input.lastName,
        email,
        username,
        passwordHash,
        orgUnitId: orgUnit.id,
        positionTitle: input.positionTitle || null,
        note: input.note || null,
      },
    })

    await writeAudit(tx, {
      tenantId: orgUnit.tenantId,
      action: AUDIT_ACTIONS.REGISTRATION_SUBMITTED,
      entityType: AUDIT_ENTITY_TYPES.REGISTRATION,
      entityId: request.id,
      severity: "NOTICE",
      ip,
      userAgent,
      metadata: { username, email, orgUnitId: orgUnit.id },
    })
  })

  // คืนค่าที่ผ่านการตรวจแล้วจากฝั่ง server เพื่อให้จอ "ส่งคำขอแล้ว"
  // แสดงชื่อและหน่วยงานได้ถูกต้องแม้ JavaScript ยังโหลดไม่เสร็จ
  return {
    fullName: `${input.firstName} ${input.lastName}`,
    email,
    orgUnitName: orgUnit.nameTh,
    username,
  }
}

/**
 * คำขอรีเซ็ตรหัสผ่าน (หน้า /forgot-password)
 *
 * MVP ไม่มีอีเมล (D10 — in-app เท่านั้น) คำขอจึงเข้าคิวให้ผู้ดูแลระบบ
 * กดรีเซ็ตให้จากหน้า /admin/users แล้วแจ้งรหัสผ่านชั่วคราวกับผู้ใช้เอง
 *
 * **ตอบผลลัพธ์เหมือนกันเสมอ** ไม่ว่าอีเมลนั้นจะมีในระบบหรือไม่
 * เพื่อไม่ให้หน้านี้กลายเป็นเครื่องมือตรวจว่าอีเมลใดมีบัญชีอยู่
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const { ip, userAgent } = await getRequestMeta()

  assertPublicFormRate("reset", ip, "ขอรีเซ็ตรหัสผ่านถี่เกินไป กรุณารอสักครู่แล้วลองใหม่")
  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } })

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

  await prisma.$transaction(async (tx) => {
    const request = await tx.passwordResetRequest.create({
      data: { userId: user?.id ?? null, email, ip, expiresAt },
    })

    if (user) {
      await writeAudit(tx, {
        tenantId: user.tenantId,
        action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
        entityType: AUDIT_ENTITY_TYPES.PASSWORD_RESET,
        entityId: request.id,
        actorUserId: user.id,
        severity: "NOTICE",
        ip,
        userAgent,
        metadata: { email },
      })
    }
  })
}

/** ผู้ดูแลรีเซ็ตรหัสผ่านให้ — คืนรหัสผ่านชั่วคราวเพื่อแสดงให้ผู้ดูแลเห็นครั้งเดียว */
export async function resetPasswordByAdmin(
  ctx: ServiceContext,
  targetUserId: string,
): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { id: targetUserId, tenantId: ctx.tenantId, deletedAt: null },
  })

  if (!user) throw new ServiceError("ไม่พบบัญชีผู้ใช้", "NOT_FOUND")

  const settings = await getSystemSettings(ctx.tenantId)
  const temporaryPassword = generateTemporaryPassword(Math.max(settings.password.minLength, 12))
  const passwordHash = await hashPassword(temporaryPassword)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
        passwordChangedAt: new Date(),
      },
    })

    await tx.passwordResetRequest.updateMany({
      where: { userId: user.id, status: "PENDING" },
      data: { status: "APPROVED", resolvedById: ctx.userId, resolvedAt: new Date() },
    })

    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      action: AUDIT_ACTIONS.PASSWORD_RESET_BY_ADMIN,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: user.id,
      actorUserId: ctx.userId,
      actorOrgUnitId: ctx.activeOrgUnitId,
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      severity: "WARNING",
      metadata: { username: user.username },
    })
  })

  // เตะทุกเซสชันเดิมทิ้ง — รหัสผ่านเปลี่ยนแล้วเซสชันเก่าต้องใช้ไม่ได้อีก
  await revokeAllSessions(user.id)

  return temporaryPassword
}

/** ค่าระบบของ tenant เดียวใน MVP — ใช้ตอนยังไม่รู้ว่าเป็นผู้ใช้คนไหน */
async function getDefaultTenantSettings() {
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } })
  const { DEFAULT_SETTINGS } = await import("@/lib/settings/definitions")
  return tenant ? getSystemSettings(tenant.id) : DEFAULT_SETTINGS
}

/** ด่านกันการยิงซ้ำของหน้าที่ไม่ต้องล็อกอิน (spec §8.4) */
function assertPublicFormRate(scope: string, ip: string | null, message: string) {
  const limit = checkRateLimit(
    `${scope}:${ip ?? "unknown"}`,
    PUBLIC_FORM_LIMIT,
    PUBLIC_FORM_WINDOW_MS,
  )

  if (!limit.allowed) throw new ServiceError(message, "RATE_LIMIT")
}

// ---------------------------------------------------------------------------
// เข้าสู่ระบบด้วย Google (spec §17.3 · D19)
//
// Google ทำหน้าที่เดียวคือ "พิสูจน์ว่าเป็นใคร" — เซสชัน สิทธิ์ ชั้นความลับ และ audit
// ยังเป็นของระบบเราทั้งหมด จึงจบด้วย createSession() ตัวเดียวกับล็อกอินด้วยรหัสผ่าน
// ---------------------------------------------------------------------------

export type GoogleLoginFailure =
  "EMAIL_UNVERIFIED" | "DOMAIN_NOT_ALLOWED" | "NO_ACCOUNT" | "INACTIVE"

export class GoogleLoginError extends Error {
  constructor(readonly reason: GoogleLoginFailure) {
    super(reason)
    this.name = "GoogleLoginError"
  }
}

export interface GoogleLoginResult {
  /** true = เพิ่งผูกบัญชี Google กับผู้ใช้คนนี้เป็นครั้งแรก */
  linked: boolean
}

/**
 * ด่านตรวจสามชั้นตาม §17.3 แล้วสร้างเซสชัน
 *
 * ⚠️ **ห้ามสร้างผู้ใช้ใหม่จากเส้นทางนี้เด็ดขาด** — ผู้ใช้ที่ไม่มีหน่วยงาน ไม่มีบทบาท
 * และไม่มี clearanceLevel ไม่มีความหมายในระบบนี้ · และถ้าเปิดไว้ ใครก็ตามที่มีบัญชี
 * ในโดเมนมหาวิทยาลัย (รวมนักศึกษา) จะเดินเข้าระบบสารบรรณได้ทันที
 * คนใหม่ต้องผ่านคิวอนุมัติที่ /register เหมือนเดิม
 */
export async function loginWithGoogle(
  profile: GoogleProfile,
  allowedHostedDomain: string | null,
): Promise<GoogleLoginResult> {
  const { ip, userAgent } = await getRequestMeta()

  assertPublicFormRate("google", ip, "พยายามเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่แล้วลองใหม่")

  // ── ชั้นที่ 1: อีเมลต้องยืนยันแล้ว ──────────────────────────────────────
  if (!profile.emailVerified || !profile.email) {
    await writeGoogleDenyAudit(profile, "EMAIL_UNVERIFIED", ip, userAgent)
    throw new GoogleLoginError("EMAIL_UNVERIFIED")
  }

  // ── ชั้นที่ 2: ต้องเป็นโดเมน Workspace ขององค์กร ────────────────────────
  // ตรวจที่นี่ ไม่ใช่เชื่อพารามิเตอร์ `hd` ที่ส่งไปตอนขอ — ค่านั้นเป็นแค่คำใบ้
  // ให้หน้าเลือกบัญชีของ Google กรองให้ ผู้ใช้แก้ URL แล้วข้ามไปได้
  if (allowedHostedDomain && profile.hostedDomain !== allowedHostedDomain) {
    await writeGoogleDenyAudit(profile, "DOMAIN_NOT_ALLOWED", ip, userAgent)
    throw new GoogleLoginError("DOMAIN_NOT_ALLOWED")
  }

  // ── ชั้นที่ 3: ต้องมีบัญชีในระบบอยู่แล้ว ────────────────────────────────
  // หาด้วย sub ก่อนเสมอ — อีเมลใช้ได้ครั้งแรกครั้งเดียว เพราะ Workspace
  // เปลี่ยนชื่ออีเมลได้ และอีเมลของคนที่ลาออกถูกยกให้คนใหม่ได้ (§17.3)
  const identity = await prisma.userIdentity.findUnique({
    where: {
      provider_providerAccountId: { provider: "google", providerAccountId: profile.subject },
    },
    include: { user: { include: { orgUnits: primaryOrgUnitQuery } } },
  })

  // ⚠️ **การจับคู่ด้วยอีเมลต้องอยู่ในขอบเขต tenant เสมอ** — unique ของ users
  // เป็น [tenantId, email] อีเมลเดียวกันจึงมีได้หลาย tenant เมื่อ D1 กลายเป็น
  // multi-tenant จริง · ถ้าไม่กรอง findFirst จะหยิบแถวไหนก็ได้ = เข้าบัญชีผิดคน
  // วันที่มีหลาย tenant จริง ให้แมป profile.hostedDomain → tenant ที่ตรงนี้
  const tenantId = identity ? null : await resolveTenantIdForGoogle()

  // ⚠️ **ห้ามส่ง tenantId ที่เป็น undefined เข้า where** — Prisma จะเมินตัวกรองนั้นทิ้ง
  // ทั้งอันเงียบ ๆ แล้วกลับไปค้นข้ามทุก tenant ซึ่งคือบั๊กเดียวกับที่กำลังปิดอยู่นี่เอง
  const user =
    identity?.user.deletedAt === null
      ? identity.user
      : tenantId
        ? await prisma.user.findFirst({
            where: { tenantId, email: profile.email, deletedAt: null },
            include: { orgUnits: primaryOrgUnitQuery },
          })
        : null

  if (!user) {
    await writeGoogleDenyAudit(profile, "NO_ACCOUNT", ip, userAgent)
    throw new GoogleLoginError("NO_ACCOUNT")
  }

  if (!user.isActive) {
    await writeGoogleDenyAudit(profile, "INACTIVE", ip, userAgent, user)
    throw new GoogleLoginError("INACTIVE")
  }

  // ⚠️ **ไม่ตรวจ lockedUntil ตรงนี้โดยตั้งใจ** — การล็อกเกิดจากการเดารหัสผ่านผิดซ้ำ ๆ
  // ซึ่งไม่เกี่ยวกับเส้นทางนี้เลย · ถ้าตรวจด้วย ใครก็ตามที่รู้ชื่อผู้ใช้ของคนอื่นจะกด
  // รหัสผิดรัว ๆ เพื่อปิดทาง Google ของคนนั้นได้ กลายเป็นเครื่องมือกลั่นแกล้งแทน
  // การระงับบัญชีจริงใช้ isActive ซึ่งตรวจไปแล้วข้างบน

  const linked = identity === null || identity.user.deletedAt !== null
  const now = new Date()
  const primaryUnitId = user.orgUnits[0]?.orgUnitId ?? null
  const settings = await getSystemSettings(user.tenantId)

  await prisma.$transaction(async (tx) => {
    if (linked) {
      await tx.userIdentity.create({
        data: {
          userId: user.id,
          provider: "google",
          providerAccountId: profile.subject,
          email: profile.email,
          hostedDomain: profile.hostedDomain,
          lastUsedAt: now,
        },
      })

      await writeAudit(tx, {
        tenantId: user.tenantId,
        action: AUDIT_ACTIONS.IDENTITY_LINKED,
        entityType: AUDIT_ENTITY_TYPES.USER_IDENTITY,
        entityId: user.id,
        actorUserId: user.id,
        severity: "NOTICE",
        ip,
        userAgent,
        metadata: {
          username: user.username,
          provider: "google",
          googleSubject: profile.subject,
          email: profile.email,
          hostedDomain: profile.hostedDomain,
        },
      })
    } else {
      await tx.userIdentity.update({ where: { id: identity.id }, data: { lastUsedAt: now } })
    }

    await tx.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
    })
  })

  // ผู้ใช้ที่เข้าด้วย Google ไม่มีรหัสผ่านให้จำ จึงให้เซสชันยาวเท่าที่ตั้งไว้เสมอ
  const sessionId = await createSession({
    userId: user.id,
    activeOrgUnitId: primaryUnitId,
    remember: true,
    absoluteHours: settings.session.absoluteHours,
    authMethod: "GOOGLE",
  })

  resetRateLimit(`google:${ip ?? "unknown"}`)

  await writeAuditStandalone({
    tenantId: user.tenantId,
    action: AUDIT_ACTIONS.LOGIN_GOOGLE,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: user.id,
    actorUserId: user.id,
    actorOrgUnitId: primaryUnitId,
    sessionId,
    ip,
    userAgent,
    metadata: { username: user.username, googleSubject: profile.subject, linked },
  })

  // ไม่คืน mustChangePassword ออกไปโดยตั้งใจ — เซสชันที่ authMethod = GOOGLE
  // ข้ามด่านนั้นที่ requireSession() อยู่แล้ว การพาไปหน้าเปลี่ยนรหัสผ่านจากตรงนี้
  // จะขัดกันเองและพาผู้ใช้ไปหน้าที่เขากรอกอะไรไม่ได้
  return { linked }
}

/**
 * tenant ที่ใช้จับคู่อีเมลจาก Google
 *
 * MVP เป็น single-tenant (D1) จึงคืน tenant เดียวที่มี · แยกเป็นฟังก์ชันไว้เพราะ
 * วันที่มีหลาย tenant จริง จุดที่ต้องแก้คือที่นี่ที่เดียว — แมปจาก hostedDomain
 * ของ Google Workspace ไปเป็น tenant แทนการเดา
 */
async function resolveTenantIdForGoogle(): Promise<string | null> {
  const tenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })

  return tenant?.id ?? null
}

/** สังกัดหลักของผู้ใช้ — ชุดเดียวกับที่ login() ใช้ เพื่อให้ activeOrgUnitId ตรงกัน */
const primaryOrgUnitQuery = {
  where: { orgUnit: { isActive: true } },
  orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  take: 1,
} satisfies Prisma.User$orgUnitsArgs

/**
 * บันทึกการปฏิเสธของเส้นทาง Google
 *
 * ต้องลงทุกครั้งแม้ยังไม่รู้ว่าเป็นผู้ใช้คนไหน — ถ้ามีคนนอกองค์กรพยายามเข้าซ้ำ ๆ
 * ผู้ดูแลต้องเห็นจาก audit ไม่ใช่รู้ตอนที่มีคนเข้าได้แล้ว
 */
async function writeGoogleDenyAudit(
  profile: GoogleProfile,
  reason: GoogleLoginFailure,
  ip: string | null,
  userAgent: string | null,
  user?: { id: string; tenantId: string; username: string },
) {
  const tenantId =
    user?.tenantId ?? (await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } }))?.id

  if (!tenantId) return

  await writeAuditStandalone({
    tenantId,
    action: AUDIT_ACTIONS.LOGIN_FAILED,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: user?.id ?? profile.subject,
    actorUserId: user?.id ?? null,
    result: "DENY",
    severity: "WARNING",
    ip,
    userAgent,
    metadata: {
      provider: "google",
      reason,
      googleSubject: profile.subject,
      email: profile.email,
      hostedDomain: profile.hostedDomain,
      ...(user ? { username: user.username } : {}),
    },
  })
}
