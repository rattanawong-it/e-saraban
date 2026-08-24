import "server-only"

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, writeAudit } from "@/lib/audit"
import { PERMISSIONS, type PermissionScope } from "@/lib/authz"
import { prisma } from "@/lib/db"
import type { UpdateRolePermissionsInput } from "@/schemas/role.schema"

import type { ServiceContext } from "../context"
import { assertPermission, ServiceError } from "./errors"

// บทบาทและสิทธิ์ (spec §4.2 · หน้า /admin/roles)
//
// ตารางใน spec เป็นแค่ **ค่าตั้งต้น** — ผู้ดูแลระบบแก้ได้จริงผ่านหน้านี้
// การเปลี่ยนสิทธิ์ของบทบาทกระทบผู้ใช้ทุกคนที่ถือบทบาทนั้นทันที
// จึงบันทึก audit ระดับ CRITICAL เสมอ

export interface RoleWithPermissions {
  id: string
  code: string
  nameTh: string
  description: string | null
  isSystem: boolean
  userCount: number
  permissions: Record<string, PermissionScope>
}

export async function listRoles(ctx: ServiceContext): Promise<RoleWithPermissions[]> {
  assertPermission(ctx, PERMISSIONS.ROLE_MANAGE)

  const roles = await prisma.role.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      permissions: true,
      _count: { select: { userRoles: true } },
    },
  })

  return roles.map((role) => ({
    id: role.id,
    code: role.code,
    nameTh: role.nameTh,
    description: role.description,
    isSystem: role.isSystem,
    userCount: role._count.userRoles,
    permissions: Object.fromEntries(
      role.permissions.map((rp) => [rp.permissionCode, rp.scope]),
    ) as Record<string, PermissionScope>,
  }))
}

export async function listPermissions() {
  return prisma.permission.findMany({ orderBy: { sortOrder: "asc" } })
}

/** รายการบทบาทแบบย่อสำหรับ dropdown — ไม่ต้องมีสิทธิ์ role.manage */
export async function listRoleOptions() {
  return prisma.role.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, code: true, nameTh: true, description: true },
  })
}

export async function updateRolePermissions(
  ctx: ServiceContext,
  input: UpdateRolePermissionsInput,
) {
  assertPermission(ctx, PERMISSIONS.ROLE_MANAGE)

  return prisma.$transaction(async (tx) => {
    const role = await tx.role.findUnique({
      where: { id: input.roleId },
      include: { permissions: true },
    })

    if (!role) throw new ServiceError("ไม่พบบทบาทที่ระบุ", "NOT_FOUND")

    const validCodes = new Set((await tx.permission.findMany()).map((p) => p.code))
    const invalid = input.permissions.filter((p) => !validCodes.has(p.code))

    if (invalid.length > 0) {
      throw new ServiceError(`พบรหัสสิทธิ์ที่ไม่รู้จัก: ${invalid[0]?.code}`, "VALIDATION")
    }

    const before = Object.fromEntries(role.permissions.map((rp) => [rp.permissionCode, rp.scope]))

    // ลบทั้งชุดแล้วเขียนใหม่ — การถอดสิทธิ์ต้องมีผลจริง ไม่ใช่แค่เพิ่มของใหม่ทับ
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } })

    if (input.permissions.length > 0) {
      await tx.rolePermission.createMany({
        data: input.permissions.map((permission) => ({
          roleId: role.id,
          permissionCode: permission.code,
          scope: permission.scope,
        })),
      })
    }

    const after = Object.fromEntries(input.permissions.map((p) => [p.code, p.scope]))

    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      action: AUDIT_ACTIONS.ROLE_PERMISSIONS_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.ROLE,
      entityId: role.id,
      actorUserId: ctx.userId,
      actorOrgUnitId: ctx.activeOrgUnitId,
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      // เปลี่ยนสิทธิ์ของบทบาท = เปลี่ยนสิทธิ์ของทุกคนที่ถือบทบาทนั้นพร้อมกัน
      severity: "CRITICAL",
      metadata: { roleCode: role.code, before, after },
    })

    return role
  })
}

export async function updateRole(
  ctx: ServiceContext,
  input: { roleId: string; nameTh: string; description?: string },
) {
  assertPermission(ctx, PERMISSIONS.ROLE_MANAGE)

  return prisma.$transaction(async (tx) => {
    const role = await tx.role.findUnique({ where: { id: input.roleId } })
    if (!role) throw new ServiceError("ไม่พบบทบาทที่ระบุ", "NOT_FOUND")

    const updated = await tx.role.update({
      where: { id: role.id },
      data: { nameTh: input.nameTh, description: input.description || null },
    })

    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      action: AUDIT_ACTIONS.ROLE_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.ROLE,
      entityId: role.id,
      actorUserId: ctx.userId,
      actorOrgUnitId: ctx.activeOrgUnitId,
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      severity: "NOTICE",
      metadata: { roleCode: role.code, nameTh: updated.nameTh },
    })

    return updated
  })
}
