import "server-only"

import { canOrFalse, PERMISSIONS } from "@/lib/authz"
import { prisma } from "@/lib/db"

import type { ServiceContext } from "../context"

// ข้อมูลหน้า /dashboard สำหรับเฟส P1
//
// ⚠️ สถิติฝั่งเอกสาร (หนังสือรอออกเลข · เอกสารล่าสุด · งานค้าง) ยังทำไม่ได้
// เพราะโมเดล Document จะมาใน P2 — หน้าจึงแสดงสถิติฝั่ง Identity & Org ไปก่อน
// และมีการ์ดบอกสถานะของโมดูลเอกสารไว้ตรง ๆ ไม่ใช่ตัวเลขปลอม

export interface DashboardStats {
  orgUnitCount: number
  activeUserCount: number
  myAffiliationCount: number
  pendingRegistrationCount: number
  pendingResetCount: number
  auditTodayCount: number
  deniedTodayCount: number
  lockedUserCount: number
  canManageUsers: boolean
  canReadAudit: boolean
}

export async function getDashboardStats(ctx: ServiceContext): Promise<DashboardStats> {
  const canManageUsers = canOrFalse(ctx, PERMISSIONS.USER_MANAGE)
  const canReadAudit = canOrFalse(ctx, PERMISSIONS.AUDIT_READ)

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const [
    orgUnitCount,
    activeUserCount,
    myAffiliationCount,
    pendingRegistrationCount,
    pendingResetCount,
    auditTodayCount,
    deniedTodayCount,
    lockedUserCount,
  ] = await Promise.all([
    prisma.orgUnit.count({ where: { tenantId: ctx.tenantId, isActive: true } }),
    prisma.user.count({ where: { tenantId: ctx.tenantId, isActive: true, deletedAt: null } }),
    prisma.userOrgUnit.count({ where: { userId: ctx.userId } }),
    canManageUsers
      ? prisma.registrationRequest.count({ where: { tenantId: ctx.tenantId, status: "PENDING" } })
      : Promise.resolve(0),
    canManageUsers
      ? prisma.passwordResetRequest.count({ where: { status: "PENDING" } })
      : Promise.resolve(0),
    canReadAudit
      ? prisma.auditLog.count({ where: { tenantId: ctx.tenantId, at: { gte: startOfToday } } })
      : Promise.resolve(0),
    canReadAudit
      ? prisma.auditLog.count({
          where: { tenantId: ctx.tenantId, at: { gte: startOfToday }, result: "DENY" },
        })
      : Promise.resolve(0),
    canManageUsers
      ? prisma.user.count({
          where: { tenantId: ctx.tenantId, lockedUntil: { gt: new Date() }, deletedAt: null },
        })
      : Promise.resolve(0),
  ])

  return {
    orgUnitCount,
    activeUserCount,
    myAffiliationCount,
    pendingRegistrationCount,
    pendingResetCount,
    auditTodayCount,
    deniedTodayCount,
    lockedUserCount,
    canManageUsers,
    canReadAudit,
  }
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
