import "server-only"

import { NOTIFICATION_BODY, NOTIFICATION_TEXT } from "@/constants"
import { PERMISSIONS } from "@/lib/authz"
import { prisma } from "@/lib/db"
import {
  NOTIFICATION_TYPES,
  notificationHref,
  notifier,
  type NotificationMessage,
  type NotificationType,
} from "@/lib/notification"

import type { ServiceContext } from "../context"
import { documentVisibilityWhere } from "./document-visibility"

// ใครควรรู้เรื่องอะไร (D10 · spec §11.2)
//
// ⚠️ **เรียกหลัง transaction commit แล้วเท่านั้น** — การแจ้งเตือนที่ล้มต้องไม่ลาก
// การออกเลข/เวียนหนังสือที่สำเร็จไปแล้วให้ rollback ตามไปด้วย (§6.4 เลขที่ออกไปแล้ว
// ถอนคืนไม่ได้) · ตัว adapter กลืน error อยู่แล้วชั้นหนึ่ง ที่นี่กลืนซ้ำอีกชั้น
// เพราะขั้นตอนหาผู้รับก็ยิงฐานข้อมูลเหมือนกันและล้มได้เอง
//
// ⚠️ แจ้งเฉพาะเหตุการณ์ที่ผู้รับ **ต้องลงมือทำอะไรต่อ** — ไม่ใช่ทุก transition
// กระดิ่งที่ดังทุกเรื่องคือกระดิ่งที่ทุกคนเลิกกด แล้วเรื่องที่สำคัญจริงจะจมไปด้วย

/** ข้อมูลเอกสารเท่าที่การแจ้งเตือนต้องใช้ — ไม่ผูกกับ shape ของ loadDocument() */
export interface NotifiableDocument {
  id: string
  subject: string
  confidentialityLevel: number
  ownerUnitId: string
  createdById: string
  docNo: string | null
  ownerUnit?: { nameTh: string } | null
}

/** ผู้รับที่คำสั่งเวียน/ส่งต่อระบุมา — หน่วยงานหรือรายบุคคล */
export interface NotifiableRecipient {
  orgUnitId?: string | undefined
  userId?: string | undefined
}

/**
 * ชื่อเรื่องที่เอาไปแสดงในการแจ้งเตือนได้
 *
 * ⚠️ หัวใจของโมดูลนี้ · การแจ้งเตือนถูกอ่านจากกระดิ่งโดย**ไม่ผ่านด่าน `can()` ของเอกสาร**
 * ถ้าปล่อยชื่อเรื่องของเอกสารชั้น 1-3 ออกมา จะเปิดช่องเดิมกับที่ §22.2 เพิ่งปิดไป
 * — ชื่อเรื่องของหนังสือลับคือตัวความลับเอง ("ผลการสอบสวนทางวินัยของ...")
 */
export function safeSubject(
  document: Pick<NotifiableDocument, "subject" | "confidentialityLevel">,
) {
  return document.confidentialityLevel > 0
    ? NOTIFICATION_TEXT.confidentialSubject
    : document.subject
}

// ---------------------------------------------------------------------------
// จุดเรียกจาก document.service.ts
// ---------------------------------------------------------------------------

/** มีหนังสือเวียนถึงคุณ — แจ้งผู้รับทุกคนในคำสั่งนี้ */
export async function notifyCirculated(
  ctx: ServiceContext,
  document: NotifiableDocument,
  recipients: NotifiableRecipient[],
) {
  await safely(async () => {
    const userIds = await resolveRecipientUsers(ctx, recipients)
    const subject = safeSubject(document)
    const from = document.ownerUnit?.nameTh ?? ""

    await send(userIds, ctx.userId, document, NOTIFICATION_TYPES.documentCirculated, {
      title: NOTIFICATION_TEXT.circulatedTitle,
      body: NOTIFICATION_BODY.circulated(subject, from),
    })
  })
}

/** มีหนังสือรอออกเลข — แจ้งคนที่ออกเลขให้หน่วยงานนี้ได้ */
export async function notifySubmitted(ctx: ServiceContext, document: NotifiableDocument) {
  await safely(async () => {
    const userIds = await resolveNumberIssuers(ctx, document)
    const subject = safeSubject(document)
    const unit = document.ownerUnit?.nameTh ?? ""

    await send(userIds, ctx.userId, document, NOTIFICATION_TYPES.documentSubmitted, {
      title: NOTIFICATION_TEXT.submittedTitle,
      body: NOTIFICATION_BODY.submitted(subject, unit),
    })
  })
}

