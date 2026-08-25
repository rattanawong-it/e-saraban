import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { PERMISSIONS } from "@/lib/authz"
import { prisma } from "@/lib/db"
import { toAuthzResource } from "@/lib/documents/authz-resource"
import type { DocumentDirectionValue, DocumentStatusValue } from "@/schemas/document.schema"

import type { ServiceContext } from "../context"
import { assertPermission, ServiceError } from "./errors"

// รายการเอกสารสำหรับหน้า Drafts / Inbox / Outbox / คิวออกเลข (spec §10.1)
//
// แยกจาก document.service.ts เพราะคนละหน้าที่: ที่นั่นเปลี่ยนสถานะเอกสาร ที่นี่อ่านอย่างเดียว
//
// ⚠️ ทุก query ต้องผ่าน buildScopeFilter() — ขอบเขตที่เห็นได้มาจาก scope ของสิทธิ์
// `document.read` ที่ผู้ใช้ถืออยู่ ไม่ใช่จากพารามิเตอร์ที่หน้าเว็บส่งมา

export type DocumentListScope = "drafts" | "inbox" | "outbox" | "queue" | "registry" | "sent"

export interface DocumentListFilter {
  scope: DocumentListScope
  /** คำค้น — ชื่อเรื่องหรือเลขที่หนังสือ */
  q?: string | undefined
  status?: DocumentStatusValue | undefined
  direction?: DocumentDirectionValue | undefined
  from?: Date | undefined
  to?: Date | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

export interface DocumentListRow {
  id: string
  docNo: string | null
  subject: string
  status: DocumentStatusValue
  direction: DocumentDirectionValue
  confidentialityLevel: number
  urgencyLevel: number
  docDate: Date | null
  receivedDate: Date | null
  updatedAt: Date
  externalSenderName: string | null
  externalRecipientName: string | null
  documentTypeName: string
  ownerUnitName: string
  createdByName: string
  /** หมายเหตุการตีกลับล่าสุด — หน้า Drafts ต้องบอกว่าให้กลับไปแก้อะไร */
  lastReturnNote: string | null
  attachmentCount: number
  recipientCount: number
}

export interface DocumentListResult {
  rows: DocumentListRow[]
  total: number
  page: number
  pageSize: number
}

const DEFAULT_PAGE_SIZE = 25

export async function listDocuments(
  ctx: ServiceContext,
  filter: DocumentListFilter,
): Promise<DocumentListResult> {
  assertPermission(ctx, PERMISSIONS.DOCUMENT_READ)

  const page = Math.max(filter.page ?? 1, 1)
  const pageSize = Math.min(filter.pageSize ?? DEFAULT_PAGE_SIZE, 100)

  // ⚠️ ต้องต่อกันด้วย AND ห้ามใช้ spread รวมเป็นออบเจ็กต์เดียว
  // เงื่อนไขหลายชุดที่นี่ใช้คีย์ซ้ำกันได้ (`OR` ของขอบเขตสิทธิ์กับ `OR` ของคำค้น ·
  // `direction` ของกล่องกับ `direction` ของตัวกรอง) — spread แล้วตัวหลังจะทับตัวหน้าเงียบ ๆ
  // ซึ่งกรณี OR แปลว่าด่านสิทธิ์หายไปทั้งด่าน
  const where: Prisma.DocumentWhereInput = {
    tenantId: ctx.tenantId,
    deletedAt: null,
    AND: [
      scopeWhere(ctx, filter.scope),
      await visibilityWhere(ctx, filter.scope),
      ...(filter.status ? [{ status: filter.status }] : []),
      ...(filter.direction ? [{ direction: filter.direction }] : []),
      searchWhere(filter.q),
      dateWhere(filter),
    ],
  }

  const [rows, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: orderFor(filter.scope),
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        documentType: { select: { nameTh: true } },
        ownerUnit: { select: { nameTh: true, shortName: true } },
        createdBy: { select: { prefix: true, firstName: true, lastName: true } },
        _count: { select: { attachments: true, recipients: true } },
        actions: {
          where: { actionType: "RETURNED" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { note: true },
        },
      },
    }),
    prisma.document.count({ where }),
  ])

  return {
    rows: rows.map((row) => ({
      id: row.id,
      docNo: row.docNo,
      subject: row.subject,
      status: row.status,
      direction: row.direction,
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
      lastReturnNote: row.actions[0]?.note ?? null,
      attachmentCount: row._count.attachments,
      recipientCount: row._count.recipients,
    })),
    total,
    page,
    pageSize,
  }
}

