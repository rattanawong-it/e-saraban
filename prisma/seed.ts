import { readFileSync } from "node:fs"

import { hash } from "@node-rs/argon2"

import { DEFAULT_ROLES, PERMISSION_META } from "../src/lib/authz/matrix"
import { prisma } from "../src/lib/db"
import { DEFAULT_SETTINGS, SETTING_KEYS } from "../src/lib/settings/definitions"

// Seed ขั้น P1 — Identity & Org
//
// สร้าง: tenant · permission ทั้ง 22 รหัส · role 5 บทบาทพร้อมชุดสิทธิ์ตาม spec §4.2 ·
//        ผังหน่วยงานจริงจาก prisma/org-units.csv · ผู้ใช้ตั้งต้น (รวมคนที่มี 2 สังกัด) · ค่าระบบปริยาย
//
// **ผังหน่วยงานมาจาก `prisma/org-units.csv` เท่านั้น** — ห้าม hardcode ผังในไฟล์นี้
// ที่มาของ CSV คือรหัสงานสารบรรณของมหาวิทยาลัย (spec D14 · §16)
// วางไว้ใต้ prisma/ ไม่ใช่ docs/ เพราะ .dockerignore ตัด docs/ ออกจาก build context
// ทำให้ service `migrate` ในคอนเทนเนอร์อ่านไม่เจอ
//
// seed เขียนแบบ idempotent (upsert ทั้งหมด) — รันซ้ำได้โดยไม่สร้างข้อมูลซ้ำ

const TENANT_CODE = "KRIRK"

// รหัสผ่านตั้งต้นของบัญชีที่ seed สร้าง — ตั้งผ่าน env ได้ในสภาพแวดล้อมจริง
// ทุกบัญชีถูกตั้ง mustChangePassword = true จึงต้องเปลี่ยนทันทีที่ล็อกอินครั้งแรก
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "Esaraban@2569"

const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const

/** BOM ที่ Excel ใส่ให้ไฟล์ UTF-8 · ต้องตัดทิ้งก่อนอ่านหัวตาราง */
const BOM = String.fromCharCode(0xfeff)
const CR = String.fromCharCode(13)
const LF = String.fromCharCode(10)

/** หนึ่งแถวใน prisma/org-units.csv */
interface OrgSeed {
  code: string
  level: number
  parentCode: string | null
  nameTh: string
  canIssueNumber: boolean
  isActive: boolean
}

/** หน่วยงานแม่ของทั้งผัง — ไม่มีในเอกสารต้นทาง เพราะเอกสารเริ่มนับที่หน่วยงานภายใน */
const ROOT_UNIT = {
  code: "000000",
  nameTh: "มหาวิทยาลัยเกริก",
  shortName: "มก.",
  type: "UNIVERSITY",
  // มหาวิทยาลัยไม่ได้อยู่ในรายชื่อหน่วยที่ออกเลขได้ (spec §16) จึงปิดไว้
  canIssueNumber: false,
} as const

type OrgUnitTypeName =
  "UNIVERSITY" | "FACULTY" | "OFFICE" | "DIVISION" | "DEPARTMENT" | "CENTER" | "SECTION"

/**
 * เดาชนิดหน่วยงานจากคำขึ้นต้นของชื่อ — เอกสารต้นทางไม่มีคอลัมน์ชนิด
 * ใช้แค่แสดงผล/จัดกลุ่มใน UI ไม่ได้ใช้ตัดสินสิทธิ์หรือการออกเลข (นั่นคือ canIssueNumber)
 */
function guessType(nameTh: string, level: number): OrgUnitTypeName {
  if (nameTh.startsWith("คณะ") || nameTh.startsWith("วิทยาลัย")) return "FACULTY"
  if (nameTh.startsWith("ศูนย์")) return "CENTER"
  if (nameTh.startsWith("สำนัก") || nameTh.startsWith("สถาบัน")) return "OFFICE"
  if (nameTh.startsWith("ฝ่าย")) return "DIVISION"
  if (nameTh.startsWith("สาขา") || nameTh.startsWith("ภาควิชา")) return "DEPARTMENT"
  if (nameTh.startsWith("งาน")) return "SECTION"
  return level === 1 ? "OFFICE" : level === 2 ? "DIVISION" : "SECTION"
}

