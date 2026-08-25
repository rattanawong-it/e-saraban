import { encryptDocumentAttachments } from "../src/server/services/attachment.service"
import { prisma } from "../src/lib/db"

// Backfill ไฟล์แนบที่ค้างเป็น plaintext (spec §8.2 · D18)
//
// P2 เก็บไฟล์แนบทุกไฟล์แบบไม่เข้ารหัสตาม D18 · พอ P3 เปิดการเข้ารหัสแล้ว
// ไฟล์เก่าของเอกสารชั้นความลับ 1–3 ยังนอนเปลือยอยู่บนดิสก์ — สคริปต์นี้ไล่เก็บให้ครบ
//
// รันด้วย:  pnpm files:encrypt          ดูว่าจะแตะไฟล์ไหนบ้างโดยยังไม่แก้: pnpm files:encrypt --dry-run
//
// รันซ้ำได้ปลอดภัย — ไฟล์ที่เข้ารหัสแล้วจะไม่ถูกหยิบมาอีก

const dryRun = process.argv.includes("--dry-run")

async function main() {
  const pending = await prisma.attachment.groupBy({
    by: ["documentId"],
    where: { isEncrypted: false, document: { confidentialityLevel: { gt: 0 } } },
    _count: { _all: true },
  })

  if (pending.length === 0) {
    console.log("ไม่มีไฟล์แนบของเอกสารชั้นความลับที่ยังไม่เข้ารหัส — ไม่ต้องทำอะไร")
    return
  }

  const files = pending.reduce((sum, row) => sum + row._count._all, 0)
  console.log(`พบ ${files} ไฟล์ ใน ${pending.length} เอกสาร ที่ยังเป็น plaintext`)

  if (dryRun) {
    console.log("โหมด --dry-run · ยังไม่แตะไฟล์ใด ๆ")
    return
  }

  let encrypted = 0
  let missing = 0

  for (const row of pending) {
    // ไม่มี ctx เพราะไม่ใช่การกระทำของผู้ใช้คนไหน — audit จะบันทึก actor เป็น null
    const result = await encryptDocumentAttachments(row.documentId)

    encrypted += result.encrypted
    missing += result.missing

    console.log(
      `  เอกสาร ${row.documentId} · เข้ารหัส ${result.encrypted} ไฟล์` +
        (result.missing > 0 ? ` · หาไฟล์บนดิสก์ไม่เจอ ${result.missing} ไฟล์` : ""),
    )
  }

  console.log(`\nเสร็จแล้ว · เข้ารหัส ${encrypted} ไฟล์`)

  if (missing > 0) {
    console.log(
      `⚠️ มี ${missing} ไฟล์ที่มีแถวในฐานข้อมูลแต่ไม่มีตัวไฟล์บนดิสก์ — ตรวจ STORAGE_ROOT ว่าชี้ถูกที่`,
    )
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
