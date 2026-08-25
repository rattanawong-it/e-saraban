import "server-only"

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, writeAudit, type AuditAction } from "@/lib/audit"
import { PERMISSIONS, type Permission } from "@/lib/authz"
import { prisma } from "@/lib/db"
import { toAuthzResource } from "@/lib/documents/authz-resource"
import {
  EDITABLE_STATUSES,
  isEditable,
  nextStatus,
  type DocumentTransition,
} from "@/lib/documents/state-machine"
import type {
  CreateDocumentInput,
  DocumentStatusValue,
  RecipientKindValue,
  RegisterIncomingInput,
  UpdateDocumentInput,
} from "@/schemas/document.schema"

import type { ServiceContext } from "../context"
import { assertPermission, ServiceError } from "./errors"
import { issueNumberWithin } from "./numbering.service"

// วงจรชีวิตเอกสาร ฝั่ง service (spec §6)
//
// ทุก transition เดินผ่าน applyTransition() ตัวเดียว เพื่อให้สามอย่างนี้เกิดขึ้นครบเสมอ:
//   1. ตรวจสิทธิ์ด้วย can() พร้อมด่าน STATE จากตาราง state machine
//   2. เขียน DocumentAction (timeline ที่ผู้ใช้เห็น)
//   3. เขียน AuditLog (ชั้นของผู้ตรวจสอบ — §6.4 ระบุว่าเป็นคนละชั้นกัน)
//
// ถ้าเพิ่ม transition ใหม่แล้วลืมข้อใดข้อหนึ่ง ทะเบียนจะมีช่องโหว่ที่ตรวจย้อนหลังไม่ได้

/** ผู้รับหนึ่งรายที่ service รับเข้ามา */
interface RecipientInput {
  orgUnitId?: string | undefined
  userId?: string | undefined
  kind: RecipientKindValue
}

const AUDIT_BY_TRANSITION: Record<DocumentTransition, AuditAction> = {
  SUBMITTED: AUDIT_ACTIONS.DOCUMENT_SUBMITTED,
  RETURNED: AUDIT_ACTIONS.DOCUMENT_RETURNED,
  NUMBER_ISSUED: AUDIT_ACTIONS.DOCUMENT_NUMBER_ISSUED,
  CIRCULATED: AUDIT_ACTIONS.DOCUMENT_CIRCULATED,
  ACKNOWLEDGED: AUDIT_ACTIONS.DOCUMENT_ACKNOWLEDGED,
  MARKED_SENT: AUDIT_ACTIONS.DOCUMENT_MARKED_SENT,
  FORWARDED: AUDIT_ACTIONS.DOCUMENT_FORWARDED,
  CLOSED: AUDIT_ACTIONS.DOCUMENT_CLOSED,
  CANCELLED: AUDIT_ACTIONS.DOCUMENT_CANCELLED,
}

// ---------------------------------------------------------------------------
// อ่าน
// ---------------------------------------------------------------------------

export async function getDocument(ctx: ServiceContext, id: string) {
  const document = await loadDocument(ctx, id)

  assertPermission(ctx, PERMISSIONS.DOCUMENT_READ, toAuthzResource(document))

  return document
}

// ---------------------------------------------------------------------------
// สร้างและแก้ไขร่าง
// ---------------------------------------------------------------------------

