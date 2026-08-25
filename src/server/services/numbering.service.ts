import "server-only"

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, writeAudit } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/authz"
import { prisma } from "@/lib/db"
import { getSystemSettings } from "@/lib/settings"
import {
  DEFAULT_NUMBER_PATTERN,
  renderDocNumber,
  resolveNumberYear,
  validateNumberPattern,
} from "@/lib/thai/doc-number"

import type { ServiceContext } from "../context"
import { assertPermission, ServiceError } from "./errors"

// การออกเลขทะเบียน — spec §7.3 (จุดที่สเปกทำเครื่องหมาย Critical)
//
// สิ่งที่ต้องกัน: เจ้าหน้าที่สารบรรณสองคนกดออกเลขพร้อมกันแล้วได้เลขเดียวกัน
// เลขซ้ำหนึ่งครั้งทำลายความน่าเชื่อถือของทะเบียนทั้งระบบ และแก้ย้อนหลังไม่ได้ตาม §6.4

/** สถานะเดียวที่ออกเลขได้ — ด่าน STATE ของ §4.3 */
const ISSUABLE_STATUSES = ["PENDING_NUMBER"] as const

export interface IssueNumberResult {
  documentId: string
  docNo: string
  seqValue: number
  year: number
  bookCode: string
}

/**
 * ออกเลขทะเบียนให้เอกสารหนึ่งฉบับ
 *
 * ทั้งหมดอยู่ในทรานแซกชันเดียว — ถ้าขั้นไหนพัง เลขที่เดินไปแล้วจะถูก rollback ด้วย
 * จึงไม่เกิด "เลขหาย" ซึ่งในทะเบียนราชการถือเป็นสัญญาณของการทุจริต
 */
