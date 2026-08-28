import "server-only"

import { redirect } from "next/navigation"

import type { ConfidentialityLevel } from "@/constants"
import { getActiveSession, setActiveOrgUnit } from "@/lib/auth"
import { can, type Permission } from "@/lib/authz"
import { prisma } from "@/lib/db"

import type { AppSession, CurrentUser, ServiceContext, UserAffiliation } from "./context"
import { resolveIdentity } from "./repositories/identity.repository"

// จุดเดียวที่แปลง "cookie ของ request" → "ServiceContext ที่ service ใช้ได้"
//
// ทุกหน้าใน (app) และทุก Server Action ต้องเรียกผ่านที่นี่
// ห้ามอ่าน session เองที่อื่น เพราะการตรวจ mustChangePassword / บัญชีถูกระงับ
// อยู่ในนี้ที่เดียว — กระจายไปที่อื่นแล้วจะมีหน้าที่ลืมตรวจ

export const LOGIN_PATH = "/login"
export const CHANGE_PASSWORD_PATH = "/change-password"

/** โหลดเซสชันปัจจุบัน — คืน null เมื่อยังไม่ได้ล็อกอินหรือเซสชันหมดอายุ */
export async function getAppSession(): Promise<AppSession | null> {
  const session = await getActiveSession()
  if (!session) return null

  const identity = await resolveIdentity(session.userId, session.activeOrgUnitId)
  if (!identity || !identity.user.isActive) return null

  // ผู้ใช้ยังไม่ได้เลือกหน่วยงาน หรือหน่วยงานเดิมถูกถอดสังกัดไปแล้ว
  // → เลือกสังกัดหลักให้อัตโนมัติ แล้วโหลดสิทธิ์ใหม่ตามหน่วยงานนั้น
  let activeOrgUnitId = session.activeOrgUnitId
  let resolved = identity

  const stillMember = identity.affiliations.some((a) => a.orgUnitId === activeOrgUnitId)

  if (!activeOrgUnitId || !stillMember) {
    const fallback = identity.affiliations[0]?.orgUnitId ?? null

    if (fallback) {
      await setActiveOrgUnit(session.id, fallback)
      activeOrgUnitId = fallback
      resolved = (await resolveIdentity(session.userId, fallback)) ?? identity
    } else {
      activeOrgUnitId = null
    }
  }

  const ctx: ServiceContext = {
    userId: resolved.user.id,
    tenantId: resolved.user.tenantId,
    isActive: resolved.user.isActive,
    activeOrgUnitId,
    activeOrgUnitPath: resolved.activeOrgUnitPath,
    orgUnitIds: resolved.orgUnitIds,
    roleCodes: resolved.roleCodes,
    permissions: resolved.permissions,
    clearanceLevel: clampClearance(resolved.user.clearanceLevel),
    sessionId: session.id,
    ip: session.ip,
    userAgent: session.userAgent,
  }

  const user: CurrentUser = {
    id: resolved.user.id,
    username: resolved.user.username,
    prefix: resolved.user.prefix,
    firstName: resolved.user.firstName,
    lastName: resolved.user.lastName,
    email: resolved.user.email,
    fullName: formatFullName(resolved.user),
    initials: makeInitials(resolved.user.firstName, resolved.user.lastName),
    clearanceLevel: resolved.user.clearanceLevel,
    mustChangePassword: resolved.user.mustChangePassword,
  }

  const affiliations: UserAffiliation[] = resolved.affiliations
  const activeAffiliation = affiliations.find((a) => a.orgUnitId === activeOrgUnitId) ?? null

  return { ctx, authMethod: session.authMethod, user, affiliations, activeAffiliation }
}

/**
 * บังคับว่าต้องล็อกอินแล้ว — ใช้ในทุกหน้าใต้ (app)
 *
 * บัญชีที่ยังไม่เปลี่ยนรหัสผ่านครั้งแรก (spec §8.4) จะถูกส่งไปหน้าเปลี่ยนรหัสผ่าน
 * ก่อนเสมอ ยกเว้นตอนอยู่ที่หน้านั้นเอง
 */
export async function requireSession(options: { skipPasswordCheck?: boolean } = {}) {
  const session = await getAppSession()
  if (!session) redirect(LOGIN_PATH)

  // ⚠️ **เซสชันที่เข้าด้วย Google ข้ามด่านนี้โดยตั้งใจ** (spec §17.3 · D19)
  //
  // จุดประสงค์ของ §8.4 ข้อนี้คือกันไม่ให้ใช้รหัสผ่านชั่วคราวที่คนอื่นรู้ต่อไปเรื่อย ๆ
  // ซึ่งคนที่เข้าด้วย Google ไม่ได้ใช้รหัสผ่านนั้นอยู่แล้ว · ถ้าไม่ข้าม เขาจะถูกเด้งมา
  // หน้าที่ขอ "รหัสผ่านปัจจุบัน" ที่เขาไม่มี แล้วออกไปไหนไม่ได้เลยทั้งที่ล็อกอินสำเร็จ
  //
  // ค่า mustChangePassword ในตาราง users ยังเป็น true เหมือนเดิม —
  // วันที่เขากลับมาล็อกอินด้วยรหัสผ่านจะโดนบังคับเปลี่ยนตามปกติ
  const skipForGoogle = session.authMethod === "GOOGLE"

  if (!options.skipPasswordCheck && !skipForGoogle && session.user.mustChangePassword) {
    redirect(CHANGE_PASSWORD_PATH)
  }

  return session
}

/**
 * บังคับว่าต้องมีสิทธิ์ที่ระบุ — ใช้กับหน้า /admin/*
 *
 * ⚠️ นี่คือการตรวจ "เพื่อเลือกว่าจะ render หน้าไหม" เท่านั้น
 * service ที่ทำงานจริงต้องตรวจสิทธิ์ซ้ำเองอีกครั้งตาม spec §11.3 ข้อ 2
 */
export async function requirePermission(permission: Permission) {
  const session = await requireSession()

  if (!can(session.ctx, permission).allowed) {
    redirect("/dashboard")
  }

  return session
}

/** ผู้ใช้คนนี้อยู่ในหน่วยงานที่ระบุ (หรือหน่วยงานลูกของมัน) หรือไม่ */
export async function isMemberOfSubtree(ctx: ServiceContext, path: string): Promise<boolean> {
  const units = await prisma.orgUnit.findMany({
    where: { id: { in: [...ctx.orgUnitIds] } },
    select: { path: true },
  })

  return units.some((unit) => path.startsWith(unit.path))
}

function clampClearance(level: number): ConfidentialityLevel {
  const clamped = Math.min(Math.max(level, 0), 3)
  return clamped as ConfidentialityLevel
}

export function formatFullName(user: {
  prefix: string | null
  firstName: string
  lastName: string
}): string {
  return `${user.prefix ?? ""}${user.firstName} ${user.lastName}`.trim()
}

export function makeInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`
}