export async function createDocument(ctx: ServiceContext, input: CreateDocumentInput) {
  const ownerUnitId = input.ownerUnitId ?? ctx.activeOrgUnitId
  if (!ownerUnitId) throw new ServiceError("ยังไม่ได้เลือกหน่วยงานที่ทำงานอยู่", "VALIDATION")

  const [ownerUnit, documentType] = await Promise.all([
    prisma.orgUnit.findFirst({
      where: { id: ownerUnitId, tenantId: ctx.tenantId, isActive: true },
    }),
    prisma.documentType.findFirst({
      where: { id: input.documentTypeId, tenantId: ctx.tenantId, isActive: true },
    }),
  ])

  if (!ownerUnit) throw new ServiceError("ไม่พบหน่วยงานเจ้าของเรื่อง", "NOT_FOUND")
  if (!documentType) throw new ServiceError("ไม่พบประเภทหนังสือที่เลือก", "NOT_FOUND")

  if (documentType.direction === "INCOMING") {
    throw new ServiceError("หนังสือรับต้องลงทะเบียนผ่านหน้าทะเบียนรับ", "VALIDATION")
  }

  assertPermission(ctx, PERMISSIONS.DOCUMENT_CREATE, {
    ownerUnitId: ownerUnit.id,
    ownerUnitPath: ownerUnit.path,
    createdById: ctx.userId,
    confidentialityLevel: input.confidentialityLevel,
  })

  assertClearance(ctx, input.confidentialityLevel)

  return prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        tenantId: ctx.tenantId,
        documentTypeId: documentType.id,
        direction: documentType.direction,
        status: "DRAFT",
        bookCode: documentType.defaultBookCode,
        subject: input.subject,
        summary: input.summary || null,
        docDate: input.docDate ?? null,
        dueDate: input.dueDate ?? null,
        confidentialityLevel: input.confidentialityLevel,
        urgencyLevel: input.urgencyLevel,
        ownerUnitId: ownerUnit.id,
        createdById: ctx.userId,
        createdByUnitId: ctx.activeOrgUnitId ?? ownerUnit.id,
        externalSenderName: input.externalSenderName || null,
        externalRecipientName: input.externalRecipientName || null,
        refDocNo: input.refDocNo || null,
        parentDocumentId: input.parentDocumentId || null,
      },
    })

    if (input.recipients.length > 0) {
      await createRecipients(tx, document.id, input.recipients)
    }

    await tx.documentAction.create({
      data: {
        documentId: document.id,
        actorUserId: ctx.userId,
        actorUnitId: ctx.activeOrgUnitId,
        actionType: "CREATED",
        toStatus: "DRAFT",
      },
    })

    await writeAudit(tx, {
      ...auditBase(ctx, document.id),
      action: AUDIT_ACTIONS.DOCUMENT_CREATED,
      severity: "INFO",
      metadata: { subject: document.subject, direction: document.direction },
    })

    return document
  })
}

export async function updateDocument(ctx: ServiceContext, input: UpdateDocumentInput) {
  const document = await loadDocument(ctx, input.id)

  // §6.4 — แก้ metadata ได้เฉพาะ DRAFT กับ RETURNED
  // เอกสารที่ออกเลขแล้วแก้ได้อย่างเดียวคือแนบไฟล์เวอร์ชันใหม่พร้อมบันทึกเหตุผล
  assertPermission(ctx, PERMISSIONS.DOCUMENT_UPDATE, toAuthzResource(document), {
    allowedStatuses: EDITABLE_STATUSES,
  })

  if (!isEditable(document.status)) {
    throw new ServiceError("เอกสารที่ออกเลขแล้วแก้ไขไม่ได้ (spec §6.4)", "VALIDATION")
  }

  const documentType = await prisma.documentType.findFirst({
    where: { id: input.documentTypeId, tenantId: ctx.tenantId, isActive: true },
  })

  if (!documentType) throw new ServiceError("ไม่พบประเภทหนังสือที่เลือก", "NOT_FOUND")

  // ทิศทางกำหนดทั้งวงจรสถานะ (§6.1–6.3) และทะเบียนที่ใช้ออกเลข (§7)
  // ถ้าปล่อยให้สลับข้ามทิศทาง เอกสารจะมี direction เดิมค้างอยู่กับประเภทใหม่
  // แล้วปุ่มบนหน้าเว็บกับเส้นทางที่ service ยอมจะไม่ตรงกันทันที
  if (documentType.direction !== document.direction) {
    throw new ServiceError(
      "เปลี่ยนประเภทหนังสือข้ามทิศทางไม่ได้ — ต้องสร้างฉบับใหม่แทน",
      "VALIDATION",
    )
  }

  assertClearance(ctx, input.confidentialityLevel)

  return prisma.$transaction(async (tx) => {
    const updated = await tx.document.update({
      where: { id: document.id },
      data: {
        documentTypeId: documentType.id,
        // ร่างยังไม่มีเลข การย้ายเล่มทะเบียนตามประเภทใหม่จึงยังปลอดภัย
        bookCode: documentType.defaultBookCode,
        subject: input.subject,
        summary: input.summary || null,
        docDate: input.docDate ?? null,
        dueDate: input.dueDate ?? null,
        confidentialityLevel: input.confidentialityLevel,
        urgencyLevel: input.urgencyLevel,
        externalSenderName: input.externalSenderName || null,
        externalRecipientName: input.externalRecipientName || null,
        refDocNo: input.refDocNo || null,
        parentDocumentId: input.parentDocumentId || null,
      },
    })

    await tx.documentAction.create({
      data: {
        documentId: document.id,
        actorUserId: ctx.userId,
        actorUnitId: ctx.activeOrgUnitId,
        actionType: "UPDATED",
        fromStatus: document.status,
        toStatus: document.status,
      },
    })

    await writeAudit(tx, {
      ...auditBase(ctx, document.id),
      action: AUDIT_ACTIONS.DOCUMENT_UPDATED,
      severity: "INFO",
      metadata: {
        before: { subject: document.subject, confidentialityLevel: document.confidentialityLevel },
        after: { subject: updated.subject, confidentialityLevel: updated.confidentialityLevel },
      },
    })

    return updated
  })
}

