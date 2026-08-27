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

import {
  E2E_ADMIN_PASSWORD,
  E2E_ADMIN_USERNAME,
  E2E_NOTIFICATION,
  E2E_PASSWORD,
  E2E_PREFIX,
  E2E_SEARCH_SUBJECT,
  E2E_USERNAME,
} from "./constants"

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
 * ผู้ใช้ฝั่งผู้ดูแลระบบของ e2e — ใช้เฉพาะชุดที่ต้องเปิดหน้าใต้ /admin
 *
 * ⚠️ แยกคนกับ `e2e.runner` โดยตั้งใจ ดูเหตุผลใน constants.ts
 */
export async function ensureE2EAdminUser() {
  const tenant = await prisma.tenant.findFirst({ where: { code: "KRIRK" } })
  if (!tenant) throw new Error("ยังไม่ได้ seed ฐานข้อมูล — รัน pnpm db:seed ก่อน")

  const orgUnit = await prisma.orgUnit.findFirst({
    where: { tenantId: tenant.id, code: "510000", canIssueNumber: true },
  })
  const role = await prisma.role.findFirst({ where: { code: "SYSTEM_ADMIN" } })

  if (!orgUnit || !role) throw new Error("ข้อมูล seed ไม่ครบ (หน่วยงาน 510000 หรือบทบาทผู้ดูแล)")

  const passwordHash = await hash(E2E_ADMIN_PASSWORD, ARGON2_OPTIONS)

  const user = await prisma.user.upsert({
    where: { username: E2E_ADMIN_USERNAME },
    update: {
      passwordHash,
      mustChangePassword: false,
      isActive: true,
      deletedAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
      clearanceLevel: 3,
    },
    create: {
      tenantId: tenant.id,
      username: E2E_ADMIN_USERNAME,
      passwordHash,
      prefix: "นาย",
      firstName: "อีทูอี",
      lastName: "ผู้ดูแลระบบ",
      email: "e2e.admin@example.invalid",
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
      positionTitle: "ผู้ดูแลระบบสำหรับทดสอบอัตโนมัติ",
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
 * เตรียมแจ้งเตือนให้เคสกระดิ่งมีของจริงให้ดู
 *
 * ต้องมีเอกสารจริงรองรับ เพราะ `listNotifications()` กรองผ่านด่านการมองเห็นเอกสาร —
 * แถวที่ชี้ไปยังเอกสารที่ไม่มีอยู่จะถูกตัดทิ้ง ซึ่งเป็นพฤติกรรมที่เคสหนึ่งจงใจทดสอบ
 *
 * ⚠️ เขียนตรงเข้าตารางแทนที่จะเดินผ่าน service เพราะทุก transition ตัด "ผู้ลงมือ"
 * ออกจากรายชื่อผู้รับเสมอ · e2e ล็อกอินเป็นคนเดียวตลอด ถ้าให้มันกดเอง
 * มันจะไม่มีวันได้รับแจ้งเตือนของตัวเองเลยสักรอบ
 */
export async function ensureE2ENotifications() {
  const user = await prisma.user.findUnique({ where: { username: E2E_USERNAME } })
  if (!user) throw new Error("ยังไม่ได้สร้างบัญชี e2e")

  const orgUnit = await prisma.orgUnit.findFirst({
    where: { tenantId: user.tenantId, code: "510000" },
  })
  const documentType = await prisma.documentType.findFirst({
    where: { tenantId: user.tenantId, direction: "INTERNAL", isActive: true },
  })

  if (!orgUnit || !documentType) throw new Error("ข้อมูล seed ไม่ครบ")

  const document = await prisma.document.create({
    data: {
      tenantId: user.tenantId,
      documentTypeId: documentType.id,
      direction: "INTERNAL",
      status: "DRAFT",
      bookCode: documentType.defaultBookCode,
      subject: `${E2E_PREFIX} เอกสารรองรับการแจ้งเตือน`,
      confidentialityLevel: 0,
      urgencyLevel: 0,
      ownerUnitId: orgUnit.id,
      createdById: user.id,
      createdByUnitId: orgUnit.id,
    },
  })

  await prisma.notification.createMany({
    data: [
      {
        userId: user.id,
        type: "document.circulated",
        title: E2E_NOTIFICATION.visible,
        body: "เอกสารที่ยังเปิดได้ จึงต้องแสดงบนกระดิ่ง",
        refType: "DOCUMENT",
        refId: document.id,
      },
      {
        // ⚠️ ชี้ไปยังเอกสารที่ไม่มีอยู่จริง — ด่านการมองเห็นต้องกรองทิ้ง
        userId: user.id,
        type: "document.closed",
        title: E2E_NOTIFICATION.orphan,
        body: "เอกสารถูกลบไปแล้ว จึงต้องไม่โผล่บนกระดิ่ง",
        refType: "DOCUMENT",
        refId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      },
    ],
  })

  return document.id
}

/**
 * เตรียมเอกสารให้เคสค้นหาภาษาไทยมีของจริงให้ค้นเจอ
 *
 * ⚠️ เคสนี้เคยพึ่งเอกสารที่บังเอิญมีคำว่า "อบรม" อยู่บนฐาน dev — ฐานที่ seed สด
 * ไม่มีเลย เคสจึงแดงบน CI รอบแรกทั้งที่หน้าค้นหาตอบ "พบ 0 ฉบับ" อย่างถูกต้อง
 *
 * ชั้นความลับ 0 โดยตั้งใจ — เคสนี้ตรวจว่า pg_trgm ค้นคำกลางประโยคภาษาไทยได้
 * ไม่ได้ตรวจด่านสิทธิ์ ซึ่งมีชุดของตัวเองอยู่แล้ว
 */
export async function ensureE2ESearchDocument() {
  const user = await prisma.user.findUnique({ where: { username: E2E_USERNAME } })
  if (!user) throw new Error("ยังไม่ได้สร้างบัญชี e2e")

  const existing = await prisma.document.findFirst({ where: { subject: E2E_SEARCH_SUBJECT } })
  if (existing) return existing.id

  const orgUnit = await prisma.orgUnit.findFirst({
    where: { tenantId: user.tenantId, code: "510000" },
  })
  const documentType = await prisma.documentType.findFirst({
    where: { tenantId: user.tenantId, direction: "INTERNAL", isActive: true },
  })

  if (!orgUnit || !documentType) throw new Error("ข้อมูล seed ไม่ครบ")

  const document = await prisma.document.create({
    data: {
      tenantId: user.tenantId,
      documentTypeId: documentType.id,
      direction: "INTERNAL",
      status: "DRAFT",
      bookCode: documentType.defaultBookCode,
      subject: E2E_SEARCH_SUBJECT,
      confidentialityLevel: 0,
      urgencyLevel: 0,
      ownerUnitId: orgUnit.id,
      createdById: user.id,
      createdByUnitId: orgUnit.id,
    },
  })

  return document.id
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

  const ids = documents.map((row) => row.id)

  // การแจ้งเตือนอ้างเอกสารด้วย refId ที่ไม่มี FK — ลบเอกสารเฉย ๆ จะเหลือแถวกำพร้าค้างฐาน
  //
  // ⚠️ อยู่**ก่อน** ด่าน "ไม่มีเอกสารก็จบ" โดยตั้งใจ — แถวที่ fixture ตั้งใจให้กำพร้า
  // ไม่มีเอกสารรองรับอยู่แล้ว ถ้าวางไว้หลังด่านนั้นมันจะค้างฐานตลอดไป
  await prisma.notification.deleteMany({
    where: { OR: [{ refId: { in: ids } }, { title: { startsWith: E2E_PREFIX } }] },
  })

  if (documents.length === 0) return 0

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
      await ensureE2EAdminUser()
      await ensureE2ENotifications()
      await ensureE2ESearchDocument()
      console.log(`[e2e] พร้อมใช้บัญชี ${user.username} พร้อมแจ้งเตือนและเอกสารตัวอย่าง`)
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
