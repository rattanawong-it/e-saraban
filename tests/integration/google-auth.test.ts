import "dotenv/config"

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { clearAllRateLimits } from "@/lib/auth"
import type { GoogleProfile } from "@/lib/auth/providers/google"
import { prisma } from "@/lib/db"
import { GoogleLoginError, loginWithGoogle } from "@/server/services/auth.service"

import { __resetRequestState } from "../stubs/next-headers"

// เข้าสู่ระบบด้วย Google (spec §17.3 · D19) — ยิงผ่าน service ตัวจริงบน Postgres จริง
//
// ชุดนี้เฝ้าด่านที่ **ถ้าพังแล้วคนนอกองค์กรเดินเข้าระบบสารบรรณได้** เป็นหลัก:
//   1. อีเมลที่ Google ยังไม่ยืนยัน ต้องเข้าไม่ได้
//   2. โดเมนนอก Workspace ขององค์กร ต้องเข้าไม่ได้ (ตรวจจาก id_token ไม่ใช่จากที่ส่งไป)
//   3. คนที่ยังไม่มีบัญชีในระบบ ต้องเข้าไม่ได้ และ **ต้องไม่ถูกสร้างบัญชีให้อัตโนมัติ**
//   4. บัญชีที่ถูกระงับ ต้องเข้าไม่ได้
// และเฝ้าพฤติกรรมที่ตั้งใจออกแบบไว้อีกสามข้อ — จับคู่ด้วย sub ไม่ใช่อีเมล ·
// เซสชันต้องรู้ว่าเข้ามาด้วยวิธีไหน · บัญชีที่ถูกล็อกจากการเดารหัสผ่านต้องยังเข้าด้วย Google ได้

const ALLOWED_HD = "krirk.ac.th"

const USER_EMAIL = "integration.google@krirk.ac.th"
const INACTIVE_EMAIL = "integration.google-inactive@krirk.ac.th"

const SUBJECT_ACTIVE = "integration-google-sub-active"
const SUBJECT_INACTIVE = "integration-google-sub-inactive"
const SUBJECT_STRANGER = "integration-google-sub-stranger"

let tenantId: string
let activeUserId: string
let inactiveUserId: string

function profile(overrides: Partial<GoogleProfile> = {}): GoogleProfile {
  return {
    subject: SUBJECT_ACTIVE,
    email: USER_EMAIL,
    emailVerified: true,
    hostedDomain: ALLOWED_HD,
    name: "ผู้ใช้ทดสอบ Google",
    ...overrides,
  }
}

/** เซสชันล่าสุดของผู้ใช้ — service คืนแค่ผลลัพธ์ ไม่คืน id ของเซสชันออกมา */
async function latestSession(userId: string) {
  return prisma.session.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } })
}

beforeAll(async () => {
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } })
  if (!tenant) throw new Error("ยังไม่มี tenant บนฐานทดสอบ — รัน pnpm db:seed ก่อน")
  tenantId = tenant.id

  // สร้างผู้ใช้เอง ไม่ยืมจาก seed (กติกาใน tests/integration/fixtures/users.ts)
  //
  // mustChangePassword = true โดยตั้งใจ — เป็นสภาพจริงของบัญชีที่ผู้ดูแลเพิ่งสร้างให้
  // หรือคำขอสมัครที่เพิ่งอนุมัติ ซึ่งเป็นเคสที่ §17.3 ต้องรับให้ได้
  const active = await prisma.user.upsert({
    where: { username: "integration.google-user" },
    update: { isActive: true, deletedAt: null, email: USER_EMAIL, lockedUntil: null },
    create: {
      tenantId,
      username: "integration.google-user",
      passwordHash: "integration-test-user-never-logs-in",
      email: USER_EMAIL,
      firstName: "ทดสอบ",
      lastName: "กูเกิล",
      mustChangePassword: true,
    },
  })

  const inactive = await prisma.user.upsert({
    where: { username: "integration.google-inactive" },
    update: { isActive: false, deletedAt: null, email: INACTIVE_EMAIL },
    create: {
      tenantId,
      username: "integration.google-inactive",
      passwordHash: "integration-test-user-never-logs-in",
      email: INACTIVE_EMAIL,
      firstName: "ทดสอบ",
      lastName: "ถูกระงับ",
      isActive: false,
      mustChangePassword: false,
    },
  })

  activeUserId = active.id
  inactiveUserId = inactive.id
})

beforeEach(async () => {
  __resetRequestState()

  // ด่านกันยิงถี่นับต่อ IP และ IP ของเทสต์เป็นค่าเดียวกันทุกเคส —
  // ไม่ล้างแล้วเคสท้าย ๆ จะแดงด้วย RATE_LIMIT ทั้งที่ตรรกะถูกต้อง
  clearAllRateLimits()

  await prisma.userIdentity.deleteMany({
    where: { userId: { in: [activeUserId, inactiveUserId] } },
  })
  await prisma.session.deleteMany({ where: { userId: { in: [activeUserId, inactiveUserId] } } })
})

afterAll(async () => {
  await prisma.userIdentity.deleteMany({
    where: { userId: { in: [activeUserId, inactiveUserId] } },
  })
  await prisma.session.deleteMany({ where: { userId: { in: [activeUserId, inactiveUserId] } } })
})

