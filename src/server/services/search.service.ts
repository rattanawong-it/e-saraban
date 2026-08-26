import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { PERMISSIONS } from "@/lib/authz"
import { prisma } from "@/lib/db"
import type { DocumentDirectionValue, DocumentStatusValue } from "@/schemas/document.schema"

import type { ServiceContext } from "../context"
import { documentVisibilityWhere, subtreeUnitIds } from "./document-visibility"
import type { DocumentListResult, DocumentListRow } from "./document-list.service"
import { assertPermission } from "./errors"

// ค้นหาขั้นสูง (spec §10.1 · หน้า /search)
//
// ต่างจากกล่องเอกสารตรงที่ไม่มี "นิยามของกล่อง" มาบังคับ — ผู้ใช้ประกอบเงื่อนไขเอง
// แต่ **ด่านขอบเขตสิทธิ์เป็นตัวเดียวกัน** (`documentVisibilityWhere`) เสมอ
//
// ⚠️ ค้นภาษาไทยด้วย `contains` ซึ่ง Postgres แปลงเป็น ILIKE '%…%' และวิ่งเข้า GIN + pg_trgm
// ที่สร้างไว้ตั้งแต่ P2 · **ห้ามเปลี่ยนไปใช้ full-text search** เพราะ §9.2 บอกไว้ชัดว่า
// ภาษาไทยไม่มีเว้นวรรค tsvector จึงตัดคำไม่ได้ ค้นคำกลางประโยคจะไม่เจอเลย
//
// ⚠️ ไม่มีเงื่อนไขเลย = ไม่คืนอะไร ไม่ใช่คืนทั้งฐาน — หน้าค้นหาที่เปิดมาแล้วเทข้อมูลทั้งองค์กร
// ใส่หน้าจอคือการทำให้ข้อมูลรั่วโดยไม่มีใครตั้งใจค้น

export type SearchDateField = "docDate" | "receivedDate" | "createdAt"
export type SearchSort = "latest" | "oldest" | "docNo"

export interface SearchFilter {
  q?: string | undefined
  direction?: DocumentDirectionValue | undefined
  status?: DocumentStatusValue | undefined
  documentTypeId?: string | undefined
  /** หน่วยงานเจ้าของเรื่อง — รวมหน่วยงานลูกด้วยเสมอ เพราะคนค้นคิดเป็น "สายงาน" ไม่ใช่หน่วยเดี่ยว */
  ownerUnitId?: string | undefined
  confidentialityLevel?: number | undefined
  urgencyLevel?: number | undefined
  hasAttachment?: boolean | undefined
  dateField?: SearchDateField | undefined
  from?: Date | undefined
  to?: Date | undefined
  sort?: SearchSort | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

export interface SearchResult extends DocumentListResult {
  /** ผู้ใช้ยังไม่ได้ระบุเงื่อนไขอะไรเลย — หน้าเว็บเอาไว้แยกจาก "ค้นแล้วไม่เจอ" */
  empty: boolean
}

const DEFAULT_PAGE_SIZE = 25

export async function searchDocuments(
  ctx: ServiceContext,
  filter: SearchFilter,
): Promise<SearchResult> {
  assertPermission(ctx, PERMISSIONS.DOCUMENT_READ)

  const page = Math.max(filter.page ?? 1, 1)
  const pageSize = Math.min(filter.pageSize ?? DEFAULT_PAGE_SIZE, 100)

  if (!hasAnyCriteria(filter)) {
    return { rows: [], total: 0, page, pageSize, empty: true }
  }

  // ⚠️ ต่อทุกเงื่อนไขด้วย AND ห้าม spread รวมเป็นออบเจ็กต์เดียว — คีย์ `OR` ของด่านสิทธิ์
  // กับ `OR` ของคำค้นซ้ำกัน spread แล้วตัวหลังจะทับตัวหน้าจนด่านสิทธิ์หายทั้งด่าน (§20 ข้อ 1)
  const where: Prisma.DocumentWhereInput = {
    tenantId: ctx.tenantId,
    deletedAt: null,
    AND: [
      await documentVisibilityWhere(ctx),
      keywordWhere(filter.q),
      await ownerUnitWhere(ctx, filter.ownerUnitId),
      ...(filter.direction ? [{ direction: filter.direction }] : []),
      ...(filter.status ? [{ status: filter.status }] : []),
      ...(filter.documentTypeId ? [{ documentTypeId: filter.documentTypeId }] : []),
      ...(filter.confidentialityLevel !== undefined
        ? [{ confidentialityLevel: filter.confidentialityLevel }]
        : []),
      ...(filter.urgencyLevel !== undefined ? [{ urgencyLevel: filter.urgencyLevel }] : []),
      ...(filter.hasAttachment ? [{ attachments: { some: { deletedAt: null } } }] : []),
      dateWhere(filter),
    ],
  }

  const [rows, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: orderFor(filter.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        documentType: { select: { nameTh: true } },
        ownerUnit: { select: { nameTh: true, shortName: true } },
        createdBy: { select: { prefix: true, firstName: true, lastName: true } },
        _count: { select: { attachments: true, recipients: true } },
      },
    }),
    prisma.document.count({ where }),
  ])

  return {
    rows: rows.map(toRow),
    total,
    page,
    pageSize,
    empty: false,
  }
}