/**
 * อ่านผังหน่วยงานจาก CSV ข้าง ๆ ไฟล์นี้
 *
 * parser เขียนเองแบบสั้นที่สุดที่พอใช้ได้ — ตรวจแล้วว่าไม่มีชื่อหน่วยงานไหนมีคอมมาหรือ
 * เครื่องหมายคำพูด ถ้าวันหลังมี ต้องเปลี่ยนไปใช้ parser จริงแทน จึง assert ไว้ให้พังทันที
 */
function loadOrgUnits(): OrgSeed[] {
  const csv = readFileSync(new URL("./org-units.csv", import.meta.url), "utf8")
  const lines = csv
    .replace(BOM, "")
    .trim()
    .split(LF)
    .map((line) => line.replace(CR, ""))

  const [header = "", ...rows] = lines

  const columns = header.split(",")
  const expected = "code,level,parentCode,nameTh,canIssueNumber,isActive,note"
  if (header.trim() !== expected) {
    throw new Error(`org-units.csv มีคอลัมน์ไม่ตรงที่คาด
  คาด: ${expected}
  ได้: ${header}`)
  }

  return rows.map((line, index) => {
    const cells = line.split(",")
    if (cells.length !== columns.length) {
      throw new Error(
        `org-units.csv บรรทัดที่ ${index + 2} มี ${cells.length} คอลัมน์ (ต้องเป็น ${columns.length}) — ` +
          "อาจมีคอมมาอยู่ในชื่อหน่วยงาน ซึ่ง parser ตัวนี้รองรับไม่ได้",
      )
    }

    // ใส่ค่าปริยายให้ทุกช่องเพราะ noUncheckedIndexedAccess ถือว่า index ของ array อาจเป็น undefined
    const [
      code = "",
      level = "0",
      parentCode = "",
      nameTh = "",
      canIssueNumber = "",
      isActive = "",
    ] = cells

    return {
      code: code.trim(),
      level: Number(level),
      parentCode: parentCode.trim() || null,
      nameTh: nameTh.trim(),
      canIssueNumber: canIssueNumber.trim() === "true",
      isActive: isActive.trim() === "true",
    }
  })
}

interface UserSeed {
  username: string
  prefix: string
  firstName: string
  lastName: string
  email: string
  clearanceLevel: number
  /** สังกัด — ตัวแรกคือสังกัดหลัก · unitCode คือรหัส 6 หลักใน org-units.csv */
  affiliations: { unitCode: string; positionTitle: string; roleCode: string }[]
  /** บทบาทระดับทั้งองค์กร (orgUnitId = null) */
  globalRoleCode?: string
}

const USERS: UserSeed[] = [
  {
    username: "admin",
    prefix: "นาย",
    firstName: "ผู้ดูแล",
    lastName: "ระบบ",
    email: "admin@krirk.ac.th",
    clearanceLevel: 0,
    affiliations: [
      { unitCode: "720000", positionTitle: "นักวิชาการคอมพิวเตอร์", roleCode: "USER" },
    ],
    globalRoleCode: "SYSTEM_ADMIN",
  },
  {
    username: "registrar",
    prefix: "นางสาว",
    firstName: "สมหญิง",
    lastName: "ทะเบียนดี",
    email: "registrar@krirk.ac.th",
    clearanceLevel: 2,
    affiliations: [
      {
        // งานสารบรรณ (010103) เป็นหน่วยระดับ 3 จึงออกเลขในนามตัวเองไม่ได้ (D15)
        // แต่บทบาท CENTRAL_REGISTRAR มี scope ORG จึงออกเลขให้หน่วยงานอื่นได้ทั้งมหาวิทยาลัย
        unitCode: "010103",
        positionTitle: "เจ้าหน้าที่สารบรรณกลาง",
        roleCode: "CENTRAL_REGISTRAR",
      },
    ],
  },
  {
    // คนที่มี 2 สังกัด — ใช้ทดสอบ Context Switcher ตาม DoD ของ P1
    username: "rattana.wong",
    prefix: "นาง",
    firstName: "รัตนา",
    lastName: "วงศ์ประเสริฐ",
    email: "rattana.wong@krirk.ac.th",
    clearanceLevel: 1,
    affiliations: [
      { unitCode: "510000", positionTitle: "เจ้าหน้าที่บริหารงานทั่วไป", roleCode: "DEPT_OFFICER" },
      { unitCode: "720000", positionTitle: "กรรมการศูนย์เทคโนโลยีสารสนเทศ", roleCode: "USER" },
    ],
  },
  {
    username: "dean.eng",
    prefix: "รศ.ดร.",
    firstName: "ประสิทธิ์",
    lastName: "วิศวการ",
    email: "dean.eng@krirk.ac.th",
    clearanceLevel: 3,
    affiliations: [{ unitCode: "630000", positionTitle: "คณบดี", roleCode: "EXECUTIVE" }],
  },
  {
    username: "somchai.j",
    prefix: "ผศ.",
    firstName: "สมชาย",
    lastName: "ใจดี",
    email: "somchai.j@krirk.ac.th",
    clearanceLevel: 0,
    affiliations: [{ unitCode: "630200", positionTitle: "อาจารย์", roleCode: "USER" }],
  },
]

