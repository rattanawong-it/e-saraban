import "server-only"

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, writeAudit } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/authz"
import { prisma } from "@/lib/db"
import { allowedFromStatuses, canIssueNumber, nextStatus } from "@/lib/documents/state-machine"
import { getSystemSettings } from "@/lib/settings"
import {
  DEFAULT_NUMBER_PATTERN,
  renderDocNumber,
  resolveNumberYear,
  validateNumberPattern,
} from "@/lib/thai/doc-number"
import type { DocumentDirectionValue, DocumentStatusValue } from "@/schemas/document.schema"
import type { UpdateSequencePatternInput, UpdateTypePatternInput } from "@/schemas/numbering.schema"

import type { ServiceContext } from "../context"
import { assertPermission, ServiceError } from "./errors"

// การออกเลขทะเบียน — spec §7.3 (จุดที่สเปกทำเครื่องหมาย Critical)
//
// สิ่งที่ต้องกัน: เจ้าหน้าที่สารบรรณสองคนกดออกเลขพร้อมกันแล้วได้เลขเดียวกัน
// เลขซ้ำหนึ่งครั้งทำลายความน่าเชื่อถือของทะเบียนทั้งระบบ และแก้ย้อนหลังไม่ได้ตาม §6.4

export interface IssueNumberResult {
  documentId: string
  docNo: string
  seqValue: number
  year: number
  bookCode: string
  status: DocumentStatusValue
}

/** เอกสารเท่าที่การออกเลขต้องใช้ — รับได้ทั้งที่โหลดมาและที่เพิ่งสร้างในทรานแซกชันเดียวกัน */
export interface IssuableDocument {
  id: string
  status: DocumentStatusValue
  direction: DocumentDirectionValue
  /** เลขที่ออกไปแล้ว — ต้องเป็น null เท่านั้นจึงจะออกเลขได้ (§6.4) */
  docNo: string | null
  bookCode: string
  docDate: Date | null
  ownerUnitId: string
  createdById: string
  confidentialityLevel: number
  ownerUnit: { code: string; shortName: string | null; path: string; canIssueNumber: boolean }
  documentType: { nameTh: string; numberPattern: string | null }
}

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/** โหลดเอกสารพร้อมของที่การออกเลขต้องใช้ */
export async function loadIssuableDocument(
  ctx: ServiceContext,
  documentId: string,
): Promise<IssuableDocument> {
  const document = await prisma.document.findFirst({
    where: { id: documentId, tenantId: ctx.tenantId, deletedAt: null },
    include: {
      ownerUnit: { select: { code: true, shortName: true, path: true, canIssueNumber: true } },
      documentType: { select: { nameTh: true, numberPattern: true } },
    },
  })

  if (!document) throw new ServiceError("ไม่พบเอกสารที่ระบุ", "NOT_FOUND")

  return document
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
  const document = await loadIssuableDocument(ctx, documentId)

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
    // สถานะที่ออกเลขได้มาจากตาราง state machine ที่เดียว (§6.1–6.3)
    // หนังสือรับออกเลขตอน RECEIVED ส่วนหนังสือภายใน/ส่งออกที่ PENDING_NUMBER
    { allowedStatuses: allowedFromStatuses(document.direction, "NUMBER_ISSUED") },
  )

  // ตัวนับถูกล็อกจนจบทรานแซกชัน คนที่กดพร้อมกันจึงต้อง "เข้าคิวรอ" เป็นเรื่องปกติ
  // ค่าปริยายของ Prisma (maxWait 2 วิ) สั้นเกินไปสำหรับคิวออกเลขทีละหลายสิบฉบับ
  // — พอ connection pool เต็ม จะเด้ง "Unable to start a transaction" ทั้งที่ระบบยังทำงานถูก
  return prisma.$transaction((tx) => issueNumberWithin(tx, ctx, document, options), {
    maxWait: 15_000,
    timeout: 30_000,
  })
}

/**
 * แกนของการออกเลข — เรียกซ้ำได้จากทรานแซกชันอื่น เช่นการลงทะเบียนหนังสือรับ
 * ที่ต้องสร้างเอกสารและออกเลขรับให้จบในทรานแซกชันเดียว
 *
 * ⚠️ ตัวนี้ **ไม่ตรวจสิทธิ์** — ผู้เรียกต้องตรวจมาก่อนแล้ว
 */