/** ตัวเลือกที่หน้าค้นหาต้องใช้เติมช่องกรอง — โหลดพร้อมหน้าเดียวจบ */
export async function getSearchOptions(ctx: ServiceContext) {
  assertPermission(ctx, PERMISSIONS.DOCUMENT_READ)

  const [documentTypes, orgUnits] = await Promise.all([
    prisma.documentType.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      orderBy: [{ direction: "asc" }, { nameTh: "asc" }],
      select: { id: true, nameTh: true, direction: true },
    }),
    prisma.orgUnit.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
      select: { id: true, nameTh: true, shortName: true, code: true, level: true },
    }),
  ])

  return { documentTypes, orgUnits }
}

// ---------------------------------------------------------------------------
// ภายใน
// ---------------------------------------------------------------------------

function hasAnyCriteria(filter: SearchFilter): boolean {
  return Boolean(
    filter.q?.trim() ||
    filter.direction ||
    filter.status ||
    filter.documentTypeId ||
    filter.ownerUnitId ||
    filter.confidentialityLevel !== undefined ||
    filter.urgencyLevel !== undefined ||
    filter.hasAttachment ||
    filter.from ||
    filter.to,
  )
}

/**
 * ค้นคำในทุกช่องที่ผู้ใช้จำได้จริง
 *
 * รวม `summary` กับ `refDocNo` ด้วย (กว้างกว่าช่องค้นของกล่องเอกสาร) เพราะคนที่มาหน้านี้
 * มักจำได้แค่ "เนื้อความประมาณนี้" หรือ "อ้างถึงหนังสือเลขนี้" ไม่ได้จำชื่อเรื่องเป๊ะ
 */
function keywordWhere(q?: string): Prisma.DocumentWhereInput {
  const needle = q?.trim()
  if (!needle) return {}

  return {
    OR: [
      { subject: { contains: needle, mode: "insensitive" } },
      { docNo: { contains: needle, mode: "insensitive" } },
      { summary: { contains: needle, mode: "insensitive" } },
      { refDocNo: { contains: needle, mode: "insensitive" } },
      { externalSenderName: { contains: needle, mode: "insensitive" } },
      { externalRecipientName: { contains: needle, mode: "insensitive" } },
    ],
  }
}

async function ownerUnitWhere(
  ctx: ServiceContext,
  ownerUnitId?: string,
): Promise<Prisma.DocumentWhereInput> {
  if (!ownerUnitId) return {}

  return { ownerUnitId: { in: await subtreeUnitIds(ctx.tenantId, ownerUnitId) } }
}

function dateWhere(filter: SearchFilter): Prisma.DocumentWhereInput {
  if (!filter.from && !filter.to) return {}

  const field = filter.dateField ?? "docDate"

  return {
    [field]: {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    },
  }
}

function orderFor(sort?: SearchSort): Prisma.DocumentOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ docDate: "asc" }, { createdAt: "asc" }]

    // เรียงตามเลขที่หนังสือ — ร่างที่ยังไม่มีเลขไปอยู่ท้ายสุด
    case "docNo":
      return [{ docNo: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }]

    default:
      return [{ docDate: "desc" }, { createdAt: "desc" }]
  }
}

type SearchRow = Prisma.DocumentGetPayload<{
  include: {
    documentType: { select: { nameTh: true } }
    ownerUnit: { select: { nameTh: true; shortName: true } }
    createdBy: { select: { prefix: true; firstName: true; lastName: true } }
    _count: { select: { attachments: true; recipients: true } }
  }
}>

function toRow(row: SearchRow): DocumentListRow {
  return {
    id: row.id,
    docNo: row.docNo,
    subject: row.subject,
    status: row.status as DocumentStatusValue,
    direction: row.direction as DocumentDirectionValue,
    confidentialityLevel: row.confidentialityLevel,
    urgencyLevel: row.urgencyLevel,
    docDate: row.docDate,
    receivedDate: row.receivedDate,
    updatedAt: row.updatedAt,
    externalSenderName: row.externalSenderName,
    externalRecipientName: row.externalRecipientName,
    documentTypeName: row.documentType.nameTh,
    ownerUnitName: row.ownerUnit.shortName ?? row.ownerUnit.nameTh,
    createdByName:
      `${row.createdBy.prefix ?? ""}${row.createdBy.firstName} ${row.createdBy.lastName}`.trim(),
    lastReturnNote: null,
    attachmentCount: row._count.attachments,
    recipientCount: row._count.recipients,
  }
}