/** หน่วยงานที่ผู้ใช้แต่ละคนเป็นหัวหน้า */
const UNIT_HEADS: Record<string, string> = {
  "630000": "dean.eng",
  "010103": "registrar",
}

// ---------------------------------------------------------------------------
// ตรวจสภาพแวดล้อมฝั่งฐานข้อมูลก่อน (ยกมาจาก seed ขั้น P0)
// ---------------------------------------------------------------------------

// ต้องเป็น ICU locale th-TH เท่านั้น — ตั้งได้ครั้งเดียวตอน initdb
// ถ้า assert ตรงนี้พัง แปลว่า volume ถูกสร้างก่อนที่จะตั้งค่า ICU ใน docker-compose.yml
async function assertThaiCollation() {
  const rows = await prisma.$queryRaw<Array<{ provider: string; locale: string | null }>>`
    SELECT datlocprovider::text AS provider, daticulocale AS locale
    FROM pg_database
    WHERE datname = current_database()
  `

  const row = rows[0]

  if (!row || row.provider !== "i" || row.locale !== "th-TH") {
    throw new Error(
      [
        `ฐานข้อมูลไม่ได้ใช้ ICU collation th-TH (ได้ provider=${row?.provider ?? "?"} locale=${row?.locale ?? "-"})`,
        "การเรียงลำดับภาษาไทยจะผิด — สระหน้า (เ แ โ ใ ไ) จะไปกองท้ายตาราง",
        "แก้โดยสร้าง cluster ใหม่: docker compose down && docker volume rm esaraban_postgres-data && docker compose up -d",
      ].join("\n"),
    )
  }
}

// spec §9.2 — ภาษาไทยตัดคำด้วย tsvector ไม่ได้ pg_trgm จึงเป็นกลไกค้นหาหลัก
async function assertSearchExtensions() {
  const extensions = await prisma.$queryRaw<Array<{ extname: string }>>`
    SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm', 'unaccent')
  `

  const installed = extensions.map((row) => row.extname)
  const missing = ["pg_trgm", "unaccent"].filter((name) => !installed.includes(name))

  if (missing.length > 0) {
    throw new Error(`ไม่พบ PostgreSQL extension: ${missing.join(", ")} — รัน pnpm db:migrate ก่อน`)
  }

  return installed
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seedTenant() {
  return prisma.tenant.upsert({
    where: { code: TENANT_CODE },
    update: { nameTh: "มหาวิทยาลัยเกริก" },
    create: { code: TENANT_CODE, nameTh: "มหาวิทยาลัยเกริก", nameEn: "Krirk University" },
  })
}

async function seedPermissions() {
  for (const [index, meta] of PERMISSION_META.entries()) {
    await prisma.permission.upsert({
      where: { code: meta.code },
      update: {
        group: meta.group,
        nameTh: meta.nameTh,
        description: meta.description,
        sortOrder: index,
      },
      create: {
        code: meta.code,
        group: meta.group,
        nameTh: meta.nameTh,
        description: meta.description,
        sortOrder: index,
      },
    })
  }

  return PERMISSION_META.length
}

async function seedRoles() {
  const roleIdByCode = new Map<string, string>()

  for (const [index, seed] of DEFAULT_ROLES.entries()) {
    const role = await prisma.role.upsert({
      where: { code: seed.code },
      update: { nameTh: seed.nameTh, description: seed.description, sortOrder: index },
      create: {
        code: seed.code,
        nameTh: seed.nameTh,
        description: seed.description,
        isSystem: true,
        sortOrder: index,
      },
    })

    roleIdByCode.set(seed.code, role.id)

    // ตั้งชุดสิทธิ์ให้ตรงกับตารางใน spec §4.2 เป๊ะ ๆ
    // ลบของเดิมทิ้งก่อนเพื่อให้สิทธิ์ที่ถูกถอดออกจากตารางหายไปด้วยจริง ๆ
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } })
    await prisma.rolePermission.createMany({
      data: Object.entries(seed.permissions).map(([permissionCode, scope]) => ({
        roleId: role.id,
        permissionCode,
        scope,
      })),
    })
  }

  return roleIdByCode
}

