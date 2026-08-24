import "server-only"

import { createHash } from "node:crypto"

import type { AuditResult, AuditSeverity, Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"

import type { AuditAction, AuditEntityType } from "./actions"

// Audit log แบบ append-only + hash chain (spec §8.5)
//
// spec §11.3 ข้อ 5 บังคับว่า **audit ต้องเขียนใน transaction เดียวกับงานหลัก**
// → ไม่มีทางที่ action สำเร็จแต่ audit หาย
// ทุกฟังก์ชันที่นี่จึงรับ `tx` เป็นอาร์กิวเมนต์ ไม่ใช้ prisma ตรง ๆ

export type AuditTx = Prisma.TransactionClient

export interface AuditEntry {
  tenantId: string
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string | null

  actorUserId?: string | null
  actorOrgUnitId?: string | null
  sessionId?: string | null

  result?: AuditResult
  severity?: AuditSeverity
  ip?: string | null
  userAgent?: string | null

  /** ข้อมูลประกอบ เช่น ค่าก่อน/หลังการแก้ไข — ห้ามใส่รหัสผ่านหรือ token */
  metadata?: Prisma.InputJsonValue
}

/**
 * คำนวณ hash ของแถวหนึ่ง — `hash = SHA256(prevHash + payload)` ตาม spec §8.5
 *
 * payload ประกอบจากฟิลด์ที่ "เปลี่ยนแล้วต้องจับได้" เท่านั้น และเรียงลำดับคงที่
 * (ไม่ใช้ JSON.stringify ของทั้ง object เพราะลำดับ key ไม่การันตี)
 */
export function computeAuditHash(input: {
  prevHash: string | null
  seq: bigint
  tenantId: string
  at: Date
  actorUserId: string | null
  actorOrgUnitId: string | null
  action: string
  entityType: string
  entityId: string | null
  result: string
  severity: string
  ip: string | null
  sessionId: string | null
  metadata: unknown
}): string {
  const payload = [
    input.prevHash ?? "",
    input.seq.toString(),
    input.tenantId,
    input.at.toISOString(),
    input.actorUserId ?? "",
    input.actorOrgUnitId ?? "",
    input.action,
    input.entityType,
    input.entityId ?? "",
    input.result,
    input.severity,
    input.ip ?? "",
    input.sessionId ?? "",
    input.metadata === undefined || input.metadata === null ? "" : stableStringify(input.metadata),
  ].join("\u001f") // คั่นด้วย unit separator กันค่าสองฟิลด์ต่อกันแล้วตีความได้หลายแบบ

  return createHash("sha256").update(payload, "utf8").digest("hex")
}

/** JSON.stringify ที่เรียง key เสมอ — ทำให้ hash ของ metadata เดิมได้ค่าเดิมทุกครั้ง */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null"
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)

  return `{${entries.join(",")}}`
}

/**
 * เขียน audit log หนึ่งแถว **ภายใน transaction ที่ส่งเข้ามา**
 *
 * ล็อกด้วย advisory lock ระดับ transaction ต่อ tenant เพื่อให้ปลาย chain
 * ถูกอ่าน–ต่อ–เขียน แบบ serialize จริง ไม่งั้นสอง request พร้อมกันจะได้
 * `prevHash` ตัวเดียวกันแล้ว chain แตกเป็นสองสาย ซึ่งตรวจสอบย้อนหลังไม่ได้อีก
 */
