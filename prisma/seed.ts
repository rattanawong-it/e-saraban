import { prisma } from "../src/lib/db"

// Seed ขั้น P0 — ยังไม่มีโมเดลข้อมูล จึงตรวจแค่ว่าเชื่อมต่อได้
// และสภาพแวดล้อมฝั่งฐานข้อมูลที่ระบบภาษาไทยต้องพึ่ง ถูกตั้งมาถูกต้องจริง
//
// P1 จะเพิ่ม: permissions, roles, org tree ตัวอย่าง, admin คนแรก (spec §11.2)

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

async function main() {
  await assertThaiCollation()
  const installed = await assertSearchExtensions()

  console.log("✔ เชื่อมต่อฐานข้อมูลสำเร็จ")
  console.log("✔ collation: ICU th-TH — เรียงลำดับภาษาไทยได้ถูกต้อง")
  console.log(`✔ extension ครบ: ${installed.join(", ")}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