async function seedOrgTree(tenantId: string) {
  const unitIdByCode = new Map<string, string>()

  /** สร้างหรืออัปเดตหนึ่งหน่วยงาน แล้วคืน id — path ต้องมี id ของตัวเองอยู่ด้วยจึงเขียนสองจังหวะ */
  async function upsertUnit(input: {
    code: string
    nameTh: string
    shortName: string | null
    type: OrgUnitTypeName
    parentId: string | null
    parentPath: string
    level: number
    sortOrder: number
    canIssueNumber: boolean
    isActive: boolean
  }) {
    const existing = await prisma.orgUnit.findUnique({
      where: { tenantId_code: { tenantId, code: input.code } },
    })

    const unit =
      existing ??
      (await prisma.orgUnit.create({
        data: {
          tenantId,
          parentId: input.parentId,
          path: "",
          code: input.code,
          nameTh: input.nameTh,
          shortName: input.shortName,
          type: input.type,
          level: input.level,
          sortOrder: input.sortOrder,
          canIssueNumber: input.canIssueNumber,
          isActive: input.isActive,
        },
      }))

    const path = `${input.parentPath}${unit.id}/`

    await prisma.orgUnit.update({
      where: { id: unit.id },
      data: {
        parentId: input.parentId,
        path,
        nameTh: input.nameTh,
        shortName: input.shortName,
        type: input.type,
        level: input.level,
        sortOrder: input.sortOrder,
        canIssueNumber: input.canIssueNumber,
        isActive: input.isActive,
      },
    })

    unitIdByCode.set(input.code, unit.id)
    return { id: unit.id, path }
  }

  const root = await upsertUnit({
    code: ROOT_UNIT.code,
    nameTh: ROOT_UNIT.nameTh,
    shortName: ROOT_UNIT.shortName,
    type: ROOT_UNIT.type,
    parentId: null,
    parentPath: "/",
    level: 0,
    sortOrder: 0,
    canIssueNumber: ROOT_UNIT.canIssueNumber,
    isActive: true,
  })

  const pathByCode = new Map<string, string>([[ROOT_UNIT.code, root.path]])

  // เรียงตามรหัสแล้วหน่วยแม่จะมาก่อนลูกเสมอ (010000 < 010100 < 010101)
  // จึงวนรอบเดียวจบ ไม่ต้อง recursive
  const units = loadOrgUnits().sort((a, b) => a.code.localeCompare(b.code))

  for (const [index, node] of units.entries()) {
    const parentCode = node.parentCode ?? ROOT_UNIT.code
    const parentId = unitIdByCode.get(parentCode)
    const parentPath = pathByCode.get(parentCode)

    if (!parentId || !parentPath) {
      throw new Error(`org-units.csv: หน่วยงาน ${node.code} อ้างหน่วยแม่ ${parentCode} ที่ยังไม่มี`)
    }

    const created = await upsertUnit({
      code: node.code,
      nameTh: node.nameTh,
      // เอกสารต้นทางไม่มีชื่อย่อ — ปล่อยว่างไว้ให้ผู้ดูแลกรอกเองที่ /admin/org-units
      shortName: null,
      type: guessType(node.nameTh, node.level),
      parentId,
      parentPath,
      level: node.level,
      sortOrder: index,
      canIssueNumber: node.canIssueNumber,
      isActive: node.isActive,
    })

    pathByCode.set(node.code, created.path)
  }

  return unitIdByCode
}