// ---------------------------------------------------------------------------
// หนังสือรับ (A1 · spec §6.3) — ลงทะเบียนพร้อมออกเลขรับในขั้นตอนเดียว
// ---------------------------------------------------------------------------

export async function registerIncoming(ctx: ServiceContext, input: RegisterIncomingInput) {
  const ownerUnitId = input.ownerUnitId ?? ctx.activeOrgUnitId
  if (!ownerUnitId) throw new ServiceError("ยังไม่ได้เลือกหน่วยงานที่ทำงานอยู่", "VALIDATION")

  const [ownerUnit, documentType] = await Promise.all([
    prisma.orgUnit.findFirst({
      where: { id: ownerUnitId, tenantId: ctx.tenantId, isActive: true },
    }),
    prisma.documentType.findFirst({
      where: { id: input.documentTypeId, tenantId: ctx.tenantId, isActive: true },
    }),
  ])

  if (!ownerUnit) throw new ServiceError("ไม่พบหน่วยงานเจ้าของเรื่อง", "NOT_FOUND")
  if (!documentType) throw new ServiceError("ไม่พบประเภทหนังสือที่เลือก", "NOT_FOUND")

  if (documentType.direction !== "INCOMING") {
    throw new ServiceError("ประเภทหนังสือที่เลือกไม่ใช่หนังสือรับ", "VALIDATION")
  }

  const resource = {
    ownerUnitId: ownerUnit.id,
    ownerUnitPath: ownerUnit.path,
    createdById: ctx.userId,
    confidentialityLevel: input.confidentialityLevel,
  }

  // ลงทะเบียนรับ = สร้างเอกสาร + ออกเลขรับ จึงต้องมีสิทธิ์ทั้งสองอย่าง
  assertPermission(ctx, PERMISSIONS.DOCUMENT_CREATE, resource)
  assertPermission(ctx, PERMISSIONS.DOCUMENT_NUMBER_ISSUE, resource)
  assertClearance(ctx, input.confidentialityLevel)

  return prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        tenantId: ctx.tenantId,
        documentTypeId: documentType.id,
        direction: "INCOMING",
        status: "RECEIVED",
        bookCode: documentType.defaultBookCode,
        subject: input.subject,
        summary: input.summary || null,
        docDate: input.docDate ?? null,
        receivedDate: input.receivedDate ?? new Date(),
        dueDate: input.dueDate ?? null,
        confidentialityLevel: input.confidentialityLevel,
        urgencyLevel: input.urgencyLevel,
        ownerUnitId: ownerUnit.id,
        createdById: ctx.userId,
        createdByUnitId: ctx.activeOrgUnitId ?? ownerUnit.id,
        externalSenderName: input.externalSenderName,
        refDocNo: input.refDocNo || null,
        parentDocumentId: input.parentDocumentId || null,
      },
    })

    await tx.documentAction.create({
      data: {
        documentId: document.id,
        actorUserId: ctx.userId,
        actorUnitId: ctx.activeOrgUnitId,
        actionType: "CREATED",
        toStatus: "RECEIVED",
      },
    })

    await writeAudit(tx, {
      ...auditBase(ctx, document.id),
      action: AUDIT_ACTIONS.DOCUMENT_CREATED,
      severity: "INFO",
      metadata: {
        subject: document.subject,
        direction: "INCOMING",
        externalSenderName: document.externalSenderName,
      },
    })

    // ออกเลขรับในทรานแซกชันเดียวกัน — ถ้าออกเลขพัง เอกสารต้องไม่ค้างอยู่แบบไม่มีเลข
    const issued = await issueNumberWithin(tx, ctx, { ...document, ownerUnit, documentType })

    return { document, ...issued }
  })
}