export async function writeAudit(tx: AuditTx, entry: AuditEntry): Promise<void> {
  const lockKey = hashToInt(entry.tenantId)

  // ต้องใช้ $executeRaw ไม่ใช่ $queryRaw — pg_advisory_xact_lock() คืนค่า `void`
  // ซึ่ง driver adapter ของ Prisma 7 ถอดรหัสไม่ได้ ($queryRaw จะโยน UnsupportedNativeDataType)
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`

  const last = await tx.auditLog.findFirst({
    where: { tenantId: entry.tenantId },
    orderBy: { seq: "desc" },
    select: { seq: true, hash: true },
  })

  const seq = (last?.seq ?? 0n) + 1n
  const at = new Date()
  const result = entry.result ?? "ALLOW"
  const severity = entry.severity ?? "INFO"
  const metadata = entry.metadata ?? null

  const hash = computeAuditHash({
    prevHash: last?.hash ?? null,
    seq,
    tenantId: entry.tenantId,
    at,
    actorUserId: entry.actorUserId ?? null,
    actorOrgUnitId: entry.actorOrgUnitId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    result,
    severity,
    ip: entry.ip ?? null,
    sessionId: entry.sessionId ?? null,
    metadata,
  })

  await tx.auditLog.create({
    data: {
      tenantId: entry.tenantId,
      at,
      actorUserId: entry.actorUserId ?? null,
      actorOrgUnitId: entry.actorOrgUnitId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      result,
      severity,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
      sessionId: entry.sessionId ?? null,
      metadata: metadata === null ? undefined : metadata,
      prevHash: last?.hash ?? null,
      hash,
      seq,
    },
  })
}

/**
 * เขียน audit นอก transaction ของงานหลัก
 *
 * ใช้เฉพาะเหตุการณ์ที่ **ไม่มีงานหลักให้ผูกด้วย** เช่น login ล้มเหลว
 * หรือการเข้าถึงที่ถูกปฏิเสธ — กรณีอื่นให้ใช้ `writeAudit(tx, …)` เสมอ
 */
export async function writeAuditStandalone(entry: AuditEntry): Promise<void> {
  await prisma.$transaction((tx) => writeAudit(tx, entry))
}

/** แปลง string เป็น int64 สำหรับ pg_advisory_lock */
function hashToInt(value: string): bigint {
  const digest = createHash("sha256").update(value).digest()
  return digest.readBigInt64BE(0)
}

export interface ChainVerificationResult {
  valid: boolean
  checked: number
  /** แถวแรกที่พบว่าผิด — null เมื่อ chain สมบูรณ์ */
  brokenAt: { id: string; seq: string; reason: "HASH_MISMATCH" | "SEQ_GAP" } | null
  durationMs: number
}

/**
 * ตรวจความสมบูรณ์ของ hash chain ทั้ง tenant (spec §8.5 · หน้า /admin/audit)
 *
 * อ่านเป็นก้อนละ 1,000 แถวเพื่อไม่ให้กินหน่วยความจำเมื่อ log โตขึ้นหลักล้าน
 */
export async function verifyAuditChain(tenantId: string): Promise<ChainVerificationResult> {
  const startedAt = Date.now()
  const batchSize = 1000

  let cursorSeq = 0n
  let prevHash: string | null = null
  let expectedSeq = 1n
  let checked = 0

  for (;;) {
    const rows = await prisma.auditLog.findMany({
      where: { tenantId, seq: { gt: cursorSeq } },
      orderBy: { seq: "asc" },
      take: batchSize,
    })

    if (rows.length === 0) break

    for (const row of rows) {
      if (row.seq !== expectedSeq) {
        return {
          valid: false,
          checked,
          brokenAt: { id: row.id, seq: row.seq.toString(), reason: "SEQ_GAP" },
          durationMs: Date.now() - startedAt,
        }
      }

      const expectedHash = computeAuditHash({
        prevHash,
        seq: row.seq,
        tenantId: row.tenantId,
        at: row.at,
        actorUserId: row.actorUserId,
        actorOrgUnitId: row.actorOrgUnitId,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        result: row.result,
        severity: row.severity,
        ip: row.ip,
        sessionId: row.sessionId,
        metadata: row.metadata ?? null,
      })

      if (expectedHash !== row.hash || (row.prevHash ?? null) !== prevHash) {
        return {
          valid: false,
          checked,
          brokenAt: { id: row.id, seq: row.seq.toString(), reason: "HASH_MISMATCH" },
          durationMs: Date.now() - startedAt,
        }
      }

      prevHash = row.hash
      expectedSeq += 1n
      checked += 1
      cursorSeq = row.seq
    }

    if (rows.length < batchSize) break
  }

  return { valid: true, checked, brokenAt: null, durationMs: Date.now() - startedAt }
}