/** หนังสือได้เลขแล้ว / ถูกตีกลับ / ปิดเรื่อง — แจ้งเจ้าของเรื่อง */
export async function notifyOwner(
  ctx: ServiceContext,
  document: NotifiableDocument,
  type: NotificationType,
  note?: string | null,
) {
  await safely(async () => {
    const subject = safeSubject(document)

    const content =
      type === NOTIFICATION_TYPES.documentNumberIssued
        ? {
            title: NOTIFICATION_TEXT.numberIssuedTitle,
            body: NOTIFICATION_BODY.numberIssued(
              subject,
              document.docNo ?? NOTIFICATION_TEXT.noDocNo,
            ),
          }
        : type === NOTIFICATION_TYPES.documentReturned
          ? {
              title: NOTIFICATION_TEXT.returnedTitle,
              body: NOTIFICATION_BODY.returned(subject, note ?? ""),
            }
          : { title: NOTIFICATION_TEXT.closedTitle, body: NOTIFICATION_BODY.closed(subject) }

    await send([document.createdById], ctx.userId, document, type, content)
  })
}

// ---------------------------------------------------------------------------
// ภายใน
// ---------------------------------------------------------------------------

/**
 * ส่งจริง — ตัดผู้ลงมือออกจากรายชื่อเสมอ
 *
 * คนที่เพิ่งกดปุ่มเองรู้อยู่แล้วว่าเกิดอะไรขึ้น การแจ้งเตือนตัวเองคือเสียงรบกวนล้วน ๆ
 * (และเจ้าของเรื่องที่กดปิดเรื่องเองก็ไม่ต้องได้รับแจ้งว่าตัวเองปิดเรื่อง)
 */
async function send(
  userIds: string[],
  actorUserId: string,
  document: NotifiableDocument,
  type: NotificationType,
  content: { title: string; body: string },
) {
  const targets = [...new Set(userIds)].filter((userId) => userId !== actorUserId)

  if (targets.length === 0) return

  const messages: NotificationMessage[] = targets.map((recipientUserId) => ({
    recipientUserId,
    type,
    title: content.title,
    body: content.body,
    refType: "DOCUMENT",
    refId: document.id,
  }))

  await notifier.sendMany(messages)
}

/**
 * แปลงผู้รับให้เป็นรายชื่อผู้ใช้
 *
 * ผู้รับที่เป็น "ทั้งหน่วยงาน" ต้องกางออกเป็นรายคน เพราะการแจ้งเตือนผูกกับ user เสมอ
 * (เอกสารชั้น 1-3 บังคับให้ระบุรายบุคคลอยู่แล้วตั้งแต่ createRecipients จึงไม่ต้องกาง)
 */
async function resolveRecipientUsers(ctx: ServiceContext, recipients: NotifiableRecipient[]) {
  const direct = recipients.flatMap((recipient) => (recipient.userId ? [recipient.userId] : []))
  const unitIds = recipients.flatMap((recipient) =>
    recipient.orgUnitId && !recipient.userId ? [recipient.orgUnitId] : [],
  )

  if (unitIds.length === 0) return direct

  const members = await prisma.userOrgUnit.findMany({
    where: {
      orgUnitId: { in: unitIds },
      user: { tenantId: ctx.tenantId, isActive: true, deletedAt: null },
    },
    select: { userId: true },
  })

  return [...direct, ...members.map((row) => row.userId)]
}

/**
 * ใครออกเลขให้หน่วยงานนี้ได้
 *
 * - เอกสารชั้น 1-3 → **นายทะเบียนหนังสือลับ** ของหน่วยงานที่ชั้นถึงเท่านั้น (§22.3)
 *   คนอื่นแม้มีสิทธิ์ออกเลขก็เปิดเอกสารไม่ได้ การแจ้งไปก็ได้แค่ความว่างเปล่า
 * - เอกสารชั้น 0 → ผู้ที่ถือบทบาทซึ่งให้สิทธิ์ `document.number.issue` **ที่ผูกกับหน่วยงานนี้**
 *   บทบาทระดับทั้งองค์กร (orgUnitId = null เช่น SYSTEM_ADMIN) ไม่นับ — ไม่งั้นผู้ดูแลระบบ
 *   จะได้รับแจ้งทุกฉบับที่ทุกหน่วยงานส่งออกเลข
 */
async function resolveNumberIssuers(ctx: ServiceContext, document: NotifiableDocument) {
  if (document.confidentialityLevel > 0) {
    const registrars = await prisma.confidentialRegistrar.findMany({
      where: {
        orgUnitId: document.ownerUnitId,
        user: {
          isActive: true,
          deletedAt: null,
          clearanceLevel: { gte: document.confidentialityLevel },
        },
      },
      select: { userId: true },
    })

    return registrars.map((row) => row.userId)
  }

  const now = new Date()

  const holders = await prisma.userRole.findMany({
    where: {
      orgUnitId: document.ownerUnitId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      role: { permissions: { some: { permissionCode: PERMISSIONS.DOCUMENT_NUMBER_ISSUE } } },
      user: { tenantId: ctx.tenantId, isActive: true, deletedAt: null },
    },
    select: { userId: true },
  })

  return holders.map((row) => row.userId)
}

/** กลืน error ของทั้งขั้นตอน — รวมขั้นหาผู้รับซึ่งยิงฐานข้อมูลเองและล้มได้ */
async function safely(run: () => Promise<void>) {
  try {
    await run()
  } catch (error) {
    console.error("[notification] ประกอบหรือส่งการแจ้งเตือนไม่สำเร็จ", error)
  }
}