describe("ด่านที่กันคนนอกออกจากระบบ", () => {
  it("อีเมลที่ Google ยังไม่ยืนยัน เข้าไม่ได้", async () => {
    await expect(loginWithGoogle(profile({ emailVerified: false }), ALLOWED_HD)).rejects.toThrow(
      GoogleLoginError,
    )

    expect(await latestSession(activeUserId)).toBeNull()
  })

  it("โดเมนนอก Workspace ขององค์กร เข้าไม่ได้แม้อีเมลจะตรงกับบัญชีในระบบ", async () => {
    const attempt = loginWithGoogle(profile({ hostedDomain: "gmail.com" }), ALLOWED_HD).catch(
      (error: unknown) => error,
    )

    expect(await attempt).toMatchObject({ reason: "DOMAIN_NOT_ALLOWED" })
    expect(await latestSession(activeUserId)).toBeNull()
  })

  it("บัญชีส่วนตัวที่ไม่มี hd เลย เข้าไม่ได้", async () => {
    const attempt = loginWithGoogle(profile({ hostedDomain: null }), ALLOWED_HD).catch(
      (error: unknown) => error,
    )

    expect(await attempt).toMatchObject({ reason: "DOMAIN_NOT_ALLOWED" })
  })

  it("คนที่ยังไม่มีบัญชีในระบบ เข้าไม่ได้ และไม่ถูกสร้างบัญชีให้", async () => {
    const strangerEmail = "integration.google-stranger@krirk.ac.th"

    const attempt = loginWithGoogle(
      profile({ subject: SUBJECT_STRANGER, email: strangerEmail }),
      ALLOWED_HD,
    ).catch((error: unknown) => error)

    expect(await attempt).toMatchObject({ reason: "NO_ACCOUNT" })

    // ข้อสำคัญที่สุดของชุดนี้ — ห้าม auto-provision เด็ดขาด (§17.3)
    expect(await prisma.user.findFirst({ where: { email: strangerEmail } })).toBeNull()
  })

  it("บัญชีที่ถูกระงับ เข้าไม่ได้", async () => {
    const attempt = loginWithGoogle(
      profile({ subject: SUBJECT_INACTIVE, email: INACTIVE_EMAIL }),
      ALLOWED_HD,
    ).catch((error: unknown) => error)

    expect(await attempt).toMatchObject({ reason: "INACTIVE" })
    expect(await latestSession(inactiveUserId)).toBeNull()
  })
})

describe("เส้นทางที่เข้าได้", () => {
  it("ครั้งแรกผูกบัญชีด้วยอีเมล แล้วเก็บ sub ไว้ใช้ครั้งต่อไป", async () => {
    const result = await loginWithGoogle(profile(), ALLOWED_HD)

    expect(result.linked).toBe(true)

    const identity = await prisma.userIdentity.findUnique({
      where: {
        provider_providerAccountId: { provider: "google", providerAccountId: SUBJECT_ACTIVE },
      },
    })

    expect(identity).toMatchObject({
      userId: activeUserId,
      email: USER_EMAIL,
      hostedDomain: ALLOWED_HD,
    })
  })

  it("เซสชันต้องจำได้ว่าเข้ามาด้วย Google — ด่านบังคับเปลี่ยนรหัสผ่านใช้ค่านี้ตัดสิน", async () => {
    await loginWithGoogle(profile(), ALLOWED_HD)

    const session = await latestSession(activeUserId)

    expect(session?.authMethod).toBe("GOOGLE")

    // ค่าในตาราง users ต้องไม่ถูกแก้ — ถ้าวันหลังเขากลับมาล็อกอินด้วยรหัสผ่าน
    // ต้องยังโดนบังคับเปลี่ยนรหัสผ่านครั้งแรกตามปกติ (§8.4)
    const user = await prisma.user.findUnique({ where: { id: activeUserId } })
    expect(user?.mustChangePassword).toBe(true)
  })

  it("ครั้งต่อไปจับคู่ด้วย sub — อีเมลที่ Google ส่งมาเปลี่ยนไปแล้วก็ยังเข้าบัญชีเดิม", async () => {
    await loginWithGoogle(profile(), ALLOWED_HD)

    // สภาพจริงที่เกิดได้: Workspace เปลี่ยนชื่ออีเมลของคนคนนี้
    const second = await loginWithGoogle(
      profile({ email: "integration.google-renamed@krirk.ac.th" }),
      ALLOWED_HD,
    )

    expect(second.linked).toBe(false)

    const identities = await prisma.userIdentity.findMany({ where: { userId: activeUserId } })
    expect(identities).toHaveLength(1)
    expect(identities[0]?.lastUsedAt).not.toBeNull()
  })

  it("บัญชีที่ถูกล็อกจากการเดารหัสผ่าน ยังเข้าด้วย Google ได้", async () => {
    // ถ้าด่านนี้ไปตรวจ lockedUntil ด้วย ใครที่รู้ชื่อผู้ใช้ของคนอื่นจะกดรหัสผิดรัว ๆ
    // เพื่อปิดทาง Google ของคนนั้นได้ กลายเป็นเครื่องมือกลั่นแกล้ง (§17.3)
    await prisma.user.update({
      where: { id: activeUserId },
      data: { failedLoginCount: 9, lockedUntil: new Date(Date.now() + 60 * 60 * 1000) },
    })

    await expect(loginWithGoogle(profile(), ALLOWED_HD)).resolves.toMatchObject({ linked: true })

    const user = await prisma.user.findUnique({ where: { id: activeUserId } })
    expect(user?.lockedUntil).toBeNull()
    expect(user?.failedLoginCount).toBe(0)
  })

  it("ไม่จำกัดโดเมน (ค่าว่างใน env) แล้วบัญชีที่มีอยู่จริงยังเข้าได้", async () => {
    const result = await loginWithGoogle(profile({ hostedDomain: null }), null)

    expect(result.linked).toBe(true)
  })
})
