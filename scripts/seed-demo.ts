import { PERMISSIONS, type GrantedPermissions } from "../src/lib/authz"
import { prisma } from "../src/lib/db"
import type { ServiceContext } from "../src/server/context"
import {
  circulateDocument,
  closeDocument,
  createDocument,
  forwardDocument,
  markSentDocument,
  registerIncoming,
  submitDocument,
} from "../src/server/services/document.service"
import { issueNumber } from "../src/server/services/numbering.service"

// ข้อมูลตัวอย่างสำหรับดูหน้าจอจริง — หนังสือ 3 ทิศทาง × 3 ระยะของวงจร
//
// รันด้วย:  pnpm db:seed:demo          ลบของที่สคริปต์นี้สร้าง: pnpm db:seed:demo --clean
//
// ทำไมต้องยิงผ่าน service จริงแทนการ INSERT ตรง ๆ:
// หน้าภาพรวม กล่องเอกสาร ทะเบียน และการแจ้งเตือน อ่านจากตารางคนละชุด (`DocumentAction` ·
// `DocumentRecipient` · `NumberSequence` · `Notification`) การยัดแถวเข้าตาราง `documents`
// อย่างเดียวจะได้ข้อมูลที่ "มีอยู่" แต่หน้าจอยังว่างเปล่า และสถานะที่ได้อาจเป็นสถานะที่
// state machine จริงไม่มีวันสร้างขึ้นมาได้ ทำให้ทดสอบไปแล้วไม่ตรงกับของจริง
//
// ⚠️ **ห้ามรันบนเครื่องจริงเด็ดขาด** — ทุกฉบับที่ออกเลขจะกินเลขทะเบียนของหน่วยงานนั้นจริง
// และตาม §6.4 เลขที่ออกไปแล้วเอากลับมาใช้ซ้ำไม่ได้ · ทะเบียนจะมีรูที่อธิบายกับผู้ตรวจไม่ได้
// (`--clean` ลบตัวเอกสารได้ แต่ **คืนเลขไม่ได้** — ข้อจำกัดเดียวกับ teardown ของ e2e)

const PREFIX = "[ตัวอย่าง]"

const ACTOR_USERNAME = "rattana.wong"
const OWNER_UNIT_CODE = "510000"
const RECIPIENT_UNIT_CODE = "720000"

const DEMO_PERMISSIONS = {
  [PERMISSIONS.DOCUMENT_CREATE]: "ORG",
  [PERMISSIONS.DOCUMENT_READ]: "ORG",
  [PERMISSIONS.DOCUMENT_UPDATE]: "ORG",
  [PERMISSIONS.DOCUMENT_SUBMIT]: "ORG",
  [PERMISSIONS.DOCUMENT_NUMBER_ISSUE]: "ORG",
  [PERMISSIONS.DOCUMENT_CIRCULATE]: "ORG",
  [PERMISSIONS.DOCUMENT_SEND_EXTERNAL]: "ORG",
  [PERMISSIONS.DOCUMENT_CLOSE]: "ORG",
  [PERMISSIONS.CONFIDENTIAL_ACCESS]: "ORG",
} as GrantedPermissions

/** ชั้นความลับในฐานเป็น Int ธรรมดา แต่ ServiceContext รับแค่ 0–3 (spec §8.1) */
function clampClearance(level: number): 0 | 1 | 2 | 3 {
  const clamped = Math.min(3, Math.max(0, Math.trunc(level)))
  return clamped as 0 | 1 | 2 | 3
}

