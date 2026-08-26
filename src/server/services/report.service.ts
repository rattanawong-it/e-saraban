import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, writeAudit } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/authz"
import { prisma } from "@/lib/db"
import { STATUS_LABELS, type DocumentStatusValue } from "@/schemas/document.schema"

import type { ServiceContext } from "../context"
import { documentVisibilityWhere, subtreeUnitIds } from "./document-visibility"
import { assertPermission } from "./errors"

// ทะเบียนหนังสือ (spec §10.1 · D12) — รูปแบบตามระเบียบสำนักนายกรัฐมนตรีว่าด้วยงานสารบรรณ
//
// ทะเบียนหนังสือรับกับทะเบียนหนังสือส่งเป็น **คนละเล่ม** ตามระเบียบ ใช้คอลัมน์ชุดเดียวกัน
//   เลขทะเบียน · ที่ · ลงวันที่ · จาก · ถึง · เรื่อง · การปฏิบัติ · หมายเหตุ
//
// ⚠️ ทะเบียนต้องแสดงเลขที่ยกเลิกด้วย (§6.4) — เลขที่หายไปจากทะเบียนคือสัญญาณของการทุจริต
// จึงไม่กรอง CANCELLED ทิ้ง แต่ทำเครื่องหมายไว้ในช่องหมายเหตุแทน
//
// ⚠️ ขอบเขตที่เห็นได้มาจาก `documentVisibilityWhere` ตัวเดียวกับหน้ารายการและหน้าค้นหา
// รวมถึงด่านชั้นความลับ — ทะเบียนที่ export ออกไปเป็นไฟล์เดินออกนอกระบบแล้วเรียกกลับไม่ได้
// ตรงนี้จึงเป็นจุดที่พลาดแล้วเสียหายที่สุดในบรรดาหน้าที่ list เอกสารทั้งหมด

export type RegisterBook = "incoming" | "outgoing"

export interface RegisterFilter {
  /** เล่มทะเบียน — รับ หรือ ส่ง (ส่ง = หนังสือภายใน + หนังสือส่งภายนอก) */
  book: RegisterBook
  /** หน่วยงานเจ้าของทะเบียน — รวมหน่วยงานลูกเสมอ */
  orgUnitId?: string | undefined
  /** ปี พ.ศ. ของเลขทะเบียน — ไม่ระบุ = ปีปัจจุบันตามที่ระบบเดินเลขอยู่ */
  year?: number | undefined
  from?: Date | undefined
  to?: Date | undefined
  documentTypeId?: string | undefined
}

export interface RegisterRow {
  id: string
  /** เลขทะเบียนในเล่ม — ตัวเลขลำดับที่เดินต่อกันในปีนั้น */
  seq: number | null
  docNo: string
  docDate: Date | null
  /** ช่อง "จาก" — หนังสือรับคือผู้ส่งภายนอก · หนังสือส่งคือหน่วยงานเจ้าของเรื่อง */
  from: string
  /** ช่อง "ถึง" */
  to: string
  subject: string
  /** ช่อง "การปฏิบัติ" — สถานะการดำเนินการของเรื่องนั้น */
  action: string
  note: string
  confidentialityLevel: number
  urgencyLevel: number
}

export interface RegisterReport {
  rows: RegisterRow[]
  /** ชื่อหน่วยงานเจ้าของทะเบียน — ขึ้นหัวกระดาษตามแบบของระเบียบ */
  orgUnitName: string
  book: RegisterBook
  year: number
  from: Date | undefined
  to: Date | undefined
}

const MAX_ROWS = 5_000

export async function getRegisterReport(
  ctx: ServiceContext,
  filter: RegisterFilter,
): Promise<RegisterReport> {
  assertPermission(ctx, PERMISSIONS.REPORT_VIEW)

  const year = filter.year ?? currentBuddhistYear()

  const where: Prisma.DocumentWhereInput = {
    tenantId: ctx.tenantId,
    deletedAt: null,
    // ทะเบียนมีเฉพาะฉบับที่ออกเลขแล้ว — ร่างกับฉบับรอออกเลขยังไม่มีที่ในเล่ม
    docNo: { not: null },
    year,
    AND: [
      await documentVisibilityWhere(ctx),
      bookWhere(filter.book),
      await unitWhere(ctx, filter.orgUnitId),
      ...(filter.documentTypeId ? [{ documentTypeId: filter.documentTypeId }] : []),
      dateWhere(filter),
    ],
  }

  const [rows, orgUnitName] = await Promise.all([
    prisma.document.findMany({
      where,
      // เรียงตามเลขทะเบียนในเล่ม ไม่ใช่ตามวันที่ — เล่มทะเบียนต้องอ่านไล่เลขได้
      orderBy: [{ seqValue: "asc" }, { createdAt: "asc" }],
      take: MAX_ROWS,
      include: {
        ownerUnit: { select: { nameTh: true, shortName: true } },
        recipients: {
          select: {
            orgUnit: { select: { nameTh: true, shortName: true } },
            user: { select: { prefix: true, firstName: true, lastName: true } },
          },
        },
      },
    }),
    resolveOrgUnitName(ctx, filter.orgUnitId),
  ])

  return {
    rows: rows.map(toRegisterRow),
    orgUnitName,
    book: filter.book,
    year,
    from: filter.from,
    to: filter.to,
  }
}