// ---------------------------------------------------------------------------
// transition ต่าง ๆ
// ---------------------------------------------------------------------------

export async function submitDocument(ctx: ServiceContext, id: string, note?: string | null) {
  return applyTransition(ctx, id, {
    transition: "SUBMITTED",
    permission: PERMISSIONS.DOCUMENT_SUBMIT,
    note,
  })
}

export async function returnDocument(ctx: ServiceContext, id: string, note: string) {
  return applyTransition(ctx, id, {
    transition: "RETURNED",
    permission: PERMISSIONS.DOCUMENT_RETURN,
    note,
  })
}

export async function markSentDocument(ctx: ServiceContext, id: string, note?: string | null) {
  return applyTransition(ctx, id, {
    transition: "MARKED_SENT",
    permission: PERMISSIONS.DOCUMENT_SEND_EXTERNAL,
    note,
  })
}

export async function closeDocument(ctx: ServiceContext, id: string, note?: string | null) {
  return applyTransition(ctx, id, {
    transition: "CLOSED",
    permission: PERMISSIONS.DOCUMENT_CLOSE,
    note,
  })
}

/**
 * ยกเลิกเอกสาร
 *
 * §6.4: ยกเลิกหลังออกเลขได้ แต่ **เลขถูกจองไว้ ไม่นำกลับมาใช้ซ้ำ** —
 * แถวยังอยู่ในทะเบียนพร้อมสถานะ CANCELLED และตัวนับไม่ถูกลดกลับ
 * เพราะเลขที่หายไปจากทะเบียนคือสัญญาณของการทุจริต
 */
export async function cancelDocument(ctx: ServiceContext, id: string, note?: string | null) {
  return applyTransition(ctx, id, {
    transition: "CANCELLED",
    permission: PERMISSIONS.DOCUMENT_DELETE,
    note,
    severity: "WARNING",
  })
}

export async function circulateDocument(
  ctx: ServiceContext,
  id: string,
  recipients: RecipientInput[],
  note?: string | null,
) {
  return applyTransition(ctx, id, {
    transition: "CIRCULATED",
    permission: PERMISSIONS.DOCUMENT_CIRCULATE,
    note,
    extra: async (tx, documentId) => {
      await createRecipients(tx, documentId, recipients, "SENT")
    },
    metadata: { recipientCount: recipients.length },
  })
}

export async function forwardDocument(
  ctx: ServiceContext,
  id: string,
  recipients: RecipientInput[],
  note?: string | null,
) {
  return applyTransition(ctx, id, {
    transition: "FORWARDED",
    permission: PERMISSIONS.DOCUMENT_CIRCULATE,
    note,
    extra: async (tx, documentId) => {
      await createRecipients(tx, documentId, recipients, "SENT")
    },
    metadata: { recipientCount: recipients.length },
  })
}

/**
 * ผู้รับกดรับทราบ
 *
 * เป็นการกระทำระดับ "ผู้รับหนึ่งราย" ไม่ใช่ระดับเอกสาร — เอกสารจะปิดเรื่องเองก็ต่อเมื่อ
 * ผู้รับชั้น TO ทุกรายรับทราบครบ (CC/FYI ไม่นับ เพราะเป็นแค่สำเนา)
 */
