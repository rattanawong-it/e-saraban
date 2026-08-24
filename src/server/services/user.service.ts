import "server-only"

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, writeAudit } from "@/lib/audit"
import { generateTemporaryPassword, hashPassword, revokeAllSessions } from "@/lib/auth"
import { PERMISSIONS } from "@/lib/authz"
import { prisma } from "@/lib/db"
import type {
  AddAffiliationInput,
  CreateUserInput,
  ReviewRegistrationInput,
  UpdateUserInput,
} from "@/schemas/user.schema"

import type { ServiceContext } from "../context"
import { assertPermission, ServiceError } from "./errors"

// จัดการผู้ใช้และสังกัดหลายหน่วยงาน (spec §4.2 · §5.2)
//
// หลักที่ยึด: **Role ผูกกับคู่ (User, OrgUnit)** ไม่ใช่กับ User เดี่ยว
// ทุกครั้งที่เพิ่ม/ถอดสังกัด จึงต้องจัดการ UserRole ของหน่วยงานนั้นไปด้วยเสมอ

export interface UserListItem {
  id: string
  username: string
  prefix: string | null
  firstName: string
  lastName: string
  fullName: string
  initials: string
  email: string | null
  clearanceLevel: number
  isActive: boolean
  isLocked: boolean
  mustChangePassword: boolean
  lastLoginAt: Date | null
  hasPendingReset: boolean
  affiliations: {
    orgUnitId: string
    orgUnitName: string
    orgUnitShortName: string | null
    positionTitle: string | null
    isPrimary: boolean
    roleCodes: string[]
  }[]
}