/**
 * ทะเบียนพร้อมร่องรอยว่าใครดึงออกไปเมื่อไร — ใช้ตอน export เป็นไฟล์
 *
 * ⚠️ แยกจาก `getRegisterReport()` โดยตั้งใจ · การ**ดูบนจอ**กับการ**ดึงออกเป็นไฟล์**
 * ไม่เท่ากัน ไฟล์เดินออกนอกระบบแล้วเรียกคืนไม่ได้ ผู้ตรวจสอบจึงต้องตามได้ว่าใครดึงอะไรไป
 */
export async function exportRegisterReport(
  ctx: ServiceContext,
  filter: RegisterFilter,
  format: "xlsx" | "pdf",
): Promise<RegisterReport> {
  assertPermission(ctx, PERMISSIONS.REPORT_EXPORT)

  const report = await getRegisterReport(ctx, filter)

  await writeAudit(prisma, {
    tenantId: ctx.tenantId,
    action: AUDIT_ACTIONS.REPORT_EXPORTED,
    entityType: AUDIT_ENTITY_TYPES.DOCUMENT,
    entityId: null,
    actorUserId: ctx.userId,
    actorOrgUnitId: ctx.activeOrgUnitId,
    sessionId: ctx.sessionId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    severity: "NOTICE",
    metadata: {
      report: "register",
      format,
      book: filter.book,
      year: report.year,
      orgUnitId: filter.orgUnitId ?? null,
      rowCount: report.rows.length,
      // จำนวนฉบับชั้นความลับที่ติดไปในไฟล์ — ตัวเลขที่ผู้ตรวจสอบมองหาเป็นอันดับแรก
      confidentialCount: report.rows.filter((row) => row.confidentialityLevel > 0).length,
    },
  })

  return report
}

// ---------------------------------------------------------------------------
// ภายใน
// ---------------------------------------------------------------------------

/**
 * หนังสือส่งกับหนังสือรับเดินคนละเล่ม (ระเบียบสารบรรณ ข้อ 38–39)
 *
 * "ส่ง" รวมบันทึกข้อความภายในด้วย เพราะทั้งคู่เดินเลขจากทะเบียนของหน่วยงานตัวเอง
 */
function bookWhere(book: RegisterBook): Prisma.DocumentWhereInput {
  return book === "incoming"
    ? { direction: "INCOMING" }
    : { direction: { in: ["INTERNAL", "OUTGOING"] } }
}

async function unitWhere(
  ctx: ServiceContext,
  orgUnitId?: string,
): Promise<Prisma.DocumentWhereInput> {
  if (!orgUnitId) return {}

  return { ownerUnitId: { in: await subtreeUnitIds(ctx.tenantId, orgUnitId) } }
}

function dateWhere(filter: RegisterFilter): Prisma.DocumentWhereInput {
  if (!filter.from && !filter.to) return {}

  // หนังสือรับใช้วันที่ลงทะเบียนรับ ส่วนหนังสือส่งใช้วันที่ของหนังสือ — ตามที่เล่มจริงบันทึก
  const field = filter.book === "incoming" ? "receivedDate" : "docDate"

  return {
    [field]: {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    },
  }
}

type RegisterSource = Prisma.DocumentGetPayload<{
  include: {
    ownerUnit: { select: { nameTh: true; shortName: true } }
    recipients: {
      select: {
        orgUnit: { select: { nameTh: true; shortName: true } }
        user: { select: { prefix: true; firstName: true; lastName: true } }
      }
    }
  }
}>

function toRegisterRow(row: RegisterSource): RegisterRow {
  const unitName = row.ownerUnit.shortName ?? row.ownerUnit.nameTh

  const recipientNames = row.recipients
    .map((recipient) =>
      recipient.user
        ? `${recipient.user.prefix ?? ""}${recipient.user.firstName} ${recipient.user.lastName}`.trim()
        : (recipient.orgUnit?.shortName ?? recipient.orgUnit?.nameTh ?? ""),
    )
    .filter(Boolean)

  return {
    id: row.id,
    seq: row.seqValue,
    docNo: row.docNo ?? "",
    docDate: row.direction === "INCOMING" ? (row.receivedDate ?? row.docDate) : row.docDate,
    from: row.direction === "INCOMING" ? (row.externalSenderName ?? "-") : unitName,
    to:
      row.direction === "OUTGOING"
        ? (row.externalRecipientName ?? joinOrDash(recipientNames))
        : joinOrDash(recipientNames),
    subject: row.subject,
    action: STATUS_LABELS[row.status as DocumentStatusValue] ?? row.status,
    // ⚠️ เลขที่ถูกยกเลิกต้องยังอยู่ในเล่มพร้อมเหตุผล ไม่ใช่หายไปเฉย ๆ (§6.4)
    note: row.status === "CANCELLED" ? "ยกเลิก — เลขนี้ไม่นำกลับมาใช้ซ้ำ" : "",
    confidentialityLevel: row.confidentialityLevel,
    urgencyLevel: row.urgencyLevel,
  }
}

function joinOrDash(names: string[]): string {
  return names.length > 0 ? names.join(" · ") : "-"
}

async function resolveOrgUnitName(ctx: ServiceContext, orgUnitId?: string): Promise<string> {
  const id = orgUnitId ?? ctx.activeOrgUnitId
  if (!id) return "ทุกหน่วยงาน"

  const unit = await prisma.orgUnit.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: { nameTh: true },
  })

  return unit?.nameTh ?? "ทุกหน่วยงาน"
}

/** ปีของเลขทะเบียนที่ระบบเดินอยู่ตอนนี้ — พ.ศ. เสมอ (§7.3) */
function currentBuddhistYear(): number {
  return new Date().getFullYear() + 543
}