async function seedUsers(
  tenantId: string,
  unitIdByCode: Map<string, string>,
  roleIdByCode: Map<string, string>,
) {
  const passwordHash = await hash(SEED_PASSWORD, ARGON2_OPTIONS)
  const userIdByUsername = new Map<string, string>()

  for (const seed of USERS) {
    const user = await prisma.user.upsert({
      where: { username: seed.username },
      update: {
        prefix: seed.prefix,
        firstName: seed.firstName,
        lastName: seed.lastName,
        email: seed.email,
        clearanceLevel: seed.clearanceLevel,
      },
      create: {
        tenantId,
        username: seed.username,
        passwordHash,
        prefix: seed.prefix,
        firstName: seed.firstName,
        lastName: seed.lastName,
        email: seed.email,
        clearanceLevel: seed.clearanceLevel,
        mustChangePassword: true,
      },
    })

    userIdByUsername.set(seed.username, user.id)

    for (const [index, affiliation] of seed.affiliations.entries()) {
      const orgUnitId = unitIdByCode.get(affiliation.unitCode)
      if (!orgUnitId) throw new Error(`ไม่พบหน่วยงานรหัส ${affiliation.unitCode}`)

      await prisma.userOrgUnit.upsert({
        where: { userId_orgUnitId: { userId: user.id, orgUnitId } },
        update: { positionTitle: affiliation.positionTitle, isPrimary: index === 0 },
        create: {
          userId: user.id,
          orgUnitId,
          positionTitle: affiliation.positionTitle,
          isPrimary: index === 0,
        },
      })

      const roleId = roleIdByCode.get(affiliation.roleCode)
      if (!roleId) throw new Error(`ไม่พบบทบาท code=${affiliation.roleCode}`)

      await prisma.userRole.upsert({
        where: { userId_roleId_orgUnitId: { userId: user.id, roleId, orgUnitId } },
        update: {},
        create: { userId: user.id, roleId, orgUnitId },
      })
    }

    if (seed.globalRoleCode) {
      const roleId = roleIdByCode.get(seed.globalRoleCode)
      if (!roleId) throw new Error(`ไม่พบบทบาท code=${seed.globalRoleCode}`)

      const existing = await prisma.userRole.findFirst({
        where: { userId: user.id, roleId, orgUnitId: null },
      })

      if (!existing) {
        await prisma.userRole.create({ data: { userId: user.id, roleId, orgUnitId: null } })
      }
    }
  }

  for (const [unitCode, username] of Object.entries(UNIT_HEADS)) {
    const orgUnitId = unitIdByCode.get(unitCode)
    const headUserId = userIdByUsername.get(username)
    if (orgUnitId && headUserId) {
      await prisma.orgUnit.update({ where: { id: orgUnitId }, data: { headUserId } })
    }
  }

  return userIdByUsername.size
}

async function seedSettings(tenantId: string) {
  const entries: [string, unknown][] = [
    [SETTING_KEYS.NUMBERING, DEFAULT_SETTINGS.numbering],
    [SETTING_KEYS.FILE, DEFAULT_SETTINGS.file],
    [SETTING_KEYS.PASSWORD, DEFAULT_SETTINGS.password],
    [SETTING_KEYS.SESSION, DEFAULT_SETTINGS.session],
  ]

  for (const [key, value] of entries) {
    await prisma.systemSetting.upsert({
      where: { tenantId_key: { tenantId, key } },
      update: {},
      create: { tenantId, key, value: value as never },
    })
  }

  return entries.length
}

async function main() {
  await assertThaiCollation()
  const installed = await assertSearchExtensions()

  console.log("✔ เชื่อมต่อฐานข้อมูลสำเร็จ")
  console.log("✔ collation: ICU th-TH — เรียงลำดับภาษาไทยได้ถูกต้อง")
  console.log(`✔ extension ครบ: ${installed.join(", ")}`)

  const tenant = await seedTenant()
  console.log(`✔ tenant: ${tenant.nameTh} (${tenant.code})`)

  const permissionCount = await seedPermissions()
  console.log(`✔ สิทธิ์: ${permissionCount} รหัส`)

  const roleIdByCode = await seedRoles()
  console.log(`✔ บทบาท: ${roleIdByCode.size} บทบาท พร้อมชุดสิทธิ์ตาม spec §4.2`)

  const unitIdByCode = await seedOrgTree(tenant.id)
  const issuingCount = await prisma.orgUnit.count({
    where: { tenantId: tenant.id, canIssueNumber: true },
  })
  console.log(`✔ หน่วยงาน: ${unitIdByCode.size} หน่วย (ออกเลขได้ ${issuingCount} หน่วย)`)

  const userCount = await seedUsers(tenant.id, unitIdByCode, roleIdByCode)
  console.log(
    `✔ ผู้ใช้: ${userCount} บัญชี · รหัสผ่านตั้งต้น "${SEED_PASSWORD}" (ต้องเปลี่ยนตอนเข้าครั้งแรก)`,
  )

  const settingCount = await seedSettings(tenant.id)
  console.log(`✔ ค่าระบบปริยาย: ${settingCount} กลุ่ม`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