export async function issueNumberWithin(
  tx: TransactionClient,
  ctx: ServiceContext,
  document: IssuableDocument,
  options: { note?: string | null } = {},
): Promise<IssueNumberResult> {
  // หน่วยระดับ "งาน" ออกเลขในนามตัวเองไม่ได้ (D15) — ต้องสลับ context ไปหน่วยงานแม่ก่อน
  if (!document.ownerUnit.canIssueNumber) {
    throw new ServiceError(
      `หน่วยงาน "${document.ownerUnit.code}" ไม่ได้รับอนุญาตให้ออกเลขหนังสือ`,
      "VALIDATION",
    )
  }

  // ⚠️ ด่านกันออกเลขซ้ำ — หนังสือรับอยู่ที่ RECEIVED ทั้งก่อนและหลังออกเลข
  // ถ้าเชื่อสถานะอย่างเดียว จะกดออกเลขทับได้เรื่อย ๆ แล้วเลขเดิมหายจากทะเบียน (§6.4)
  if (!canIssueNumber(document.direction, document.status, document.docNo)) {
    if (document.docNo) {
      throw new ServiceError(
        `เอกสารฉบับนี้มีเลขทะเบียน ${document.docNo} อยู่แล้ว ออกเลขซ้ำไม่ได้`,
        "VALIDATION",
      )
    }

    throw new ServiceError("สถานะของเอกสารไม่อนุญาตให้ออกเลข", "VALIDATION")
  }

  // หนังสือรับออกเลขแล้วยังอยู่ที่ RECEIVED · อีกสองทิศทางไปต่อที่ REGISTERED
  const toStatus = nextStatus(document.direction, "NUMBER_ISSUED", document.status)
  if (!toStatus) throw new ServiceError("สถานะของเอกสารไม่อนุญาตให้ออกเลข", "VALIDATION")

  // อ่านผ่าน tx เสมอ — ใช้ connection ใบเดียวกับทรานแซกชันนี้ ไม่ไปแย่ง pool กับคนอื่น
  const settings = await getSystemSettings(ctx.tenantId, tx)
  const docDate = document.docDate ?? new Date()
  const year = resolveNumberYear(settings.numbering.yearMode, docDate)

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
  await tx.document.update({
    where: { id: document.id },
    data: {
      docNo,
      seqValue: sequence.lastValue,
      year,
      docDate,
      status: toStatus,
    },
  })

  await tx.documentAction.create({
    data: {
      documentId: document.id,
      actorUserId: ctx.userId,
      actorUnitId: ctx.activeOrgUnitId,
      actionType: "NUMBER_ISSUED",
      fromStatus: document.status,
      toStatus,
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
    documentId: document.id,
    docNo,
    seqValue: sequence.lastValue,
    year,
    bookCode: document.bookCode,
    status: toStatus,
  }
}

// ---------------------------------------------------------------------------
// ตั้งค่ารูปแบบเลขทะเบียน (/admin/numbering · spec §7.1)
//
// ⚠️ การเปลี่ยน pattern มีผลกับเอกสารที่ออกเลข **หลังจากนี้** เท่านั้น
// ของเดิมเก็บ docNo ที่ render แล้วไว้ในแถวของตัวเอง และแก้ย้อนหลังไม่ได้ (§6.4)
// ---------------------------------------------------------------------------

export interface NumberingTypeRow {
  id: string
  code: string
  nameTh: string
  direction: DocumentDirectionValue
  defaultBookCode: string
  numberPattern: string | null
  isActive: boolean
}

export interface NumberingSequenceRow {
  id: string
  orgUnitCode: string
  orgUnitName: string
  direction: DocumentDirectionValue
  bookCode: string
  year: number
  lastValue: number
  patternOverride: string | null
}

export async function readNumberingConfig(ctx: ServiceContext) {
  assertPermission(ctx, PERMISSIONS.SETTING_MANAGE)

  const settings = await getSystemSettings(ctx.tenantId)
  const year = resolveNumberYear(settings.numbering.yearMode)

  const [documentTypes, sequences] = await Promise.all([
    prisma.documentType.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        nameTh: true,
        direction: true,
        defaultBookCode: true,
        numberPattern: true,
        isActive: true,
      },
    }),
    // เฉพาะปีที่ใช้อยู่ — ทะเบียนของปีเก่าปิดไปแล้ว แก้ pattern ย้อนหลังไม่มีประโยชน์
    prisma.numberSequence.findMany({
      where: { tenantId: ctx.tenantId, year },
      orderBy: [{ orgUnit: { code: "asc" } }, { direction: "asc" }, { bookCode: "asc" }],
      include: { orgUnit: { select: { code: true, nameTh: true, shortName: true } } },
    }),
  ])

  return {
    yearMode: settings.numbering.yearMode,
    year,
    defaultPattern: DEFAULT_NUMBER_PATTERN,
    documentTypes: documentTypes as NumberingTypeRow[],
    sequences: sequences.map((sequence): NumberingSequenceRow => ({
      id: sequence.id,
      orgUnitCode: sequence.orgUnit.code,
      orgUnitName: sequence.orgUnit.shortName ?? sequence.orgUnit.nameTh,
      direction: sequence.direction,
      bookCode: sequence.bookCode,
      year: sequence.year,
      lastValue: sequence.lastValue,
      patternOverride: sequence.patternOverride,
    })),
  }
}

