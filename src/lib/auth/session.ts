import "server-only"

import { cookies, headers } from "next/headers"
import { jwtVerify, SignJWT } from "jose"

import type { AuthMethod } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"
import { DEFAULT_SETTINGS } from "@/lib/settings/definitions"

// เซสชันตาม spec §8.4:
// "JWT ลงนามด้วย jose ใน cookie (httpOnly + Secure + SameSite=Lax)
//  **+ ตาราง Session** เพื่อให้ revoke ได้จริง · idle timeout 30 นาที · absolute 8 ชม."
//
// ทำไมต้องมีทั้งสองอย่าง: JWT เพียงอย่างเดียว revoke ไม่ได้จนกว่าจะหมดอายุ
// ผู้ดูแลระบบจึงเตะผู้ใช้ที่ถูกระงับออกจากระบบทันทีไม่ได้ ซึ่งรับไม่ได้กับ
// ระบบที่มีเอกสารชั้นความลับ — ตาราง Session คือด่านที่ทำให้ revoke มีผลจริง

export const SESSION_COOKIE = "esaraban-session"

const JWT_ISSUER = "e-saraban"
const JWT_AUDIENCE = "e-saraban-app"

/** กุญแจลงนามของระบบ — ใช้ทั้งเซสชันและ state ของ OAuth (src/lib/auth/providers) */
export function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET

  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET ไม่ถูกตั้งค่าหรือสั้นเกินไป (ต้องยาว ≥ 32 ตัวอักษร) — ดู .env.example",
    )
  }

  return new TextEncoder().encode(secret)
}

interface SessionTokenPayload {
  sid: string
  uid: string
}

async function signSessionToken(payload: SessionTokenPayload, expiresAt: Date): Promise<string> {
  return new SignJWT({ uid: payload.uid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sid)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getAuthSecret())
}

async function readSessionToken(token: string): Promise<SessionTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })

    if (typeof payload.sub !== "string" || typeof payload.uid !== "string") return null
    return { sid: payload.sub, uid: payload.uid }
  } catch {
    return null
  }
}

export interface CreateSessionInput {
  userId: string
  activeOrgUnitId: string | null
  /** วิธีที่ผู้ใช้ยืนยันตัวตนของเซสชันนี้ — ปริยายคือรหัสผ่าน (spec §17.3) */
  authMethod?: AuthMethod
  /** true = ผู้ใช้ติ๊ก "จดจำการเข้าสู่ระบบ" → ใช้ absolute timeout เต็ม */
  remember: boolean
  absoluteHours?: number
}

/** สร้างเซสชันใหม่ + ตั้ง cookie — เรียกหลังตรวจรหัสผ่านผ่านแล้วเท่านั้น */
export async function createSession(input: CreateSessionInput): Promise<string> {
  const absoluteHours = input.absoluteHours ?? DEFAULT_SETTINGS.session.absoluteHours
  const hours = input.remember ? absoluteHours : Math.min(absoluteHours, 2)
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000)

  const { ip, userAgent } = await getRequestMeta()

  const session = await prisma.session.create({
    data: {
      userId: input.userId,
      activeOrgUnitId: input.activeOrgUnitId,
      authMethod: input.authMethod ?? "PASSWORD",
      ip,
      userAgent,
      expiresAt,
    },
  })

  const token = await signSessionToken({ sid: session.id, uid: input.userId }, expiresAt)
  const store = await cookies()

  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  })

  return session.id
}

export interface ActiveSession {
  id: string
  userId: string
  activeOrgUnitId: string | null
  authMethod: AuthMethod
  ip: string | null
  userAgent: string | null
  expiresAt: Date
}

/**
 * อ่านเซสชันปัจจุบันและตรวจว่ายังใช้ได้อยู่
 *
 * ตรวจ 4 อย่าง: ลายเซ็น JWT · แถวยังอยู่ · ยังไม่ถูก revoke ·
 * ยังไม่เกิน absolute และ idle timeout
 *
 * ผลข้างเคียง: อัปเดต `lastSeenAt` เพื่อให้ idle timeout เดินต่อ
 */
export async function getActiveSession(): Promise<ActiveSession | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  const payload = await readSessionToken(token)
  if (!payload) return null

  const session = await prisma.session.findUnique({ where: { id: payload.sid } })
  if (!session || session.userId !== payload.uid) return null
  if (session.revokedAt) return null

  const now = new Date()
  if (session.expiresAt <= now) return null

  const idleMs = DEFAULT_SETTINGS.session.idleMinutes * 60 * 1000
  if (now.getTime() - session.lastSeenAt.getTime() > idleMs) {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: now },
    })
    return null
  }

  // ลด write ที่ไม่จำเป็น — แตะฐานข้อมูลเมื่อผ่านไปแล้วเกิน 1 นาทีเท่านั้น
  if (now.getTime() - session.lastSeenAt.getTime() > 60_000) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now } })
  }

  return {
    id: session.id,
    userId: session.userId,
    activeOrgUnitId: session.activeOrgUnitId,
    authMethod: session.authMethod,
    ip: session.ip,
    userAgent: session.userAgent,
    expiresAt: session.expiresAt,
  }
}

/** เปลี่ยนหน่วยงานที่กำลังทำงานอยู่ (Context Switcher · spec §5.2) */
export async function setActiveOrgUnit(sessionId: string, orgUnitId: string): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: { activeOrgUnitId: orgUnitId },
  })
}

/** ออกจากระบบ — revoke แถวใน DB แล้วลบ cookie */
export async function destroySession(sessionId?: string): Promise<void> {
  const store = await cookies()

  if (sessionId) {
    await prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  store.delete(SESSION_COOKIE)
}

/** เตะทุกเซสชันของผู้ใช้ — ใช้ตอนระงับบัญชีหรือรีเซ็ตรหัสผ่าน */
export async function revokeAllSessions(userId: string): Promise<number> {
  const result = await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  return result.count
}

/**
 * อ่าน IP และ User-Agent ของ request ปัจจุบัน
 *
 * nginx ตั้ง X-Forwarded-For ให้แล้ว (ดู docker/nginx/conf.d/default.conf)
 * เอาค่าตัวแรกในรายการซึ่งเป็น client จริง
 */
export async function getRequestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const headerList = await headers()

  const forwarded = headerList.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? null

  return { ip, userAgent: headerList.get("user-agent") }
}
