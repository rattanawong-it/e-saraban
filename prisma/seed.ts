import { hash } from "@node-rs/argon2"

import { DEFAULT_ROLES, PERMISSION_META } from "../src/lib/authz/matrix"
import { prisma } from "../src/lib/db"
import { DEFAULT_SETTINGS, SETTING_KEYS } from "../src/lib/settings/definitions"

// Seed ขั้น P1 — Identity & Org
//
// สร้าง: tenant · permission ทั้ง 22 รหัส · role 5 บทบาทพร้อมชุดสิทธิ์ตาม spec §4.2 ·
//        ผังหน่วยงานตัวอย่าง 3 ระดับ · ผู้ใช้ตั้งต้น (รวมคนที่มี 2 สังกัด) · ค่าระบบปริยาย
//
// ⚠️ **ผังหน่วยงานและรหัสหนังสือในไฟล์นี้เป็นข้อมูลตัวอย่าง**
//    spec §15 ข้อ 3 (ผังองค์กรจริง + รหัสหนังสือ) ยังไม่ได้คำตอบ
//    เมื่อได้ผังจริงให้แก้ ORG_TREE ข้างล่างแล้วรัน seed ใหม่บนฐานข้อมูลเปล่า
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

interface OrgSeed {
  key: string
  code: string
  nameTh: string
  shortName: string
  type: "UNIVERSITY" | "FACULTY" | "OFFICE" | "DIVISION" | "DEPARTMENT" | "CENTER" | "SECTION"
  children?: OrgSeed[]
}

const ORG_TREE: OrgSeed = {
  key: "root",
  code: "ศธ 0512",
  nameTh: "มหาวิทยาลัยเกริก",
  shortName: "มก.",
  type: "UNIVERSITY",
  children: [
    {
      key: "president-office",
      code: "ศธ 0512.1",
      nameTh: "สำนักงานอธิการบดี",
      shortName: "สนอ.",
      type: "OFFICE",
      children: [
        {
          key: "central-registry",
          code: "ศธ 0512.1.1",
          nameTh: "งานสารบรรณกลาง",
          shortName: "สบก.",
          type: "SECTION",
        },
        { key: "hr", code: "ศธ 0512.1.2", nameTh: "งานบุคคล", shortName: "บค.", type: "SECTION" },
        {
          key: "finance",
          code: "ศธ 0512.1.3",
          nameTh: "งานคลังและพัสดุ",
          shortName: "คพ.",
          type: "SECTION",
        },
      ],
    },
    {
      key: "eng",
      code: "ศธ 0512.2",
      nameTh: "คณะวิศวกรรมศาสตร์",
      shortName: "วศ.",
      type: "FACULTY",
      children: [
        {
          key: "cpe",
          code: "ศธ 0512.2.1",
          nameTh: "ภาควิชาวิศวกรรมคอมพิวเตอร์",
          shortName: "คว.",
          type: "DEPARTMENT",
        },
        {
          key: "ce",
          code: "ศธ 0512.2.2",
          nameTh: "ภาควิชาวิศวกรรมโยธา",
          shortName: "ยธ.",
          type: "DEPARTMENT",
        },
      ],
    },
    {
      key: "sci",
      code: "ศธ 0512.3",
      nameTh: "คณะวิทยาศาสตร์",
      shortName: "วท.",
      type: "FACULTY",
      children: [
        {
          key: "cs",
          code: "ศธ 0512.3.1",
          nameTh: "ภาควิชาวิทยาการคอมพิวเตอร์",
          shortName: "วก.",
          type: "DEPARTMENT",
        },
      ],
    },
    {
      key: "it-center",
      code: "ศธ 0512.4",
      nameTh: "ศูนย์คอมพิวเตอร์",
      shortName: "ศค.",
      type: "CENTER",
    },
  ],
}

interface UserSeed {
  username: string
  prefix: string
  firstName: string
  lastName: string
  email: string
  clearanceLevel: number
  /** สังกัด — ตัวแรกคือสังกัดหลัก */
  affiliations: { unitKey: string; positionTitle: string; roleCode: string }[]
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
      { unitKey: "it-center", positionTitle: "นักวิชาการคอมพิวเตอร์", roleCode: "USER" },
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
        unitKey: "central-registry",
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
      { unitKey: "eng", positionTitle: "เจ้าหน้าที่บริหารงานทั่วไป", roleCode: "DEPT_OFFICER" },
      { unitKey: "it-center", positionTitle: "กรรมการศูนย์คอมพิวเตอร์", roleCode: "USER" },
    ],
  },
  {
    username: "dean.eng",
    prefix: "รศ.ดร.",
    firstName: "ประสิทธิ์",
    lastName: "วิศวการ",
    email: "dean.eng@krirk.ac.th",
    clearanceLevel: 3,
    affiliations: [{ unitKey: "eng", positionTitle: "คณบดี", roleCode: "EXECUTIVE" }],
  },
  {
    username: "somchai.j",
    prefix: "ผศ.",
    firstName: "สมชาย",
    lastName: "ใจดี",
    email: "somchai.j@krirk.ac.th",
    clearanceLevel: 0,
    affiliations: [{ unitKey: "cpe", positionTitle: "อาจารย์", roleCode: "USER" }],
  },
]

/** หน่วยงานที่ผู้ใช้แต่ละคนเป็นหัวหน้า */
const UNIT_HEADS: Record<string, string> = {
  eng: "dean.eng",
  "central-registry": "registrar",
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
  const unitIdByKey = new Map<string, string>()

  async function walk(
    node: OrgSeed,
    parentId: string | null,
    parentPath: string,
    level: number,
    sortOrder: number,
  ) {
    const existing = await prisma.orgUnit.findUnique({
      where: { tenantId_code: { tenantId, code: node.code } },
    })

    const unit =
      existing ??
      (await prisma.orgUnit.create({
        data: {
          tenantId,
          parentId,
          path: "", // เติมทันทีหลังรู้ id — path ต้องมี id ของตัวเองอยู่ด้วย
          code: node.code,
          nameTh: node.nameTh,
          shortName: node.shortName,
          type: node.type,
          level,
          sortOrder,
        },
      }))

    const path = `${parentPath}${unit.id}/`

    await prisma.orgUnit.update({
      where: { id: unit.id },
      data: {
        parentId,
        path,
        nameTh: node.nameTh,
        shortName: node.shortName,
        type: node.type,
        level,
        sortOrder,
      },
    })

    unitIdByKey.set(node.key, unit.id)

    for (const [index, child] of (node.children ?? []).entries()) {
      await walk(child, unit.id, path, level + 1, index)
    }
  }

  await walk(ORG_TREE, null, "/", 0, 0)
  return unitIdByKey
}

async function seedUsers(
  tenantId: string,
  unitIdByKey: Map<string, string>,
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
      const orgUnitId = unitIdByKey.get(affiliation.unitKey)
      if (!orgUnitId) throw new Error(`ไม่พบหน่วยงาน key=${affiliation.unitKey}`)

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

  for (const [unitKey, username] of Object.entries(UNIT_HEADS)) {
    const orgUnitId = unitIdByKey.get(unitKey)
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

  const unitIdByKey = await seedOrgTree(tenant.id)
  console.log(`✔ หน่วยงาน: ${unitIdByKey.size} หน่วย (ลึก 3 ระดับ)`)

  const userCount = await seedUsers(tenant.id, unitIdByKey, roleIdByCode)
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