// ---------------------------------------------------------------------------
// อ่าน — กระดิ่งและหน้ารายการ
// ---------------------------------------------------------------------------

/**
 * ⚠️ ห้ามอ่านตาราง `notifications` ตรง ๆ แล้วเอาไปแสดง
 *
 * `refId` เป็นข้อความธรรมดา **ไม่มี FK** และแถวแจ้งเตือนถูกเขียนไว้ ณ เวลาที่เกิดเหตุ
 * สิ่งที่เปลี่ยนได้ทีหลังโดยที่แถวเดิมไม่รู้ตัวเลยมีสามอย่าง
 *   1. เอกสารถูกลบ (soft delete) — กระดิ่งจะพาไปหน้าที่เปิดไม่ได้
 *   2. เอกสารถูก**ปรับชั้นความลับขึ้น** — คนที่เคยเห็นได้ตอนนั้น วันนี้ไม่ควรเห็นแล้ว
 *   3. ACL รายบุคคลถูกถอน หรือหมดอายุ
 *
 * จึงต้องกรองผ่าน `documentVisibilityWhere()` ทุกครั้ง — ด่านเดียวกับที่ทุกหน้าที่ list
 * เอกสารใช้ (§22.2) · ไม่งั้นกระดิ่งจะกลายเป็นช่องรั่วช่องใหม่ที่มีชื่อเรื่องติดมาด้วย
 */
async function visibleNotifications(ctx: ServiceContext, rows: readonly NotificationRow[]) {
  const documentIds = [
    ...new Set(rows.flatMap((row) => (row.refType === "DOCUMENT" && row.refId ? [row.refId] : []))),
  ]

  if (documentIds.length === 0) return rows.filter((row) => !row.refId)

  const visible = await prisma.document.findMany({
    where: {
      id: { in: documentIds },
      tenantId: ctx.tenantId,
      deletedAt: null,
      // ต่อด้วย AND ไม่ใช่ spread — บทเรียน §20 ข้อ 1
      AND: [await documentVisibilityWhere(ctx)],
    },
    select: { id: true },
  })

  const allowed = new Set(visible.map((document) => document.id))

  return rows.filter((row) => (row.refId ? allowed.has(row.refId) : true))
}

interface NotificationRow {
  id: string
  type: string
  title: string
  body: string
  refType: string | null
  refId: string | null
  readAt: Date | null
  createdAt: Date
}

/** หนึ่งรายการที่พร้อมแสดงบนหน้าจอ */
export interface NotificationView extends NotificationRow {
  href: string | undefined
}

/**
 * จำนวนที่ยังไม่อ่านสำหรับตัวเลขบนกระดิ่ง
 *
 * นับจากรายการที่**กรองแล้ว** ไม่ใช่ `count()` ตรง ๆ — ไม่งั้นตัวเลขบนกระดิ่งจะไม่ตรง
 * กับจำนวนรายการที่เปิดออกมาแล้วเห็นจริง · ดึงมาไม่เกิน `UNREAD_CAP` เพราะตัวเลขที่เกิน
 * ร้อยไม่มีความหมายกับผู้ใช้อยู่แล้ว และการนับให้ครบทุกแถวคือการโหลดทั้งตารางทุกครั้งที่โหลดหน้า
 */
export const UNREAD_CAP = 99

export async function countUnreadNotifications(ctx: ServiceContext): Promise<number> {
  const rows = await prisma.notification.findMany({
    where: { userId: ctx.userId, readAt: null },
    orderBy: { createdAt: "desc" },
    take: UNREAD_CAP,
    select: NOTIFICATION_SELECT,
  })

  return (await visibleNotifications(ctx, rows)).length
}

export async function listNotifications(
  ctx: ServiceContext,
  options: { limit?: number; unreadOnly?: boolean } = {},
): Promise<NotificationView[]> {
  const rows = await prisma.notification.findMany({
    where: { userId: ctx.userId, ...(options.unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 30,
    select: NOTIFICATION_SELECT,
  })

  const visible = await visibleNotifications(ctx, rows)

  return visible.map((row) => ({ ...row, href: notificationHref(row.refType, row.refId) }))
}

const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  title: true,
  body: true,
  refType: true,
  refId: true,
  readAt: true,
  createdAt: true,
} as const

/**
 * มาร์คว่าอ่านแล้ว
 *
 * เงื่อนไข `userId` อยู่ใน where ไม่ใช่ตรวจก่อนแล้วค่อยอัปเดต — คนอื่นส่ง id ของแถว
 * ที่ไม่ใช่ของตัวเองมาจะได้ count 0 ไม่ใช่ทำงานสำเร็จ
 */
export async function markNotificationRead(ctx: ServiceContext, id: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id, userId: ctx.userId, readAt: null },
    data: { readAt: new Date() },
  })
}

export async function markAllNotificationsRead(ctx: ServiceContext): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId: ctx.userId, readAt: null },
    data: { readAt: new Date() },
  })

  return result.count
}