async function buildContext(): Promise<{
  ctx: ServiceContext
  ownerUnitId: string
  recipientUnitId: string
  types: Record<"INTERNAL" | "OUTGOING" | "INCOMING", string>
}> {
  const actor = await prisma.user.findFirst({
    where: { username: ACTOR_USERNAME, deletedAt: null },
  })

  if (!actor) throw new Error(`ไม่พบผู้ใช้ ${ACTOR_USERNAME} — รัน pnpm db:seed ก่อน`)

  const [ownerUnit, recipientUnit] = await Promise.all([
    prisma.orgUnit.findFirst({ where: { tenantId: actor.tenantId, code: OWNER_UNIT_CODE } }),
    prisma.orgUnit.findFirst({ where: { tenantId: actor.tenantId, code: RECIPIENT_UNIT_CODE } }),
  ])

  if (!ownerUnit || !recipientUnit) throw new Error("ไม่พบหน่วยงานที่ใช้สร้างตัวอย่าง")
  if (!ownerUnit.canIssueNumber) {
    throw new Error(`หน่วยงาน ${OWNER_UNIT_CODE} ออกเลขไม่ได้ (D15) — เลือกหน่วยอื่น`)
  }

  const documentTypes = await prisma.documentType.findMany({ where: { tenantId: actor.tenantId } })

  const findType = (direction: string) => {
    const found = documentTypes.find((type) => type.direction === direction)
    if (!found) throw new Error(`ไม่พบประเภทหนังสือทิศทาง ${direction}`)
    return found.id
  }

  return {
    // ⚠️ ชั้นความลับอ่านจากแถวจริงของผู้ใช้ ไม่ตั้งเป็น 3 ตายตัว — ข้อมูลตัวอย่างที่สร้าง
    // ด้วยสิทธิ์ที่คนคนนั้นไม่มีจริง จะทำให้ทดสอบหน้าจอแล้วเห็นสิ่งที่ผู้ใช้จริงไม่มีวันเห็น
    ctx: {
      userId: actor.id,
      tenantId: actor.tenantId,
      isActive: true,
      activeOrgUnitId: ownerUnit.id,
      activeOrgUnitPath: ownerUnit.path,
      orgUnitIds: [ownerUnit.id],
      roleCodes: ["CENTRAL_REGISTRAR"],
      permissions: DEMO_PERMISSIONS,
      clearanceLevel: clampClearance(actor.clearanceLevel),
      sessionId: "seed-demo",
      ip: "127.0.0.1",
      userAgent: "seed-demo",
    },
    ownerUnitId: ownerUnit.id,
    recipientUnitId: recipientUnit.id,
    types: {
      INTERNAL: findType("INTERNAL"),
      OUTGOING: findType("OUTGOING"),
      INCOMING: findType("INCOMING"),
    },
  }
}