export async function acknowledgeDocument(
  ctx: ServiceContext,
  id: string,
  note?: string | null,
): Promise<{ status: DocumentStatusValue; allAcknowledged: boolean }> {
  const document = await loadDocument(ctx, id)

  assertPermission(ctx, PERMISSIONS.DOCUMENT_ACKNOWLEDGE, toAuthzResource(document))

  const mine = document.recipients.filter(
    (recipient) =>
      recipient.userId === ctx.userId ||
      (recipient.orgUnitId !== null && ctx.orgUnitIds.includes(recipient.orgUnitId)),
  )

  if (mine.length === 0) {
    throw new ServiceError("เอกสารฉบับนี้ไม่ได้เวียนถึงคุณ", "FORBIDDEN")
  }

  return prisma.$transaction(async (tx) => {
    const now = new Date()

    await tx.documentRecipient.updateMany({
      where: { id: { in: mine.map((recipient) => recipient.id) } },
      data: { status: "ACKNOWLEDGED", acknowledgedAt: now, readAt: now },
    })

    const pendingTo = await tx.documentRecipient.count({
      where: { documentId: document.id, kind: "TO", status: { not: "ACKNOWLEDGED" } },
    })

    const allAcknowledged = pendingTo === 0
    const toStatus = allAcknowledged
      ? nextStatus(document.direction, "ACKNOWLEDGED", document.status)
      : null

    if (toStatus) {
      await tx.document.update({ where: { id: document.id }, data: { status: toStatus } })
    }

    await tx.documentAction.create({
      data: {
        documentId: document.id,
        actorUserId: ctx.userId,
        actorUnitId: ctx.activeOrgUnitId,
        actionType: "ACKNOWLEDGED",
        fromStatus: document.status,
        toStatus: toStatus ?? document.status,
        note: note || null,
      },
    })

    await writeAudit(tx, {
      ...auditBase(ctx, document.id),
      action: AUDIT_ACTIONS.DOCUMENT_ACKNOWLEDGED,
      severity: "INFO",
      metadata: { allAcknowledged, remainingTo: pendingTo },
    })

    return { status: toStatus ?? document.status, allAcknowledged }
  })
}

// ---------------------------------------------------------------------------
// ภายใน
// ---------------------------------------------------------------------------

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

interface TransitionOptions {
  transition: DocumentTransition
  permission: Permission
  note?: string | null
  severity?: "INFO" | "NOTICE" | "WARNING" | "CRITICAL"
  metadata?: Record<string, unknown>
  extra?: (tx: TransactionClient, documentId: string) => Promise<void>
}

/** ทางเดียวที่เอกสารเปลี่ยนสถานะได้ — ตรวจสิทธิ์ + เขียน timeline + เขียน audit ครบในที่เดียว */
async function applyTransition(ctx: ServiceContext, id: string, options: TransitionOptions) {
  const document = await loadDocument(ctx, id)

  const toStatus = nextStatus(document.direction, options.transition, document.status)

  // ตรวจสิทธิ์ก่อนเสมอ ไม่งั้นคนที่ไม่มีสิทธิ์จะรู้ว่าเอกสารอยู่สถานะไหนจากข้อความ error
  assertPermission(ctx, options.permission, toAuthzResource(document))

  if (!toStatus) {
    throw new ServiceError(
      `เอกสารที่สถานะปัจจุบันทำรายการนี้ไม่ได้ (${document.status})`,
      "VALIDATION",
    )
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.document.update({
      where: { id: document.id },
      data: { status: toStatus },
    })

    await options.extra?.(tx, document.id)

    await tx.documentAction.create({
      data: {
        documentId: document.id,
        actorUserId: ctx.userId,
        actorUnitId: ctx.activeOrgUnitId,
        actionType: options.transition,
        fromStatus: document.status,
        toStatus,
        note: options.note || null,
      },
    })

    await writeAudit(tx, {
      ...auditBase(ctx, document.id),
      action: AUDIT_BY_TRANSITION[options.transition],
      severity: options.severity ?? "NOTICE",
      metadata: {
        fromStatus: document.status,
        toStatus,
        docNo: document.docNo,
        ...options.metadata,
      },
    })

    return updated
  })
}

