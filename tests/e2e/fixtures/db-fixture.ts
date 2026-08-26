import "dotenv/config"

import { hash } from "@node-rs/argon2"

import { prisma } from "@/lib/db"

// ผู้ใช้เฉพาะของ e2e — ไม่ยืมบัญชีจริงของใคร
//
// ทำไมไม่ใช้บัญชี seed: บัญชี seed ทุกตัวถูกบังคับเปลี่ยนรหัสผ่านตอนเข้าครั้งแรก
// (`mustChangePassword: true`) พอล็อกอินเสร็จจะถูกส่งไปหน้าเปลี่ยนรหัสทันที ไม่ถึงหน้าที่จะทดสอบ
//
// ทำไมไม่ใช้บัญชีของผู้พัฒนา: รหัสผ่านของคนจริงไม่ควรอยู่ในโค้ดที่ commit ขึ้น git
// และเทสต์ที่พึ่งบัญชีของใครคนหนึ่งจะพังทันทีที่เขาเปลี่ยนรหัสหรือถูกปรับสิทธิ์

import { E2E_PASSWORD, E2E_PREFIX, E2E_USERNAME } from "./constants"

// ตรงกับ ARGON2_OPTIONS ของ prisma/seed.ts — ถ้าไม่ตรง แฮชที่ได้จะตรวจไม่ผ่านตอนล็อกอิน
const ARGON2_OPTIONS = { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const

/**
 * สร้าง (หรืออัปเดต) ผู้ใช้ของ e2e ให้พร้อมล็อกอิน — เรียกซ้ำได้เสมอ
 *
 * ให้บทบาท CENTRAL_REGISTRAR เพราะเส้นทางที่ทดสอบครอบคลุมทั้งการร่าง ออกเลข และดูรายงาน
 * ซึ่งเป็นงานของสารบรรณกลาง
 */
export async function ensureE2EUser() {
  const tenant = await prisma.tenant.findFirst({ where: { code: "KRIRK" } })
  if (!tenant) throw new Error("ยังไม่ได้ seed ฐานข้อมูล — รัน pnpm db:seed ก่อน")

  const orgUnit = await prisma.orgUnit.findFirst({
    where: { tenantId: tenant.id, code: "510000", canIssueNumber: true },
  })
  // Role ไม่ผูกกับ tenant — เป็นบทบาทของทั้งระบบ (ดู schema.prisma)
  const role = await prisma.role.findFirst({ where: { code: "CENTRAL_REGISTRAR" } })

  if (!orgUnit || !role)
    throw new Error("ข้อมูล seed ไม่ครบ (หน่วยงาน 510000 หรือบทบาทสารบรรณกลาง)")

  const passwordHash = await hash(E2E_PASSWORD, ARGON2_OPTIONS)

  const user = await prisma.user.upsert({
    where: { username: E2E_USERNAME },
    update: {
      passwordHash,
      // ⚠️ ต้องปิดทุกครั้ง ไม่ใช่แค่ตอนสร้าง — ถ้ามีเทสต์ไหนไปเปลี่ยนรหัสผ่านจนธงกลับมาเป็น true
      // รอบถัดไปจะเด้งไปหน้าเปลี่ยนรหัสแล้วเทสต์แดงยกชุดโดยหาสาเหตุยาก
      mustChangePassword: false,
      isActive: true,
      deletedAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
      clearanceLevel: 3,
    },
    create: {
      tenantId: tenant.id,
      username: E2E_USERNAME,
      passwordHash,
      prefix: "นาย",
      firstName: "อีทูอี",
      lastName: "ทดสอบระบบ",
      email: "e2e@example.invalid",
      clearanceLevel: 3,
      mustChangePassword: false,
    },
  })

  await prisma.userOrgUnit.upsert({
    where: { userId_orgUnitId: { userId: user.id, orgUnitId: orgUnit.id } },
    update: { isPrimary: true },
    create: {
      userId: user.id,
      orgUnitId: orgUnit.id,
      positionTitle: "ผู้ใช้สำหรับทดสอบอัตโนมัติ",
      isPrimary: true,
    },
  })

  await prisma.userRole.upsert({
    where: { userId_roleId_orgUnitId: { userId: user.id, roleId: role.id, orgUnitId: orgUnit.id } },
    update: {},
    create: { userId: user.id, roleId: role.id, orgUnitId: orgUnit.id },
  })

  return user
}

/**
 * ลบเอกสารที่ e2e สร้างไว้
 *
 * ⚠️ ไม่ลบตัวผู้ใช้ เพราะ audit log อ้างถึง `actorUserId` แบบ onDelete: Restrict
 * และ audit เป็นตาราง append-only ที่ลบแถวไม่ได้เลย (§8.5) — บัญชีจึงต้องอยู่ต่อ
 */
export async function cleanupE2EDocuments() {
  const documents = await prisma.document.findMany({
    where: { subject: { startsWith: E2E_PREFIX } },
    select: { id: true },
  })

  if (documents.length === 0) return 0

  const ids = documents.map((row) => row.id)

  await prisma.documentAcl.deleteMany({ where: { documentId: { in: ids } } })
  await prisma.documentRecipient.deleteMany({ where: { documentId: { in: ids } } })
  await prisma.documentAction.deleteMany({ where: { documentId: { in: ids } } })
  await prisma.attachment.deleteMany({ where: { documentId: { in: ids } } })
  await prisma.document.deleteMany({ where: { id: { in: ids } } })

  return ids.length
}

// ── เรียกจากบรรทัดคำสั่ง (globalSetup/globalTeardown ของ Playwright สั่งผ่าน tsx) ──
//
// ต้องรันคนละโปรเซสกับตัวเทสต์ เพราะ Playwright แปลงไฟล์เทสต์เป็น CommonJS
// แล้วโหลด Prisma client ที่เป็น ESM ไม่ได้
const command = process.argv[2]

if (command) {
  const run = async () => {
    if (command === "ensure") {
      const user = await ensureE2EUser()
      console.log(`[e2e] พร้อมใช้บัญชี ${user.username}`)
    } else if (command === "cleanup") {
      const removed = await cleanupE2EDocuments()
      console.log(`[e2e] ลบเอกสารที่เทสต์สร้างไว้ ${removed} ฉบับ`)
    } else {
      throw new Error(`ไม่รู้จักคำสั่ง "${command}" (ใช้ ensure หรือ cleanup)`)
    }
  }

  run()
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
