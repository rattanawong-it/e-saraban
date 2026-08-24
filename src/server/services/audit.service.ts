import "server-only"

import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  verifyAuditChain,
  writeAuditStandalone,
  type ChainVerificationResult,
} from "@/lib/audit"
import { PERMISSIONS } from "@/lib/authz"
import { prisma } from "@/lib/db"
import type { AuditResult, AuditSeverity, Prisma } from "@/generated/prisma/client"

import type { ServiceContext } from "../context"
import { assertPermission } from "./errors"

// หน้าตรวจสอบ audit log (spec §8.5 · หน้า /admin/audit)
//
// ขอบเขตข้อมูลที่เห็นขึ้นกับ scope ของสิทธิ์ `audit.read`:
//   ORG     → เห็นทั้งองค์กร
//   SUBTREE → เห็นเฉพาะการกระทำที่เกิดในหน่วยงานตนและลูกหลาน
//   UNIT    → เห็นเฉพาะหน่วยงานปัจจุบัน

export interface AuditFilter {
  action?: string
  entityType?: string
  entityId?: string
  actorUserId?: string
  result?: AuditResult
  severity?: AuditSeverity
  from?: Date
  to?: Date
  page?: number
  pageSize?: number
}

export interface AuditRow {
  id: string
  at: Date
  action: string
  entityType: string
  entityId: string | null
  result: AuditResult
  severity: AuditSeverity
  ip: string | null
  actorName: string | null
  actorUsername: string | null
  actorOrgUnitName: string | null
  metadata: Prisma.JsonValue | null
}

export interface AuditPage {
  rows: AuditRow[]
  total: number
  page: number
  pageSize: number
}

export async function listAuditLogs(
  ctx: ServiceContext,
  filter: AuditFilter = {},
): Promise<AuditPage> {
  assertPermission(ctx, PERMISSIONS.AUDIT_READ)

  const page = Math.max(filter.page ?? 1, 1)
  const pageSize = Math.min(filter.pageSize ?? 50, 200)

  const where: Prisma.AuditLogWhereInput = {
    tenantId: ctx.tenantId,
    ...(filter.action ? { action: filter.action } : {}),
    ...(filter.entityType ? { entityType: filter.entityType } : {}),
    ...(filter.entityId ? { entityId: filter.entityId } : {}),
    ...(filter.actorUserId ? { actorUserId: filter.actorUserId } : {}),
    ...(filter.result ? { result: filter.result } : {}),
    ...(filter.severity ? { severity: filter.severity } : {}),
    ...(filter.from || filter.to
      ? {
          at: {
            ...(filter.from ? { gte: filter.from } : {}),
            ...(filter.to ? { lte: filter.to } : {}),
          },
        }
      : {}),
    ...(await buildScopeFilter(ctx)),
  }

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        actor: { select: { username: true, prefix: true, firstName: true, lastName: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ])

  const unitIds = [...new Set(rows.map((row) => row.actorOrgUnitId).filter(Boolean))] as string[]
  const units = unitIds.length
    ? await prisma.orgUnit.findMany({
        where: { id: { in: unitIds } },
        select: { id: true, nameTh: true, shortName: true },
      })
    : []
  const unitById = new Map(units.map((unit) => [unit.id, unit]))

  return {
    rows: rows.map((row) => ({
      id: row.id,
      at: row.at,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      result: row.result,
      severity: row.severity,
      ip: row.ip,
      actorName: row.actor
        ? `${row.actor.prefix ?? ""}${row.actor.firstName} ${row.actor.lastName}`.trim()
        : null,
      actorUsername: row.actor?.username ?? null,
      actorOrgUnitName: row.actorOrgUnitId
        ? (unitById.get(row.actorOrgUnitId)?.shortName ??
          unitById.get(row.actorOrgUnitId)?.nameTh ??
          null)
        : null,
      metadata: row.metadata,
    })),
    total,
    page,
    pageSize,
  }
}