export async function issueNumber(
  ctx: ServiceContext,
  documentId: string,
  options: { note?: string | null } = {},
): Promise<IssueNumberResult> {
  const document = await prisma.document.findFirst({
    where: { id: documentId, tenantId: ctx.tenantId, deletedAt: null },
    include: {
      ownerUnit: {
        select: { id: true, code: true, shortName: true, path: true, canIssueNumber: true },
      },
      documentType: { select: { nameTh: true, numberPattern: true } },
    },
  })

  if (!document) throw new ServiceError("ไม่พบเอกสารที่ระบุ", "NOT_FOUND")

  assertPermission(
    ctx,
    PERMISSIONS.DOCUMENT_NUMBER_ISSUE,
    {
      ownerUnitId: document.ownerUnitId,
      ownerUnitPath: document.ownerUnit.path,
      createdById: document.createdById,
      confidentialityLevel: document.confidentialityLevel,
      status: document.status,
    },
    { allowedStatuses: ISSUABLE_STATUSES },
  )

  // หน่วยระดับ "งาน" ออกเลขในนามตัวเองไม่ได้ (D15) — ต้องสลับ context ไปหน่วยงานแม่ก่อน
  if (!document.ownerUnit.canIssueNumber) {
    throw new ServiceError(
      `หน่วยงาน "${document.ownerUnit.code}" ไม่ได้รับอนุญาตให้ออกเลขหนังสือ`,
      "VALIDATION",
    )
  }

  const settings = await getSystemSettings(ctx.tenantId)
  const docDate = document.docDate ?? new Date()
  const year = resolveNumberYear(settings.numbering.yearMode, docDate)

  return prisma.$transaction(async (tx) => {
    // ── เดินเลขแบบ atomic ────────────────────────────────────────────────
    //
    // สเปก §7.3 เขียนสูตรไว้เป็น SELECT ... FOR UPDATE → ถ้าไม่มีแถวก็ INSERT → UPDATE
    // ที่นี่ยุบเหลือคำสั่งเดียวด้วย INSERT ... ON CONFLICT DO UPDATE เพราะ:
    //   1. ได้ผลเหมือนกันแต่ไม่มีช่วง "หลังเช็คว่าไม่มีแถว ก่อน INSERT" ให้ race
    //   2. ไม่ต้อง retry แบบที่ Serializable + FOR UPDATE ต้องทำเมื่อชน 40001
    //   3. แถวถูกล็อกจนจบทรานแซกชันเหมือนกัน คนที่มาทีหลังจะรอแล้วได้เลขถัดไป
    //
    // id ปล่อยให้ Postgres สร้างเอง เพราะ @default(uuid(7)) ของ Prisma ทำงานฝั่ง client
    // ซึ่ง raw SQL ไม่ได้ผ่าน — ตาราง NumberSequence มีไม่กี่แถวต่อปี ลำดับเวลาของ id จึงไม่สำคัญ
    const rows = await tx.$queryRaw<{ lastValue: number; patternOverride: string | null }[]>`
      INSERT INTO "number_sequences"
        ("id", "tenantId", "orgUnitId", "direction", "bookCode", "year", "lastValue", "createdAt", "updatedAt")
      VALUES
        (gen_random_uuid()::text, ${ctx.tenantId}, ${document.ownerUnitId},
         ${document.direction}::"DocumentDirection", ${document.bookCode}, ${year}, 1, now(), now())
      ON CONFLICT ("tenantId", "orgUnitId", "direction", "bookCode", "year")
      DO UPDATE SET "lastValue" = "number_sequences"."lastValue" + 1, "updatedAt" = now()
      RETURNING "lastValue", "patternOverride"
    `

    const sequence = rows[0]
    if (!sequence) throw new ServiceError("เดินเลขทะเบียนไม่สำเร็จ", "CONFLICT")

    // ลำดับของ pattern: ทะเบียนนี้ → ประเภทหนังสือ → ค่าปริยายของระบบ (D16)
    const pattern =
      sequence.patternOverride ?? document.documentType.numberPattern ?? DEFAULT_NUMBER_PATTERN

    const issues = validateNumberPattern(pattern)
    if (issues.length > 0) {
      // โยนก่อนออกเลข — ทรานแซกชัน rollback ทำให้ตัวนับกลับไปเท่าเดิม ไม่มีเลขหาย
      throw new ServiceError(
        `รูปแบบเลขทะเบียนไม่ถูกต้อง: ${issues.map((issue) => issue.message).join(" · ")}`,
        "VALIDATION",
      )
    }

    const docNo = renderDocNumber(pattern, {
      unitCode: document.ownerUnit.code,
      unitShort: document.ownerUnit.shortName,
      seq: sequence.lastValue,
      year,
      docType: document.documentType.nameTh,
      bookCode: document.bookCode,
    })

    // @@unique ของ Document คือด่านสุดท้าย — ถ้า logic ข้างบนพลาด ฐานข้อมูลจะไม่ยอม
    const updated = await tx.document.update({
      where: { id: document.id },
      data: {
        docNo,
        seqValue: sequence.lastValue,
        year,
        docDate,
        status: "REGISTERED",
      },
    })

    await tx.documentAction.create({
      data: {
        documentId: document.id,
        actorUserId: ctx.userId,
        actorUnitId: ctx.activeOrgUnitId,
        actionType: "NUMBER_ISSUED",
        fromStatus: document.status,
        toStatus: "REGISTERED",
        note: options.note || null,
      },
    })

    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      action: AUDIT_ACTIONS.DOCUMENT_NUMBER_ISSUED,
      entityType: AUDIT_ENTITY_TYPES.DOCUMENT,
      entityId: document.id,
      actorUserId: ctx.userId,
      actorOrgUnitId: ctx.activeOrgUnitId,
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      severity: "NOTICE",
      metadata: {
        docNo,
        seqValue: sequence.lastValue,
        year,
        bookCode: document.bookCode,
        pattern,
      },
    })

    return {
      documentId: updated.id,
      docNo,
      seqValue: sequence.lastValue,
      year,
      bookCode: document.bookCode,
    }
  })
}