export type NumberingConfig = Awaited<ReturnType<typeof readNumberingConfig>>

export async function updateDocumentTypePattern(
  ctx: ServiceContext,
  input: UpdateTypePatternInput,
) {
  assertPermission(ctx, PERMISSIONS.SETTING_MANAGE)

  const documentType = await prisma.documentType.findFirst({
    where: { id: input.documentTypeId, tenantId: ctx.tenantId },
  })

  if (!documentType) throw new ServiceError("ไม่พบประเภทหนังสือที่ระบุ", "NOT_FOUND")

  assertPatternValid(input.numberPattern)

  return prisma.$transaction(async (tx) => {
    const updated = await tx.documentType.update({
      where: { id: documentType.id },
      data: { numberPattern: input.numberPattern },
    })

    await writeAuditForPattern(tx, ctx, {
      entityId: documentType.id,
      scope: "documentType",
      target: documentType.code,
      before: documentType.numberPattern,
      after: updated.numberPattern,
    })

    return updated
  })
}

export async function updateSequencePattern(
  ctx: ServiceContext,
  input: UpdateSequencePatternInput,
) {
  assertPermission(ctx, PERMISSIONS.SETTING_MANAGE)

  const sequence = await prisma.numberSequence.findFirst({
    where: { id: input.sequenceId, tenantId: ctx.tenantId },
    include: { orgUnit: { select: { code: true } } },
  })

  if (!sequence) throw new ServiceError("ไม่พบทะเบียนที่ระบุ", "NOT_FOUND")

  assertPatternValid(input.patternOverride)

  return prisma.$transaction(async (tx) => {
    const updated = await tx.numberSequence.update({
      where: { id: sequence.id },
      data: { patternOverride: input.patternOverride },
    })

    await writeAuditForPattern(tx, ctx, {
      entityId: sequence.id,
      scope: "numberSequence",
      target: `${sequence.orgUnit.code}/${sequence.direction}/${sequence.bookCode}/${sequence.year}`,
      before: sequence.patternOverride,
      after: updated.patternOverride,
    })

    return updated
  })
}

/** ว่าง = ตกทอดค่าจากชั้นบน จึงไม่ต้องตรวจ · มีค่าเมื่อไรต้อง render ได้จริงเสมอ */
function assertPatternValid(pattern: string | null) {
  if (!pattern) return

  const issues = validateNumberPattern(pattern)

  if (issues.length > 0) {
    throw new ServiceError(
      `รูปแบบเลขทะเบียนไม่ถูกต้อง: ${issues.map((issue) => issue.message).join(" · ")}`,
      "VALIDATION",
    )
  }
}

function writeAuditForPattern(
  tx: TransactionClient,
  ctx: ServiceContext,
  detail: {
    entityId: string
    scope: "documentType" | "numberSequence"
    target: string
    before: string | null
    after: string | null
  },
) {
  return writeAudit(tx, {
    tenantId: ctx.tenantId,
    action: AUDIT_ACTIONS.SETTING_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.SETTING,
    entityId: detail.entityId,
    actorUserId: ctx.userId,
    actorOrgUnitId: ctx.activeOrgUnitId,
    sessionId: ctx.sessionId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    // เปลี่ยนรูปแบบเลข = เปลี่ยนหน้าตาของทะเบียนราชการนับจากนี้ไป จึงไม่ใช่เรื่องปกติ
    severity: "CRITICAL",
    metadata: {
      setting: "numberPattern",
      scope: detail.scope,
      target: detail.target,
      before: detail.before,
      after: detail.after,
    },
  })
}