/**
 * จำกัดขอบเขตตาม scope ของสิทธิ์ audit.read
 *
 * ต้องแปลง scope เป็นเงื่อนไข SQL ที่นี่ — ปล่อยให้ `can()` ตรวจทีละแถว
 * หลังดึงข้อมูลมาแล้วจะช้าและ pagination จะเพี้ยน (จำนวนหน้าไม่ตรงกับที่เห็นจริง)
 */
async function buildScopeFilter(ctx: ServiceContext): Promise<Prisma.AuditLogWhereInput> {
  const scope = ctx.permissions[PERMISSIONS.AUDIT_READ]

  if (scope === "ORG") return {}

  if (scope === "SUBTREE" && ctx.activeOrgUnitPath) {
    const subtree = await prisma.orgUnit.findMany({
      where: { tenantId: ctx.tenantId, path: { startsWith: ctx.activeOrgUnitPath } },
      select: { id: true },
    })

    return { actorOrgUnitId: { in: subtree.map((unit) => unit.id) } }
  }

  if (scope === "UNIT" && ctx.activeOrgUnitId) {
    return { actorOrgUnitId: ctx.activeOrgUnitId }
  }

  // OWN หรือไม่มี context หน่วยงาน — เห็นได้เฉพาะการกระทำของตนเอง
  return { actorUserId: ctx.userId }
}

/** ตรวจความสมบูรณ์ของ hash chain แล้วบันทึกผลลง audit ด้วย */
export async function runChainVerification(ctx: ServiceContext): Promise<ChainVerificationResult> {
  assertPermission(ctx, PERMISSIONS.AUDIT_READ)

  const result = await verifyAuditChain(ctx.tenantId)

  await writeAuditStandalone({
    tenantId: ctx.tenantId,
    action: AUDIT_ACTIONS.AUDIT_CHAIN_VERIFIED,
    entityType: AUDIT_ENTITY_TYPES.AUDIT,
    actorUserId: ctx.userId,
    actorOrgUnitId: ctx.activeOrgUnitId,
    sessionId: ctx.sessionId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    result: result.valid ? "ALLOW" : "DENY",
    severity: result.valid ? "NOTICE" : "CRITICAL",
    metadata: {
      valid: result.valid,
      checked: result.checked,
      brokenAt: result.brokenAt ?? null,
      durationMs: result.durationMs,
    },
  })

  return result
}

/** ส่งออกเป็น CSV — ใช้กับ filter เดียวกับที่หน้าจอกำลังดูอยู่ */
export async function exportAuditCsv(ctx: ServiceContext, filter: AuditFilter): Promise<string> {
  assertPermission(ctx, PERMISSIONS.AUDIT_READ)

  const page = await listAuditLogs(ctx, { ...filter, page: 1, pageSize: 200 })

  const header = [
    "เวลา",
    "ผู้กระทำ",
    "ชื่อผู้ใช้",
    "หน่วยงาน",
    "การกระทำ",
    "ประเภทรายการ",
    "รหัสรายการ",
    "ผลลัพธ์",
    "ความรุนแรง",
    "IP",
  ]

  const lines = [header.map(csvCell).join(",")]

  for (const row of page.rows) {
    lines.push(
      [
        row.at.toISOString(),
        row.actorName ?? "",
        row.actorUsername ?? "",
        row.actorOrgUnitName ?? "",
        row.action,
        row.entityType,
        row.entityId ?? "",
        row.result,
        row.severity,
        row.ip ?? "",
      ]
        .map(csvCell)
        .join(","),
    )
  }

  await writeAuditStandalone({
    tenantId: ctx.tenantId,
    action: AUDIT_ACTIONS.AUDIT_EXPORTED,
    entityType: AUDIT_ENTITY_TYPES.AUDIT,
    actorUserId: ctx.userId,
    actorOrgUnitId: ctx.activeOrgUnitId,
    sessionId: ctx.sessionId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    severity: "NOTICE",
    metadata: { rows: page.rows.length, filter: JSON.parse(JSON.stringify(filter)) },
  })

  // BOM ให้ Excel รู้ว่าเป็น UTF-8 ไม่งั้นภาษาไทยจะเป็นตัวยึกยือ (spec §13 P4 DoD)
  return `﻿${lines.join("\r\n")}`
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}