/** นับจำนวนที่ค้างอยู่ในแต่ละกล่อง — ใช้ทำ badge บนเมนูและการ์ดหน้า dashboard */
export async function countPendingNumber(ctx: ServiceContext): Promise<number> {
  assertPermission(ctx, PERMISSIONS.DOCUMENT_READ)

  return prisma.document.count({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      status: "PENDING_NUMBER",
      ...(await visibilityWhere(ctx, "queue")),
    },
  })
}

/**
 * รายละเอียดเอกสารหนึ่งฉบับพร้อมทุกอย่างที่หน้ารายละเอียดต้องใช้
 *
 * โหลดทีเดียวจบ แล้วตรวจสิทธิ์ครั้งเดียวที่นี่ — ถ้าให้หน้าเว็บไปเรียกทีละส่วน
 * จะมีโอกาสที่บางส่วนลืมตรวจสิทธิ์
 */
export async function getDocumentDetail(ctx: ServiceContext, id: string) {
  const document = await prisma.document.findFirst({
    where: { id, tenantId: ctx.tenantId, deletedAt: null },
    include: {
      documentType: { select: { nameTh: true, code: true } },
      ownerUnit: { select: { id: true, code: true, nameTh: true, shortName: true, path: true } },
      createdBy: { select: { prefix: true, firstName: true, lastName: true } },
      recipients: {
        orderBy: { createdAt: "asc" },
        include: {
          orgUnit: { select: { nameTh: true, shortName: true } },
          user: { select: { prefix: true, firstName: true, lastName: true } },
        },
      },
      attachments: {
        where: { deletedAt: null },
        orderBy: { version: "desc" },
        include: { uploadedBy: { select: { firstName: true, lastName: true } } },
      },
      actions: {
        orderBy: { createdAt: "desc" },
        include: {
          actorUser: { select: { prefix: true, firstName: true, lastName: true } },
          actorUnit: { select: { nameTh: true, shortName: true } },
        },
      },
      acls: {
        select: {
          principalType: true,
          principalId: true,
          permission: true,
          effect: true,
          expiresAt: true,
        },
      },
    },
  })

  if (!document) throw new ServiceError("ไม่พบเอกสารที่ระบุ", "NOT_FOUND")

  assertPermission(ctx, PERMISSIONS.DOCUMENT_READ, toAuthzResource(document))

  if (ctx.clearanceLevel < document.confidentialityLevel) {
    throw new ServiceError("ชั้นความลับของคุณไม่พอสำหรับเอกสารฉบับนี้", "FORBIDDEN")
  }

  return document
}

export type DocumentDetail = Awaited<ReturnType<typeof getDocumentDetail>>

// ---------------------------------------------------------------------------
// ภายใน
// ---------------------------------------------------------------------------

/** เงื่อนไขที่เป็น "นิยามของกล่อง" — ต่างจาก visibility ที่เป็นเรื่องสิทธิ์ */
function scopeWhere(ctx: ServiceContext, scope: DocumentListScope): Prisma.DocumentWhereInput {
  switch (scope) {
    // ร่างของฉัน = ที่ฉันสร้างเองและยังแก้ไขได้อยู่
    case "drafts":
      return { createdById: ctx.userId, status: { in: ["DRAFT", "RETURNED"] } }

    // กล่องรับ = เอกสารที่เวียนมาถึงฉันหรือหน่วยงานที่ฉันสังกัด
    case "inbox":
      return {
        recipients: {
          some: {
            OR: [{ userId: ctx.userId }, { orgUnitId: { in: [...ctx.orgUnitIds] } }],
          },
        },
      }

    // กล่องส่ง = เอกสารของหน่วยงานที่กำลังทำงานอยู่ ที่ออกเลขไปแล้ว
    case "outbox":
      return {
        ownerUnitId: ctx.activeOrgUnitId ?? undefined,
        status: { in: ["REGISTERED", "CIRCULATING", "SENT", "CLOSED"] },
      }

    // คิวออกเลข = รอสารบรรณออกเลข
    case "queue":
      return { status: "PENDING_NUMBER" }

    // ทะเบียน = ทุกฉบับที่ออกเลขแล้ว รวมที่ยกเลิก (เลขที่ยกเลิกต้องยังเห็นในทะเบียน §6.4)
    case "registry":
      return { docNo: { not: null } }

    // ทะเบียนส่ง = ทะเบียนที่ไม่รวมหนังสือรับ เพราะหนังสือรับเดินคนละเล่มและมีทะเบียนของตัวเอง
    case "sent":
      return { docNo: { not: null }, direction: { in: ["INTERNAL", "OUTGOING"] } }
  }
}

