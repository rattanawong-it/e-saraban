import "server-only"

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, writeAudit } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/authz"
import { prisma } from "@/lib/db"
import type {
  CreateOrgUnitInput,
  OrgUnitTypeValue,
  UpdateOrgUnitInput,
} from "@/schemas/org-unit.schema"

import type { ServiceContext } from "../context"
import { ServiceError, assertPermission } from "./errors"

// จัดการโครงสร้างหน่วยงาน (spec §5.1)
//
// Materialized path เก็บรูปแบบ "/<id>/<id>/" โดย **รวม id ของตัวเองไว้ท้ายสุด**
// ทำให้ query subtree เขียนได้ตรง ๆ ว่า `path LIKE '<path ของ node>%'`
// และ node ตัวเองก็ติดมาด้วย ซึ่งเป็นสิ่งที่ scope SUBTREE ต้องการพอดี
//
// ⚠️ ทุกครั้งที่ย้ายหน่วยงาน ต้องอัปเดต path ของ **ลูกหลานทั้งหมด**
//    ในทรานแซกชันเดียว ไม่งั้นสิทธิ์ SUBTREE จะคำนวณผิดทันที

export interface OrgUnitNode {
  id: string
  parentId: string | null
  path: string
  code: string
  nameTh: string
  shortName: string | null
  type: OrgUnitTypeValue
  level: number
  sortOrder: number
  isActive: boolean
  headUserId: string | null
  headName: string | null
  memberCount: number
  children: OrgUnitNode[]
}

/** โหลดผังทั้งองค์กรเป็นโครงต้นไม้ พร้อมจำนวนสมาชิกของแต่ละหน่วย */
export async function getOrgTree(
  ctx: ServiceContext,
  options: { includeArchived?: boolean } = {},
): Promise<OrgUnitNode[]> {
  const units = await prisma.orgUnit.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(options.includeArchived ? {} : { isActive: true }),
    },
    orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
    include: {
      head: { select: { prefix: true, firstName: true, lastName: true } },
      _count: { select: { members: true } },
    },
  })

  const nodes = new Map<string, OrgUnitNode>()

  for (const unit of units) {
    nodes.set(unit.id, {
      id: unit.id,
      parentId: unit.parentId,
      path: unit.path,
      code: unit.code,
      nameTh: unit.nameTh,
      shortName: unit.shortName,
      type: unit.type,
      level: unit.level,
      sortOrder: unit.sortOrder,
      isActive: unit.isActive,
      headUserId: unit.headUserId,
      headName: unit.head
        ? `${unit.head.prefix ?? ""}${unit.head.firstName} ${unit.head.lastName}`.trim()
        : null,
      memberCount: unit._count.members,
      children: [],
    })
  }

  const roots: OrgUnitNode[] = []

  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  return roots
}

/** รายการแบน ๆ สำหรับ dropdown — ใส่ระดับไว้ให้ UI เยื้องเองได้ */
export async function listOrgUnitsFlat(tenantId: string, includeArchived = false) {
  return prisma.orgUnit.findMany({
    where: { tenantId, ...(includeArchived ? {} : { isActive: true }) },
    orderBy: [{ path: "asc" }],
    select: {
      id: true,
      code: true,
      nameTh: true,
      shortName: true,
      level: true,
      parentId: true,
      isActive: true,
      path: true,
    },
  })
}

export async function getOrgUnitDetail(ctx: ServiceContext, id: string) {
  const unit = await prisma.orgUnit.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: {
      head: { select: { id: true, prefix: true, firstName: true, lastName: true } },
      parent: { select: { id: true, nameTh: true } },
      _count: { select: { members: true, children: true } },
    },
  })

  if (!unit) throw new ServiceError("ไม่พบหน่วยงานที่ระบุ", "NOT_FOUND")

  return unit
}