async function clean() {
  const documents = await prisma.document.findMany({
    where: { subject: { startsWith: PREFIX }, deletedAt: null },
    select: { id: true, docNo: true },
  })

  if (documents.length === 0) {
    console.log("ไม่มีข้อมูลตัวอย่างค้างอยู่")
    return
  }

  // soft delete ตาม §9.3 — FK ทุกเส้นเป็น Restrict ลบจริงไม่ได้อยู่แล้ว
  await prisma.document.updateMany({
    where: { id: { in: documents.map((document) => document.id) } },
    data: { deletedAt: new Date() },
  })

  const issued = documents.filter((document) => document.docNo).length

  console.log(`ลบข้อมูลตัวอย่าง ${documents.length} ฉบับแล้ว`)
  if (issued > 0) {
    console.log(`⚠️ ในนั้นมี ${issued} ฉบับที่ออกเลขไปแล้ว — เลขเหล่านั้นคืนไม่ได้ตาม §6.4`)
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("สคริปต์นี้ห้ามรันบนเครื่องจริง — มันกินเลขทะเบียนจริง")
  }

  if (process.argv.includes("--clean")) {
    await clean()
    return
  }

  const { ctx, recipientUnitId, types } = await buildContext()
  const created: { direction: string; stage: string; subject: string; docNo: string | null }[] = []

  const record = async (direction: string, stage: string, id: string) => {
    const document = await prisma.document.findUniqueOrThrow({ where: { id } })
    created.push({ direction, stage, subject: document.subject, docNo: document.docNo })
  }

  // ── หนังสือภายใน (บันทึกข้อความ) ────────────────────────────────────────
  const memoDraft = await createDocument(ctx, {
    documentTypeId: types.INTERNAL,
    subject: `${PREFIX} ขอเชิญประชุมคณะกรรมการประจำคณะ ครั้งที่ 9/2569`,
    summary: "วาระพิจารณาแผนรับนักศึกษาปีการศึกษา 2570",
    confidentialityLevel: 0,
    urgencyLevel: 0,
    recipients: [],
  })
  await record("หนังสือภายใน", "ร่าง", memoDraft.id)

  const memoPending = await createDocument(ctx, {
    documentTypeId: types.INTERNAL,
    subject: `${PREFIX} ขออนุมัติเดินทางไปราชการต่างจังหวัด`,
    confidentialityLevel: 0,
    urgencyLevel: 1,
    recipients: [{ orgUnitId: recipientUnitId, kind: "TO" }],
  })
  await submitDocument(ctx, memoPending.id)
  await record("หนังสือภายใน", "รอออกเลข", memoPending.id)

  const memoCirculated = await createDocument(ctx, {
    documentTypeId: types.INTERNAL,
    subject: `${PREFIX} แจ้งกำหนดการตรวจประเมินคุณภาพการศึกษาภายใน`,
    confidentialityLevel: 0,
    urgencyLevel: 2,
    recipients: [{ orgUnitId: recipientUnitId, kind: "TO" }],
  })
  await submitDocument(ctx, memoCirculated.id)
  await issueNumber(ctx, memoCirculated.id)
  await circulateDocument(ctx, memoCirculated.id, [{ orgUnitId: recipientUnitId, kind: "TO" }])
  await record("หนังสือภายใน", "ออกเลข + เวียนแล้ว", memoCirculated.id)

  // ── หนังสือส่งภายนอก ──────────────────────────────────────────────────
  const outgoingDraft = await createDocument(ctx, {
    documentTypeId: types.OUTGOING,
    subject: `${PREFIX} ขอความอนุเคราะห์วิทยากรบรรยายพิเศษ`,
    externalRecipientName: "มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี",
    confidentialityLevel: 0,
    urgencyLevel: 0,
    recipients: [],
  })
  await record("หนังสือส่งภายนอก", "ร่าง", outgoingDraft.id)

  const outgoingPending = await createDocument(ctx, {
    documentTypeId: types.OUTGOING,
    subject: `${PREFIX} ขอส่งรายงานผลการดำเนินงานประจำปีงบประมาณ 2569`,
    externalRecipientName: "สำนักงานปลัดกระทรวงการอุดมศึกษาฯ",
    confidentialityLevel: 0,
    urgencyLevel: 1,
    recipients: [],
  })
  await submitDocument(ctx, outgoingPending.id)
  await record("หนังสือส่งภายนอก", "รอออกเลข", outgoingPending.id)

  const outgoingSent = await createDocument(ctx, {
    documentTypeId: types.OUTGOING,
    subject: `${PREFIX} ขอเรียนเชิญร่วมเป็นเจ้าภาพจัดการแข่งขันทักษะวิชาการ`,
    externalRecipientName: "สมาคมสถาบันอุดมศึกษาเอกชนแห่งประเทศไทย",
    confidentialityLevel: 0,
    urgencyLevel: 0,
    recipients: [],
  })
  await submitDocument(ctx, outgoingSent.id)
  await issueNumber(ctx, outgoingSent.id)
  await markSentDocument(ctx, outgoingSent.id)
  await record("หนังสือส่งภายนอก", "ออกเลข + ส่งออกแล้ว", outgoingSent.id)

  // ── หนังสือรับ (ออกเลขรับทันทีในขั้นตอนเดียว · A1) ────────────────────
  const incomingNew = await registerIncoming(ctx, {
    documentTypeId: types.INCOMING,
    subject: `${PREFIX} ขอเชิญเข้าร่วมสัมมนาเครือข่ายงานสารบรรณอิเล็กทรอนิกส์`,
    externalSenderName: "กรมส่งเสริมการเรียนรู้",
    confidentialityLevel: 0,
    urgencyLevel: 0,
  })
  await record("หนังสือรับ", "ลงทะเบียนรับแล้ว", incomingNew.documentId)

  const incomingForwarded = await registerIncoming(ctx, {
    documentTypeId: types.INCOMING,
    subject: `${PREFIX} แจ้งการปรับอัตราค่าธรรมเนียมการศึกษา`,
    externalSenderName: "สำนักงานคณะกรรมการการอุดมศึกษา",
    confidentialityLevel: 0,
    urgencyLevel: 1,
  })
  await forwardDocument(ctx, incomingForwarded.documentId, [
    { orgUnitId: recipientUnitId, kind: "TO" },
  ])
  await record("หนังสือรับ", "ส่งต่อหน่วยงานแล้ว", incomingForwarded.documentId)

  const incomingClosed = await registerIncoming(ctx, {
    documentTypeId: types.INCOMING,
    subject: `${PREFIX} ตอบรับการเข้าร่วมโครงการความร่วมมือทางวิชาการ`,
    externalSenderName: "มหาวิทยาลัยราชภัฏสวนสุนันทา",
    confidentialityLevel: 0,
    urgencyLevel: 0,
  })
  await closeDocument(ctx, incomingClosed.documentId, "ดำเนินการเรียบร้อยแล้ว")
  await record("หนังสือรับ", "ปิดเรื่อง", incomingClosed.documentId)

  console.log(`สร้างข้อมูลตัวอย่าง ${created.length} ฉบับ (3 ทิศทาง × 3 ระยะ)\n`)

  for (const row of created) {
    console.log(`  ${row.direction.padEnd(18)} ${row.stage.padEnd(22)} ${row.docNo ?? "-"}`)
  }

  console.log(`\nลบทั้งหมดด้วย: pnpm db:seed:demo --clean`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
