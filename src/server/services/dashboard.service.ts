import "server-only"

import { canOrFalse, PERMISSIONS } from "@/lib/authz"
import { prisma } from "@/lib/db"

import type { DocumentActionType } from "@/generated/prisma/client"

import type { ServiceContext } from "../context"
import { documentVisibilityWhere } from "./document-visibility"
import { safeSubject } from "./notification.service"

// ข้อมูลหน้า /dashboard
//
// สถิติฝั่งเอกสารเพิ่มเข้ามาใน P4 (ก่อนหน้านี้หน้ามีแต่ฝั่ง Identity & Org)
//
// ⚠️ ทุกตัวเลขที่นับข้ามเอกสารของคนอื่นต้องผ่าน `documentVisibilityWhere` ตัวเดียวกับ
// หน้ารายการและหน้าค้นหา — ตัวเลขบนหน้าภาพรวมก็คือการเปิดเผยข้อมูลรูปแบบหนึ่ง
// "มีหนังสือลับรอออกเลข 3 ฉบับ" บอกอะไรกับคนที่ไม่ควรรู้ได้มากกว่าที่คิด

// ⚠️ เคยมี getDashboardStats() ที่ยิง COUNT แปดครั้ง (จำนวนหน่วยงาน · ผู้ใช้ · สังกัดของฉัน ·
// คำขอค้าง · เหตุการณ์ audit วันนี้) ให้หมวด "ผู้ใช้และหน่วยงาน" บนหน้าภาพรวม
// ผู้ดูแลสั่งถอดหมวดนั้นออกเมื่อ 27 ส.ค. 2569 — ตัวเลขทั้งชุดจึงไม่มีใครดูอีกแล้ว
// หน้าภาพรวมอ่านสิทธิ์ audit จาก canOrFalse() ตรง ๆ แทน ไม่ต้องแตะฐานข้อมูล
//
// ถ้าวันหลังอยากได้ตัวเลขพวกนี้กลับมา ให้เขียนใหม่เฉพาะตัวที่จะแสดงจริง อย่ายกก้อนเดิมกลับมา
// ทั้งชุด — ของเดิมนับทุกอย่างเสมอไม่ว่าหน้าจะแสดงกี่ตัว

export interface DocumentStats {
  /** รอสารบรรณออกเลข — เห็นเฉพาะที่อยู่ในขอบเขตของผู้ใช้ */
  pendingNumber: number
  /** ผู้รับชั้น "เรียน" ที่ยังไม่กดรับทราบ — งานค้างของฉันโดยตรง */
  awaitingMyAck: number
  myDrafts: number
  myReturned: number
  /** ออกเลขแล้วในเดือนนี้ แยกตามทิศทาง */
  thisMonth: { internal: number; outgoing: number; incoming: number }
}

export async function getDocumentStats(ctx: ServiceContext): Promise<DocumentStats> {
  if (!canOrFalse(ctx, PERMISSIONS.DOCUMENT_READ)) {
    return {
      pendingNumber: 0,
      awaitingMyAck: 0,
      myDrafts: 0,
      myReturned: 0,
      thisMonth: { internal: 0, outgoing: 0, incoming: 0 },
    }
  }

  const visibility = await documentVisibilityWhere(ctx)
  const base = { tenantId: ctx.tenantId, deletedAt: null }

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  // นับตามวันที่ของหนังสือ ซึ่งเป็นวันที่ทะเบียนราชการใช้จริง
  // ฉบับที่ไม่ได้กรอกวันที่ไว้ให้ใช้วันที่บันทึกเข้าระบบแทน จะได้ไม่หายไปจากยอด
  const issuedThisMonth = (direction: "INTERNAL" | "OUTGOING" | "INCOMING") =>
    prisma.document.count({
      where: {
        ...base,
        direction,
        docNo: { not: null },
        AND: [
          visibility,
          {
            OR: [
              { docDate: { gte: monthStart } },
              { docDate: null, createdAt: { gte: monthStart } },
            ],
          },
        ],
      },
    })

  const [pendingNumber, awaitingMyAck, myDrafts, myReturned, internal, outgoing, incoming] =
    await Promise.all([
      prisma.document.count({
        where: { ...base, status: "PENDING_NUMBER", AND: [visibility] },
      }),

      // งานค้างของฉัน — ไม่ต้องกรองด้วยขอบเขตอีกชั้น เพราะการเป็นผู้รับคือสิทธิ์ในตัวเอง
      prisma.documentRecipient.count({
        where: {
          kind: "TO",
          status: { not: "ACKNOWLEDGED" },
          OR: [{ userId: ctx.userId }, { orgUnitId: { in: [...ctx.orgUnitIds] } }],
          document: { ...base, status: { notIn: ["CLOSED", "CANCELLED"] } },
        },
      }),

      prisma.document.count({ where: { ...base, status: "DRAFT", createdById: ctx.userId } }),
      prisma.document.count({ where: { ...base, status: "RETURNED", createdById: ctx.userId } }),

      issuedThisMonth("INTERNAL"),
      issuedThisMonth("OUTGOING"),
      issuedThisMonth("INCOMING"),
    ])

  return {
    pendingNumber,
    awaitingMyAck,
    myDrafts,
    myReturned,
    thisMonth: { internal, outgoing, incoming },
  }
}