export async function createOrgUnit(ctx: ServiceContext, input: CreateOrgUnitInput) {
  assertPermission(ctx, PERMISSIONS.ORGUNIT_MANAGE)

  return prisma.$transaction(async (tx) => {
    const parent = input.parentId
      ? await tx.orgUnit.findFirst({ where: { id: input.parentId, tenantId: ctx.tenantId } })
      : null

    if (input.parentId && !parent) {
      throw new ServiceError("ไม่พบหน่วยงานแม่ที่เลือก", "NOT_FOUND")
    }

    const duplicate = await tx.orgUnit.findUnique({
      where: { tenantId_code: { tenantId: ctx.tenantId, code: input.code } },
    })

    if (duplicate) {
      throw new ServiceError(`รหัสหนังสือ "${input.code}" ถูกใช้ไปแล้ว`, "CONFLICT")
    }

    // สร้างก่อนเพื่อให้ได้ id แล้วค่อยเติม path ที่ต้องมี id ของตัวเองอยู่ท้าย
    const created = await tx.orgUnit.create({
      data: {
        tenantId: ctx.tenantId,
        parentId: parent?.id ?? null,
        path: "",
        code: input.code,
        nameTh: input.nameTh,
        shortName: input.shortName || null,
        type: input.type,
        level: parent ? parent.level + 1 : 0,
        sortOrder: input.sortOrder,
        headUserId: input.headUserId || null,
      },
    })

    const path = `${parent?.path ?? "/"}${created.id}/`
    const unit = await tx.orgUnit.update({ where: { id: created.id }, data: { path } })

    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      action: AUDIT_ACTIONS.ORGUNIT_CREATED,
      entityType: AUDIT_ENTITY_TYPES.ORG_UNIT,
      entityId: unit.id,
      actorUserId: ctx.userId,
      actorOrgUnitId: ctx.activeOrgUnitId,
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      severity: "NOTICE",
      metadata: { code: unit.code, nameTh: unit.nameTh, parentId: unit.parentId },
    })

    return unit
  })
}

export async function updateOrgUnit(ctx: ServiceContext, input: UpdateOrgUnitInput) {
  assertPermission(ctx, PERMISSIONS.ORGUNIT_MANAGE)

  return prisma.$transaction(async (tx) => {
    const before = await tx.orgUnit.findFirst({
      where: { id: input.id, tenantId: ctx.tenantId },
    })

    if (!before) throw new ServiceError("ไม่พบหน่วยงานที่ระบุ", "NOT_FOUND")

    if (before.code !== input.code) {
      const duplicate = await tx.orgUnit.findUnique({
        where: { tenantId_code: { tenantId: ctx.tenantId, code: input.code } },
      })
      if (duplicate) {
        throw new ServiceError(`รหัสหนังสือ "${input.code}" ถูกใช้ไปแล้ว`, "CONFLICT")
      }
    }

    const updated = await tx.orgUnit.update({
      where: { id: input.id },
      data: {
        code: input.code,
        nameTh: input.nameTh,
        shortName: input.shortName || null,
        type: input.type,
        sortOrder: input.sortOrder,
        headUserId: input.headUserId || null,
      },
    })

    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      action: AUDIT_ACTIONS.ORGUNIT_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.ORG_UNIT,
      entityId: updated.id,
      actorUserId: ctx.userId,
      actorOrgUnitId: ctx.activeOrgUnitId,
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      severity: "NOTICE",
      metadata: {
        before: { code: before.code, nameTh: before.nameTh, type: before.type },
        after: { code: updated.code, nameTh: updated.nameTh, type: updated.type },
      },
    })

    return updated
  })
}

/**
 * ย้ายหน่วยงานไปอยู่ใต้หน่วยงานอื่น
 *
 * อัปเดต `path` และ `level` ของทั้ง subtree ในทรานแซกชันเดียว
 * ใช้ SQL ตัวเดียวแทนการวนลูปในแอป เพราะ subtree อาจมีหลายร้อยแถว
 * และการวนลูปจะเปิดช่องให้ path ครึ่ง ๆ กลาง ๆ ถ้ามี error กลางทาง
 */
