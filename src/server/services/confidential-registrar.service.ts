import "server-only"

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, writeAudit } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/authz"
import { prisma } from "@/lib/db"

import type { ServiceContext } from "../context"
import { assertPermission, ServiceError } from "./errors"

/** ตัวเดียวกับที่ document.service ใช้ — งานออก ACL ต้องอยู่ในทรานแซกชันของผู้เรียกเสมอ */
type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// นายทะเบียนหนังสือลับของหน่วยงาน (ระเบียบว่าด้วยการรักษาความลับของทางราชการ 2544)
//
// ทำไมต้องมีตำแหน่งนี้ในระบบ: §4.3 ข้อ 5 บังคับว่าเอกสารชั้นความลับต้องมี ACL **ระบุตัวบุคคล**
// เจ้าหน้าที่สารบรรณที่กดออกเลขจึงต้องมีชื่ออยู่ในเอกสารฉบับนั้นก่อน ไม่งั้น can() ปฏิเสธ
// การให้ ACL แบบกลุ่มใช้แทนไม่ได้ (ด่านนั้นดูเฉพาะ ACL ที่ระบุตัวคน) และการโยน MANAGE
// ให้สารบรรณก็แรงเกินไป เพราะ MANAGE = ทำได้ทุกอย่างรวมถึงให้สิทธิ์คนอื่นต่อ
//
// ตั้งได้หลายคนต่อหน่วยงานโดยตั้งใจ — ของจริงต้องมีผู้ช่วยนายทะเบียนไว้ตอนคนหลักลา
// ไม่งั้นเอกสารลับทั้งหน่วยงานค้างคิวจนกว่าเขาจะกลับมา

export interface ConfidentialRegistrarRow {
  userId: string
  fullName: string
  username: string
  clearanceLevel: number
  assignedAt: Date
  assignedByName: string
}

export async function listConfidentialRegistrars(
  ctx: ServiceContext,
  orgUnitId: string,
): Promise<ConfidentialRegistrarRow[]> {
  assertPermission(ctx, PERMISSIONS.ORGUNIT_MANAGE)

  const rows = await prisma.confidentialRegistrar.findMany({
    where: { orgUnitId, orgUnit: { tenantId: ctx.tenantId } },
    orderBy: { assignedAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          prefix: true,
          firstName: true,
          lastName: true,
          username: true,
          clearanceLevel: true,
        },
      },
      assignedBy: { select: { prefix: true, firstName: true, lastName: true } },
    },
  })

  return rows.map((row) => ({
    userId: row.userId,
    fullName: fullName(row.user),
    username: row.user.username,
    clearanceLevel: row.user.clearanceLevel,
    assignedAt: row.assignedAt,
    assignedByName: fullName(row.assignedBy),
  }))
}

/**
 * ตั้งนายทะเบียนของหน่วยงานหนึ่งใหม่ทั้งชุด (แทนที่ของเดิม)
 *
 * รับเป็น "ชุดเต็ม" ไม่ใช่เพิ่ม/ลบทีละคน เพราะหน้าจัดการเป็นรายชื่อที่ผู้ดูแลเห็นทั้งหมด
 * อยู่แล้ว · การส่งชุดเต็มทำให้ไม่มีทางที่หน้าจอกับฐานข้อมูลจะไม่ตรงกันโดยไม่มีใครรู้
 */
export async function setConfidentialRegistrars(
  ctx: ServiceContext,
  orgUnitId: string,
  userIds: string[],
) {
  assertPermission(ctx, PERMISSIONS.ORGUNIT_MANAGE)

  const orgUnit = await prisma.orgUnit.findFirst({
    where: { id: orgUnitId, tenantId: ctx.tenantId },
    select: { id: true, code: true, nameTh: true },
  })

  if (!orgUnit) throw new ServiceError("ไม่พบหน่วยงานที่ระบุ", "NOT_FOUND")

  const unique = [...new Set(userIds)]

  const users = await prisma.user.findMany({
    where: { id: { in: unique }, tenantId: ctx.tenantId, isActive: true, deletedAt: null },
    select: { id: true, prefix: true, firstName: true, lastName: true, clearanceLevel: true },
  })

  if (users.length !== unique.length) {
    throw new ServiceError("มีผู้ใช้ที่เลือกไว้ถูกระงับหรือถูกลบไปแล้ว", "VALIDATION")
  }

  // ⚠️ ชั้นความลับ 0 เป็นนายทะเบียนหนังสือลับไม่ได้เลย — ตั้งไปก็แตะเอกสารลับไม่ได้สักฉบับ
  // แล้วหน่วยงานจะเข้าใจผิดว่าตั้งเรียบร้อยแล้ว จนกระทั่งมีคนส่งเอกสารลับเข้าคิวไม่ได้
  const noClearance = users.filter((user) => user.clearanceLevel < 1)

  if (noClearance.length > 0) {
    throw new ServiceError(
      `${noClearance.map(fullName).join(" · ")} มีชั้นความลับ 0 จึงเป็นนายทะเบียนหนังสือลับไม่ได้ — ต้องปรับชั้นความลับของผู้ใช้ก่อน`,
      "VALIDATION",
    )
  }

  return prisma.$transaction(async (tx) => {
    const before = await tx.confidentialRegistrar.findMany({
      where: { orgUnitId },
      select: { userId: true },
    })

    await tx.confidentialRegistrar.deleteMany({ where: { orgUnitId } })

    if (unique.length > 0) {
      await tx.confidentialRegistrar.createMany({
        data: unique.map((userId) => ({ orgUnitId, userId, assignedById: ctx.userId })),
      })
    }

    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      action: AUDIT_ACTIONS.ORGUNIT_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.ORG_UNIT,
      entityId: orgUnitId,
      actorUserId: ctx.userId,
      actorOrgUnitId: ctx.activeOrgUnitId,
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      // ใครดูแลทะเบียนหนังสือลับได้เป็นเรื่องที่ผู้ตรวจสอบต้องตามย้อนหลังได้เสมอ
      severity: "NOTICE",
      metadata: {
        change: "confidentialRegistrars",
        orgUnitCode: orgUnit.code,
        before: before.map((row) => row.userId),
        after: unique,
      },
    })

    return unique.length
  })
}

/**
 * นายทะเบียนของหน่วยงานที่ชั้นความลับถึงระดับของเอกสารฉบับนั้น
 *
 * คืนเฉพาะคนที่ "ทำงานกับเอกสารฉบับนี้ได้จริง" — คนที่ชั้นไม่ถึงไม่ถูกตัดชื่อออกจากตำแหน่ง
 * เขาแค่ไม่มีสิทธิ์กับเอกสารระดับนี้ ซึ่งเป็นเรื่องปกติของทะเบียนหนังสือลับ
 */
export async function eligibleRegistrars(
  tx: TransactionClient,
  orgUnitId: string,
  confidentialityLevel: number,
) {
  const rows = await tx.confidentialRegistrar.findMany({
    where: { orgUnitId },
    include: {
      user: {
        select: {
          id: true,
          prefix: true,
          firstName: true,
          lastName: true,
          clearanceLevel: true,
          isActive: true,
          deletedAt: true,
        },
      },
    },
  })

  const active = rows.filter((row) => row.user.isActive && row.user.deletedAt === null)

  return {
    all: active.map((row) => row.user),
    eligible: active
      .map((row) => row.user)
      .filter((user) => user.clearanceLevel >= confidentialityLevel),
  }
}

export function fullName(user: {
  prefix?: string | null
  firstName: string
  lastName: string
}): string {
  return `${user.prefix ?? ""}${user.firstName} ${user.lastName}`.trim()
}