/** หนังสือที่รอฉันกดรับทราบ — การ์ดที่กดแล้วไปทำงานต่อได้ทันที ไม่ใช่แค่ตัวเลข */
export async function getAwaitingAcknowledgement(ctx: ServiceContext, take = 5) {
  if (!canOrFalse(ctx, PERMISSIONS.DOCUMENT_READ)) return []

  const rows = await prisma.documentRecipient.findMany({
    where: {
      kind: "TO",
      status: { not: "ACKNOWLEDGED" },
      OR: [{ userId: ctx.userId }, { orgUnitId: { in: [...ctx.orgUnitIds] } }],
      document: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        status: { notIn: ["CLOSED", "CANCELLED"] },
      },
    },
    // ด่วนที่สุดขึ้นก่อน แล้วจึงเรียงตามที่ส่งมาก่อน
    orderBy: [{ document: { urgencyLevel: "desc" } }, { sentAt: "asc" }],
    take,
    select: {
      id: true,
      sentAt: true,
      document: {
        select: {
          id: true,
          docNo: true,
          subject: true,
          urgencyLevel: true,
          confidentialityLevel: true,
          dueDate: true,
        },
      },
    },
  })

  return rows.map((row) => ({ ...row.document, recipientId: row.id, sentAt: row.sentAt }))
}

/**
 * ความเคลื่อนไหวล่าสุดของเอกสารที่ผู้ใช้คนนี้มองเห็นได้
 *
 * ⚠️ **เคยอ่านจากตาราง audit ตรง ๆ** ซึ่งเป็นของชั่วคราวตั้งแต่ P1 ตอนที่ระบบยังไม่มี
 * เอกสารให้แสดง · ผลคือหน้าภาพรวมขึ้น "เข้าสู่ระบบด้วย Google" "ออกจากระบบ"
 * "ผู้ดูแลรีเซ็ตรหัสผ่านให้" ปนกับงานเอกสาร และทุกแถวกดต่อไม่ได้เลย
 *
 * ตอนนี้อ่านจาก `DocumentAction` ซึ่งเป็นตารางที่ออกแบบมาเป็น "timeline ที่ผู้ใช้เห็น"
 * อยู่แล้ว · เรื่องของระบบและของผู้ดูแลมีบ้านอยู่ที่ /admin/audit ตามเดิม
 */
export async function getRecentActivity(ctx: ServiceContext, take = 5) {
  const visible = await documentVisibilityWhere(ctx)

  const rows = await prisma.documentAction.findMany({
    where: {
      actionType: { in: [...FEED_ACTIONS] },
      document: { AND: [visible, { deletedAt: null }] },
    },
    orderBy: { createdAt: "desc" },
    // ดึงมาเผื่อแล้วยุบให้เหลือฉบับละแถว — หนังสือฉบับหนึ่งขยับหลายจังหวะติดกันได้
    // (ส่งให้สารบรรณ → ออกเลข → เวียน) ถ้าไม่ยุบ ฉบับเดียวจะกินแผงทั้งแผง
    take: take * 4,
    include: {
      actorUser: { select: { prefix: true, firstName: true, lastName: true } },
      document: {
        select: {
          id: true,
          docNo: true,
          subject: true,
          status: true,
          confidentialityLevel: true,
        },
      },
    },
  })

  const latestPerDocument = rows.filter(
    (row, index) => rows.findIndex((other) => other.documentId === row.documentId) === index,
  )

  return latestPerDocument.slice(0, take).map((row) => ({
    id: row.id,
    documentId: row.documentId,
    actionType: row.actionType,
    at: row.createdAt,
    docNo: row.document.docNo,
    status: row.document.status,
    confidentialityLevel: row.document.confidentialityLevel,
    // ⚠️ ชื่อเรื่องของเอกสารชั้น 1–3 ห้ามหลุดมาที่นี่ — ด่านมองเห็นข้างบนกันคนที่ไม่มี
    // ACL ออกไปแล้วก็จริง แต่ใช้ safeSubject ซ้ำอีกชั้นเหมือนกระดิ่ง (§22.2) เพราะ
    // แผงนี้อยู่หน้าแรกที่คนเดินผ่านหลังจอเห็นได้ง่ายที่สุดในระบบ
    subject: safeSubject(row.document),
    actorName: row.actorUser
      ? `${row.actorUser.prefix ?? ""}${row.actorUser.firstName} ${row.actorUser.lastName}`.trim()
      : null,
  }))
}

/**
 * เหตุการณ์ที่ได้ขึ้นแผงนี้ — คัดเฉพาะ "สิ่งที่คนอื่นทำกับงานที่เราเกี่ยวข้อง"
 *
 * ตัด CREATED/UPDATED และการแนบไฟล์ออกโดยตั้งใจ: มันคือสิ่งที่เจ้าของเรื่องเพิ่งทำเอง
 * และมีปริมาณมากที่สุดในระบบ (บนฐาน dev รอบหนึ่ง CREATED มี 2,739 แถวจากทั้งหมด 11,887)
 * ถ้าปล่อยเข้ามา เหตุการณ์ที่ต้องรู้จริงอย่าง "ถูกตีกลับ" จะถูกดันตกขอบภายในไม่กี่นาที
 */
const FEED_ACTIONS = [
  "SUBMITTED",
  "NUMBER_ISSUED",
  "RETURNED",
  "CIRCULATED",
  "ACKNOWLEDGED",
  "MARKED_SENT",
  "FORWARDED",
  "CLOSED",
  "CANCELLED",
] as const satisfies readonly DocumentActionType[]

export type RecentActivityItem = Awaited<ReturnType<typeof getRecentActivity>>[number]