/**
 * ขอบเขตที่ผู้ใช้เห็นได้ตาม scope ของสิทธิ์ `document.read` (spec §4.3)
 *
 * กล่องรับกับร่างของฉันไม่ต้องกรองซ้ำ เพราะนิยามของกล่องแคบกว่าอยู่แล้ว
 */
async function visibilityWhere(
  ctx: ServiceContext,
  scope: DocumentListScope,
): Promise<Prisma.DocumentWhereInput> {
  if (scope === "drafts" || scope === "inbox") return {}

  const granted = ctx.permissions[PERMISSIONS.DOCUMENT_READ]

  if (granted === "ORG") return {}

  if (granted === "SUBTREE" && ctx.activeOrgUnitPath) {
    const subtree = await prisma.orgUnit.findMany({
      where: { tenantId: ctx.tenantId, path: { startsWith: ctx.activeOrgUnitPath } },
      select: { id: true },
    })

    return { ownerUnitId: { in: subtree.map((unit) => unit.id) } }
  }

  if (granted === "UNIT" && ctx.activeOrgUnitId) {
    return { ownerUnitId: ctx.activeOrgUnitId }
  }

  // OWN — เห็นเฉพาะที่ตัวเองสร้าง หรือที่เวียนมาถึงตัวเอง
  return {
    OR: [
      { createdById: ctx.userId },
      {
        recipients: {
          some: { OR: [{ userId: ctx.userId }, { orgUnitId: { in: [...ctx.orgUnitIds] } }] },
        },
      },
    ],
  }
}

/**
 * ค้นชื่อเรื่องและเลขที่หนังสือ
 *
 * ใช้ `contains` ซึ่ง Postgres แปลงเป็น `ILIKE '%…%'` — เข้ากับ GIN + pg_trgm
 * ที่สร้างไว้ใน migration ของ P2 เพราะภาษาไทยไม่มีเว้นวรรค tsvector ตัดคำไม่ได้ (§9.2)
 */
function searchWhere(q?: string): Prisma.DocumentWhereInput {
  const needle = q?.trim()
  if (!needle) return {}

  return {
    OR: [
      { subject: { contains: needle, mode: "insensitive" } },
      { docNo: { contains: needle, mode: "insensitive" } },
      { externalSenderName: { contains: needle, mode: "insensitive" } },
      { externalRecipientName: { contains: needle, mode: "insensitive" } },
    ],
  }
}

function dateWhere(filter: DocumentListFilter): Prisma.DocumentWhereInput {
  if (!filter.from && !filter.to) return {}

  // ร่างเรียงตามวันที่แก้ล่าสุด ส่วนที่ออกเลขแล้วเรียงตามวันที่ของหนังสือ
  const field = filter.scope === "drafts" ? "updatedAt" : "docDate"

  return {
    [field]: {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    },
  }
}

function orderFor(scope: DocumentListScope): Prisma.DocumentOrderByWithRelationInput[] {
  if (scope === "drafts") return [{ updatedAt: "desc" }]

  // คิวออกเลขเรียงเก่าไปใหม่ — ใครส่งก่อนต้องได้เลขก่อน
  if (scope === "queue") return [{ urgencyLevel: "desc" }, { updatedAt: "asc" }]

  return [{ docDate: "desc" }, { createdAt: "desc" }]
}