export async function listUsers(
  ctx: ServiceContext,
  options: { query?: string; orgUnitId?: string; includeInactive?: boolean } = {},
): Promise<UserListItem[]> {
  assertPermission(ctx, PERMISSIONS.USER_MANAGE)

  const query = options.query?.trim()

  const users = await prisma.user.findMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      ...(options.includeInactive ? {} : { isActive: true }),
      ...(options.orgUnitId ? { orgUnits: { some: { orgUnitId: options.orgUnitId } } } : {}),
      ...(query
        ? {
            OR: [
              { username: { contains: query, mode: "insensitive" as const } },
              { firstName: { contains: query, mode: "insensitive" as const } },
              { lastName: { contains: query, mode: "insensitive" as const } },
              { email: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      orgUnits: {
        include: { orgUnit: { select: { id: true, nameTh: true, shortName: true } } },
        orderBy: [{ isPrimary: "desc" }],
      },
      roles: { include: { role: { select: { code: true } } } },
      resetRequests: { where: { status: "PENDING" }, select: { id: true } },
    },
    take: 300,
  })

  const now = new Date()

  return users.map((user) => {
    const rolesByUnit = new Map<string, string[]>()
    const globalRoles: string[] = []

    for (const userRole of user.roles) {
      if (userRole.orgUnitId) {
        const list = rolesByUnit.get(userRole.orgUnitId) ?? []
        list.push(userRole.role.code)
        rolesByUnit.set(userRole.orgUnitId, list)
      } else {
        globalRoles.push(userRole.role.code)
      }
    }

    return {
      id: user.id,
      username: user.username,
      prefix: user.prefix,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.prefix ?? ""}${user.firstName} ${user.lastName}`.trim(),
      initials: `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`,
      email: user.email,
      clearanceLevel: user.clearanceLevel,
      isActive: user.isActive,
      isLocked: Boolean(user.lockedUntil && user.lockedUntil > now),
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      hasPendingReset: user.resetRequests.length > 0,
      affiliations: user.orgUnits.map((membership) => ({
        orgUnitId: membership.orgUnitId,
        orgUnitName: membership.orgUnit.nameTh,
        orgUnitShortName: membership.orgUnit.shortName,
        positionTitle: membership.positionTitle,
        isPrimary: membership.isPrimary,
        roleCodes: [...(rolesByUnit.get(membership.orgUnitId) ?? []), ...globalRoles],
      })),
    }
  })
}

export async function createUser(ctx: ServiceContext, input: CreateUserInput) {
  assertPermission(ctx, PERMISSIONS.USER_MANAGE)

  const orgUnit = await prisma.orgUnit.findFirst({
    where: { id: input.orgUnitId, tenantId: ctx.tenantId, isActive: true },
  })

  if (!orgUnit) throw new ServiceError("ไม่พบหน่วยงานที่เลือก", "NOT_FOUND")

  const role = await prisma.role.findUnique({ where: { code: input.roleCode } })
  if (!role) throw new ServiceError("ไม่พบบทบาทที่เลือก", "NOT_FOUND")

  const existing = await prisma.user.findUnique({ where: { username: input.username } })
  if (existing) throw new ServiceError(`ชื่อผู้ใช้ "${input.username}" ถูกใช้ไปแล้ว`, "CONFLICT")

  const temporaryPassword = generateTemporaryPassword(12)
  const passwordHash = await hashPassword(temporaryPassword)

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        tenantId: ctx.tenantId,
        username: input.username,
        passwordHash,
        prefix: input.prefix || null,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email || null,
        clearanceLevel: input.clearanceLevel,
        mustChangePassword: true,
      },
    })

    await tx.userOrgUnit.create({
      data: {
        userId: created.id,
        orgUnitId: orgUnit.id,
        positionTitle: input.positionTitle || null,
        isPrimary: true,
      },
    })

    await tx.userRole.create({
      data: {
        userId: created.id,
        roleId: role.id,
        orgUnitId: orgUnit.id,
        grantedById: ctx.userId,
      },
    })

    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      action: AUDIT_ACTIONS.USER_CREATED,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: created.id,
      actorUserId: ctx.userId,
      actorOrgUnitId: ctx.activeOrgUnitId,
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      severity: "NOTICE",
      metadata: {
        username: created.username,
        orgUnitId: orgUnit.id,
        roleCode: role.code,
        clearanceLevel: created.clearanceLevel,
      },
    })

    return created
  })

  return { user, temporaryPassword }
}

export async function updateUser(ctx: ServiceContext, input: UpdateUserInput) {
  assertPermission(ctx, PERMISSIONS.USER_MANAGE)

  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findFirst({
      where: { id: input.id, tenantId: ctx.tenantId, deletedAt: null },
    })

    if (!before) throw new ServiceError("ไม่พบบัญชีผู้ใช้", "NOT_FOUND")

    const updated = await tx.user.update({
      where: { id: input.id },
      data: {
        prefix: input.prefix || null,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email || null,
        clearanceLevel: input.clearanceLevel,
      },
    })

    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      action: AUDIT_ACTIONS.USER_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: updated.id,
      actorUserId: ctx.userId,
      actorOrgUnitId: ctx.activeOrgUnitId,
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      severity: "NOTICE",
      metadata: {
        username: updated.username,
        before: { clearanceLevel: before.clearanceLevel, email: before.email },
        after: { clearanceLevel: updated.clearanceLevel, email: updated.email },
      },
    })

    // ชั้นความลับเปลี่ยนคือเหตุการณ์ที่ผู้ตรวจสอบต้องเห็นแยกจากการแก้ข้อมูลทั่วไป
    if (before.clearanceLevel !== updated.clearanceLevel) {
      await writeAudit(tx, {
        tenantId: ctx.tenantId,
        action: AUDIT_ACTIONS.USER_CLEARANCE_CHANGED,
        entityType: AUDIT_ENTITY_TYPES.USER,
        entityId: updated.id,
        actorUserId: ctx.userId,
        actorOrgUnitId: ctx.activeOrgUnitId,
        sessionId: ctx.sessionId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        severity: "CRITICAL",
        metadata: { from: before.clearanceLevel, to: updated.clearanceLevel },
      })
    }

    return updated
  })
}

export async function addAffiliation(ctx: ServiceContext, input: AddAffiliationInput) {
  assertPermission(ctx, PERMISSIONS.USER_MANAGE)

  const [user, orgUnit, role] = await Promise.all([
    prisma.user.findFirst({ where: { id: input.userId, tenantId: ctx.tenantId } }),
    prisma.orgUnit.findFirst({
      where: { id: input.orgUnitId, tenantId: ctx.tenantId, isActive: true },
    }),
    prisma.role.findUnique({ where: { code: input.roleCode } }),
  ])

  if (!user) throw new ServiceError("ไม่พบบัญชีผู้ใช้", "NOT_FOUND")
  if (!orgUnit) throw new ServiceError("ไม่พบหน่วยงานที่เลือก", "NOT_FOUND")
  if (!role) throw new ServiceError("ไม่พบบทบาทที่เลือก", "NOT_FOUND")

  const duplicate = await prisma.userOrgUnit.findUnique({
    where: { userId_orgUnitId: { userId: user.id, orgUnitId: orgUnit.id } },
  })

  if (duplicate) throw new ServiceError("ผู้ใช้สังกัดหน่วยงานนี้อยู่แล้ว", "CONFLICT")

  await prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.userOrgUnit.updateMany({
        where: { userId: user.id },
        data: { isPrimary: false },
      })
    }

    await tx.userOrgUnit.create({
      data: {
        userId: user.id,
        orgUnitId: orgUnit.id,
        positionTitle: input.positionTitle || null,
        isPrimary: input.isPrimary,
      },
    })

    await tx.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
        orgUnitId: orgUnit.id,
        grantedById: ctx.userId,
      },
    })

    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      action: AUDIT_ACTIONS.USER_AFFILIATION_ADDED,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: user.id,
      actorUserId: ctx.userId,
      actorOrgUnitId: ctx.activeOrgUnitId,
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      severity: "NOTICE",
      metadata: { orgUnitId: orgUnit.id, orgUnitName: orgUnit.nameTh, roleCode: role.code },
    })
  })
}

export async function removeAffiliation(
  ctx: ServiceContext,
  userId: string,
  orgUnitId: string,
): Promise<void> {
  assertPermission(ctx, PERMISSIONS.USER_MANAGE)

  const memberships = await prisma.userOrgUnit.findMany({ where: { userId } })

  if (memberships.length <= 1) {
    throw new ServiceError(
      "ถอดสังกัดสุดท้ายไม่ได้ — ผู้ใช้ต้องมีอย่างน้อยหนึ่งสังกัดเสมอ",
      "CONFLICT",
    )
  }

  const target = memberships.find((m) => m.orgUnitId === orgUnitId)
  if (!target) throw new ServiceError("ไม่พบสังกัดที่ระบุ", "NOT_FOUND")

  await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId, orgUnitId } })
    await tx.userOrgUnit.delete({ where: { id: target.id } })

    // ถ้าถอดสังกัดหลักออก ต้องเลื่อนสังกัดอื่นขึ้นเป็นหลักแทน
    if (target.isPrimary) {
      const next = memberships.find((m) => m.orgUnitId !== orgUnitId)
      if (next) {
        await tx.userOrgUnit.update({ where: { id: next.id }, data: { isPrimary: true } })
      }
    }

    // เซสชันที่ยังชี้หน่วยงานนี้อยู่ต้องถูกล้าง ไม่งั้นจะทำงานในนามหน่วยงานที่ไม่ได้สังกัดแล้ว
    await tx.session.updateMany({
      where: { userId, activeOrgUnitId: orgUnitId },
      data: { activeOrgUnitId: null },
    })

    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      action: AUDIT_ACTIONS.USER_AFFILIATION_REMOVED,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: userId,
      actorUserId: ctx.userId,
      actorOrgUnitId: ctx.activeOrgUnitId,
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      severity: "WARNING",
      metadata: { orgUnitId },
    })
  })
}

export async function setUserActive(
  ctx: ServiceContext,
  userId: string,
  isActive: boolean,
): Promise<void> {
  assertPermission(ctx, PERMISSIONS.USER_MANAGE)

  if (userId === ctx.userId && !isActive) {
    throw new ServiceError("ระงับบัญชีของตัวเองไม่ได้", "CONFLICT")
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: userId, tenantId: ctx.tenantId, deletedAt: null },
    })

    if (!user) throw new ServiceError("ไม่พบบัญชีผู้ใช้", "NOT_FOUND")

    await tx.user.update({
      where: { id: userId },
      data: { isActive, ...(isActive ? { failedLoginCount: 0, lockedUntil: null } : {}) },
    })

    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      action: isActive ? AUDIT_ACTIONS.USER_ACTIVATED : AUDIT_ACTIONS.USER_SUSPENDED,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: userId,
      actorUserId: ctx.userId,
      actorOrgUnitId: ctx.activeOrgUnitId,
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      severity: "WARNING",
      metadata: { username: user.username },
    })
  })

  // ระงับบัญชีแล้วต้องเตะออกจากระบบทันที ไม่ใช่รอเซสชันหมดอายุเอง
  if (!isActive) {
    await revokeAllSessions(userId)
  }
}

// ---------------------------------------------------------------------------
// คำขอสมัครใช้งาน
// ---------------------------------------------------------------------------

export async function listRegistrationRequests(ctx: ServiceContext) {
  assertPermission(ctx, PERMISSIONS.USER_MANAGE)

  return prisma.registrationRequest.findMany({
    where: { tenantId: ctx.tenantId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { orgUnit: { select: { id: true, nameTh: true, shortName: true } } },
  })
}

export async function listPendingResetRequests(ctx: ServiceContext) {
  assertPermission(ctx, PERMISSIONS.USER_MANAGE)

  return prisma.passwordResetRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, username: true, firstName: true, lastName: true } },
    },
    take: 100,
  })
}

/** อนุมัติ/ปฏิเสธคำขอสมัคร — อนุมัติแล้วจึงสร้าง User จริง */
export async function reviewRegistration(ctx: ServiceContext, input: ReviewRegistrationInput) {
  assertPermission(ctx, PERMISSIONS.USER_MANAGE)

  const request = await prisma.registrationRequest.findFirst({
    where: { id: input.requestId, tenantId: ctx.tenantId, status: "PENDING" },
  })

  if (!request) throw new ServiceError("ไม่พบคำขอที่ระบุ หรือคำขอถูกพิจารณาไปแล้ว", "NOT_FOUND")

  if (!input.approve) {
    await prisma.$transaction(async (tx) => {
      await tx.registrationRequest.update({
        where: { id: request.id },
        data: {
          status: "REJECTED",
          reviewedById: ctx.userId,
          reviewedAt: new Date(),
          rejectReason: input.rejectReason || null,
        },
      })

      await writeAudit(tx, {
        tenantId: ctx.tenantId,
        action: AUDIT_ACTIONS.REGISTRATION_REJECTED,
        entityType: AUDIT_ENTITY_TYPES.REGISTRATION,
        entityId: request.id,
        actorUserId: ctx.userId,
        actorOrgUnitId: ctx.activeOrgUnitId,
        sessionId: ctx.sessionId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        severity: "NOTICE",
        metadata: { username: request.username, reason: input.rejectReason ?? null },
      })
    })

    return { approved: false as const }
  }

  const role = await prisma.role.findUnique({ where: { code: input.roleCode ?? "USER" } })
  if (!role) throw new ServiceError("ไม่พบบทบาทที่เลือก", "NOT_FOUND")

  const taken = await prisma.user.findUnique({ where: { username: request.username } })
  if (taken) throw new ServiceError(`ชื่อผู้ใช้ "${request.username}" ถูกใช้ไปแล้ว`, "CONFLICT")

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        tenantId: request.tenantId,
        username: request.username,
        // ใช้รหัสผ่านที่ผู้สมัครตั้งเอง — บังคับเปลี่ยนทันทีที่ล็อกอินครั้งแรก
        passwordHash: request.passwordHash,
        prefix: request.prefix,
        firstName: request.firstName,
        lastName: request.lastName,
        email: request.email,
        clearanceLevel: 0,
        mustChangePassword: true,
      },
    })

    await tx.userOrgUnit.create({
      data: {
        userId: user.id,
        orgUnitId: request.orgUnitId,
        positionTitle: request.positionTitle,
        isPrimary: true,
      },
    })

    await tx.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
        orgUnitId: request.orgUnitId,
        grantedById: ctx.userId,
      },
    })

    await tx.registrationRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED", reviewedById: ctx.userId, reviewedAt: new Date() },
    })

    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      action: AUDIT_ACTIONS.REGISTRATION_APPROVED,
      entityType: AUDIT_ENTITY_TYPES.REGISTRATION,
      entityId: request.id,
      actorUserId: ctx.userId,
      actorOrgUnitId: ctx.activeOrgUnitId,
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      severity: "NOTICE",
      metadata: { username: user.username, createdUserId: user.id, roleCode: role.code },
    })
  })

  return { approved: true as const }
}
