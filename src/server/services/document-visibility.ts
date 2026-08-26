import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { PERMISSIONS } from "@/lib/authz"
import { prisma } from "@/lib/db"

import type { ServiceContext } from "../context"

// ขอบเขตเอกสารที่ผู้ใช้คนหนึ่งมองเห็นได้ (spec §4.3)
//
// ⚠️ **ต้องมีที่เดียว** ทุกหน้าที่ list เอกสาร (กล่องเอกสาร · ค้นหา · ทะเบียน · รายงาน)
// ต้องเรียกตัวนี้ ห้ามเขียนเงื่อนไขขอบเขตขึ้นมาเองซ้ำ เพราะถ้าเขียนซ้ำแล้วพลาดที่ใดที่หนึ่ง
// เส้นทางนั้นจะรั่วเงียบ ๆ โดยที่หน้าอื่นยังถูกต้องอยู่ — จับได้ยากมาก
//
// เงื่อนไขที่คืนออกไปต้องถูกต่อด้วย `AND` เสมอ ห้าม spread รวมกับเงื่อนไขอื่น
// (บทเรียนจาก §20 ข้อ 1: คีย์ `OR` ของด่านสิทธิ์ถูก `OR` ของคำค้นเขียนทับจนด่านหายทั้งด่าน)
//
// ประกอบจากสองด่านที่ **คนละเรื่องกัน** และต้องผ่านทั้งคู่
//   1. `scopeWhere`        — ขอบเขตหน่วยงานตาม scope ของสิทธิ์ `document.read`
//   2. `confidentialWhere` — ชั้นความลับ + ACL รายบุคคล ซึ่งใช้ได้กับ **ทุก** รายการ
//      แม้แต่กล่องที่นิยามแคบอยู่แล้วอย่างร่างของฉัน/กล่องรับ

export async function documentVisibilityWhere(
  ctx: ServiceContext,
): Promise<Prisma.DocumentWhereInput> {
  return { AND: [await scopeWhere(ctx), confidentialWhere(ctx)] }
}

/**
 * ด่านชั้นความลับสำหรับ "รายการ" — คู่ขนานกับด่านที่ `can()` ใช้ตอนเปิดเอกสารรายฉบับ
 *
 * ⚠️ ก่อนหน้านี้ด่านนี้มีแค่ตอนกดเปิดเอกสาร (`can()` + `assertClearance()`) การ list
 * จึงคืนชื่อเรื่องของเอกสารลับให้คนที่เปิดมันไม่ได้ · **ชื่อเรื่องของหนังสือราชการลับ
 * คือตัวความลับเอง** ("ผลการสอบสวนทางวินัยของ…") และหน้าค้นหาที่ค้นถึง `summary` ด้วย
 * ทำให้เดาคำทีละคำจนยืนยันเนื้อหาได้โดยไม่ต้องเปิดไฟล์สักครั้ง
 *
 * เงื่อนไขต้องสะท้อน `can()` ให้ตรง (`src/lib/authz/can.ts`)
 *   · ชั้น 0 — ผ่านตามขอบเขตปกติ
 *   · ชั้น 1–3 — ต้องมีชั้นความลับถึง **และ** มี ACL รายบุคคลที่ยังไม่หมดอายุ (§4.3 ข้อ 5)
 *   · DENY ที่ระบุตัวเรา — ตัดออกทุกชั้น เพราะห้ามคนหนึ่งจากเอกสารฉบับหนึ่งคือห้ามทั้งฉบับ
 *
 * ไม่ต้องกรองว่า ACL เป็นสิทธิ์ชนิดไหน เพราะทั้งสี่ชนิด (VIEW/DOWNLOAD/EDIT/MANAGE)
 * ครอบคลุม `document.read` หมดอยู่แล้วตาม `ACL_COVERAGE`
 */
export function confidentialWhere(ctx: ServiceContext): Prisma.DocumentWhereInput {
  const now = new Date()
  const unexpired = { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }

  return {
    AND: [
      {
        OR: [
          { confidentialityLevel: { lte: 0 } },
          {
            confidentialityLevel: { lte: ctx.clearanceLevel },
            acls: {
              some: {
                principalType: "USER",
                principalId: ctx.userId,
                effect: "ALLOW",
                ...unexpired,
              },
            },
          },
        ],
      },
      {
        acls: {
          none: {
            principalType: "USER",
            principalId: ctx.userId,
            effect: "DENY",
            ...unexpired,
          },
        },
      },
    ],
  }
}

async function scopeWhere(ctx: ServiceContext): Promise<Prisma.DocumentWhereInput> {
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

  // OWN — เห็นเฉพาะที่ตัวเองสร้าง หรือที่เวียนมาถึงตัวเอง/หน่วยงานที่สังกัด
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

/** id ของหน่วยงานตัวเองและลูกหลานทั้งหมด — ใช้ตอนผู้ใช้เลือกกรองตามหน่วยงาน */
export async function subtreeUnitIds(tenantId: string, unitId: string): Promise<string[]> {
  const unit = await prisma.orgUnit.findFirst({
    where: { id: unitId, tenantId },
    select: { path: true },
  })

  if (!unit) return [unitId]

  const units = await prisma.orgUnit.findMany({
    where: { tenantId, path: { startsWith: unit.path } },
    select: { id: true },
  })

  return units.map((row) => row.id)
}