async function loadDocument(ctx: ServiceContext, id: string) {
  const document = await prisma.document.findFirst({
    where: { id, tenantId: ctx.tenantId, deletedAt: null },
    include: {
      ownerUnit: { select: { id: true, code: true, path: true, nameTh: true } },
      documentType: { select: { id: true, nameTh: true, direction: true } },
      recipients: { select: { id: true, orgUnitId: true, userId: true, kind: true, status: true } },
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

  return document
}

/** ชั้นความลับของผู้ใช้ต้องไม่ต่ำกว่าของเอกสาร (spec §8.1) */
function assertClearance(ctx: ServiceContext, confidentialityLevel: number) {
  if (ctx.clearanceLevel < confidentialityLevel) {
    throw new ServiceError("ชั้นความลับของคุณไม่พอสำหรับเอกสารระดับนี้", "FORBIDDEN")
  }
}

function auditBase(ctx: ServiceContext, documentId: string) {
  return {
    tenantId: ctx.tenantId,
    entityType: AUDIT_ENTITY_TYPES.DOCUMENT,
    entityId: documentId,
    actorUserId: ctx.userId,
    actorOrgUnitId: ctx.activeOrgUnitId,
    sessionId: ctx.sessionId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  }
}

async function createRecipients(
  tx: TransactionClient,
  documentId: string,
  recipients: RecipientInput[],
  status: "PENDING" | "SENT" = "PENDING",
) {
  const now = new Date()

  // กันซ้ำสองชั้น — ซ้ำภายในคำสั่งเดียวกัน และซ้ำกับผู้รับที่เอกสารมีอยู่แล้ว
  //
  // ⚠️ ถ้าปล่อยให้เพิ่มแถวซ้ำ (เช่นตั้งผู้รับไว้ตอนร่าง แล้วเวียนถึงหน่วยเดิมอีกครั้ง)
  // เอกสารจะปิดเรื่องเองไม่ได้ตลอดกาล เพราะการปิดรอให้ผู้รับชั้น TO **ทุกแถว** รับทราบ
  // แต่แถวที่ซ้ำมาค้างอยู่ที่ PENDING โดยไม่มีใครเห็นว่ามันมีอยู่
  const unique = new Map<string, RecipientInput>()

  for (const recipient of recipients) {
    unique.set(recipientKey(recipient), recipient)
  }

  const existing = await tx.documentRecipient.findMany({
    where: { documentId },
    select: { id: true, orgUnitId: true, userId: true },
  })

  const existingByKey = new Map(existing.map((row) => [recipientKey(row), row.id]))
  const fresh: RecipientInput[] = []

  for (const [key, recipient] of unique) {
    const existingId = existingByKey.get(key)

    if (!existingId) {
      fresh.push(recipient)
      continue
    }

    // เวียนถึงหน่วยที่อยู่ในรายชื่ออยู่แล้ว = อัปเดตแถวเดิมให้เป็นรอบล่าสุด
    // (ชั้นผู้รับเปลี่ยนได้ เช่นจาก "เรียน" เป็น "สำเนาถึง" — คำสั่งล่าสุดชนะ)
    await tx.documentRecipient.update({
      where: { id: existingId },
      data: { kind: recipient.kind, status, sentAt: status === "SENT" ? now : null },
    })
  }

  if (fresh.length === 0) return

  await tx.documentRecipient.createMany({
    data: fresh.map((recipient) => ({
      documentId,
      orgUnitId: recipient.orgUnitId ?? null,
      userId: recipient.userId ?? null,
      kind: recipient.kind,
      status,
      sentAt: status === "SENT" ? now : null,
    })),
  })
}

/** ผู้รับหนึ่งรายเป็นหน่วยงานหรือบุคคลอย่างใดอย่างหนึ่ง — คีย์จึงประกอบจากทั้งสองช่อง */
function recipientKey(recipient: { orgUnitId?: string | null; userId?: string | null }): string {
  return `${recipient.orgUnitId ?? ""}|${recipient.userId ?? ""}`
}
