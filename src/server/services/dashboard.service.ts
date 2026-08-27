import "server-only"

import { canOrFalse, PERMISSIONS } from "@/lib/authz"
import { prisma } from "@/lib/db"

import type { ServiceContext } from "../context"
import { documentVisibilityWhere } from "./document-visibility"

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

/** กิจกรรมล่าสุดที่ผู้ใช้คนนี้มีสิทธิ์เห็น — ใช้แทน "เอกสารล่าสุด" ในเฟส P1 */
export async function getRecentActivity(ctx: ServiceContext, take = 8) {
  if (!canOrFalse(ctx, PERMISSIONS.AUDIT_READ)) {
    return prisma.auditLog.findMany({
      where: { tenantId: ctx.tenantId, actorUserId: ctx.userId },
      orderBy: { at: "desc" },
      take,
      include: { actor: { select: { prefix: true, firstName: true, lastName: true } } },
    })
  }

  return prisma.auditLog.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { at: "desc" },
    take,
    include: { actor: { select: { prefix: true, firstName: true, lastName: true } } },
  })
}