export async function moveOrgUnit(ctx: ServiceContext, id: string, newParentId: string | null) {
  assertPermission(ctx, PERMISSIONS.ORGUNIT_MANAGE)

  return prisma.$transaction(async (tx) => {
    const unit = await tx.orgUnit.findFirst({ where: { id, tenantId: ctx.tenantId } })
    if (!unit) throw new ServiceError("ไม่พบหน่วยงานที่ระบุ", "NOT_FOUND")

    const newParent = newParentId
      ? await tx.orgUnit.findFirst({ where: { id: newParentId, tenantId: ctx.tenantId } })
      : null

    if (newParentId && !newParent) {
      throw new ServiceError("ไม่พบหน่วยงานปลายทาง", "NOT_FOUND")
    }

    if (newParent && newParent.path.startsWith(unit.path)) {
      throw new ServiceError("ย้ายหน่วยงานไปอยู่ใต้หน่วยงานลูกของตัวเองไม่ได้", "CONFLICT")
    }

    if (unit.parentId === (newParent?.id ?? null)) {
      return unit
    }

    const oldPath = unit.path
    const newPath = `${newParent?.path ?? "/"}${unit.id}/`
    const levelDelta = (newParent ? newParent.level + 1 : 0) - unit.level

    // แทนที่ prefix เดิมด้วย prefix ใหม่ให้ทุกแถวใน subtree รวมตัวเอง
    await tx.$executeRaw`
      UPDATE "org_units"
      SET "path" = ${newPath} || SUBSTRING("path" FROM ${oldPath.length + 1}),
          "level" = "level" + ${levelDelta}
      WHERE "tenantId" = ${ctx.tenantId} AND "path" LIKE ${`${oldPath}%`}
    `

    const moved = await tx.orgUnit.update({
      where: { id: unit.id },
      data: { parentId: newParent?.id ?? null },
    })

    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      action: AUDIT_ACTIONS.ORGUNIT_MOVED,
      entityType: AUDIT_ENTITY_TYPES.ORG_UNIT,
      entityId: unit.id,
      actorUserId: ctx.userId,
      actorOrgUnitId: ctx.activeOrgUnitId,
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      severity: "WARNING",
      metadata: { oldPath, newPath, oldParentId: unit.parentId, newParentId: moved.parentId },
    })

    return moved
  })
}

/**
 * เก็บถาวร / นำกลับมาใช้
 *
 * spec §5.1: **ห้ามลบหน่วยงานที่มีเอกสารผูกอยู่** → ใช้ isActive = false เท่านั้น
 * ระบบนี้จึงไม่มีคำสั่งลบหน่วยงานเลย แม้แต่หน่วยงานที่ไม่มีอะไรผูกอยู่
 * เพื่อไม่ให้มีเส้นทางที่ทำให้ทะเบียนย้อนหลังอ้างถึงหน่วยงานที่หายไป
 */
export async function setOrgUnitActive(ctx: ServiceContext, id: string, isActive: boolean) {
  assertPermission(ctx, PERMISSIONS.ORGUNIT_MANAGE)

  return prisma.$transaction(async (tx) => {
    const unit = await tx.orgUnit.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { _count: { select: { children: true, members: true } } },
    })

    if (!unit) throw new ServiceError("ไม่พบหน่วยงานที่ระบุ", "NOT_FOUND")

    if (!isActive) {
      const activeChildren = await tx.orgUnit.count({
        where: { parentId: unit.id, isActive: true },
      })

      if (activeChildren > 0) {
        throw new ServiceError(
          "เก็บถาวรไม่ได้ — ยังมีหน่วยงานลูกที่ใช้งานอยู่ กรุณาเก็บถาวรหน่วยงานลูกก่อน",
          "CONFLICT",
        )
      }

      if (unit._count.members > 0) {
        throw new ServiceError(
          `เก็บถาวรไม่ได้ — ยังมีผู้ใช้สังกัดอยู่ ${unit._count.members} คน กรุณาย้ายสังกัดก่อน`,
          "CONFLICT",
        )
      }
    }

    const updated = await tx.orgUnit.update({ where: { id: unit.id }, data: { isActive } })

    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      action: isActive ? AUDIT_ACTIONS.ORGUNIT_RESTORED : AUDIT_ACTIONS.ORGUNIT_ARCHIVED,
      entityType: AUDIT_ENTITY_TYPES.ORG_UNIT,
      entityId: unit.id,
      actorUserId: ctx.userId,
      actorOrgUnitId: ctx.activeOrgUnitId,
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      severity: "WARNING",
      metadata: { code: unit.code, nameTh: unit.nameTh },
    })

    return updated
  })
}
