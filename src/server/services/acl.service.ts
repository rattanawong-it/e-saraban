import "server-only"

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, writeAudit } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/authz"
import { prisma } from "@/lib/db"
import { toAuthzResource } from "@/lib/documents/authz-resource"
import type { GrantAclInput } from "@/schemas/acl.schema"

import type { ServiceContext } from "../context"
import { assertPermission, ServiceError } from "./errors"

// สิทธิ์เฉพาะรายบนเอกสารหนึ่งฉบับ (spec §9.1)
//
// ทำไมต้องมี: §4.3 ข้อ 5 บังคับว่าเอกสารชั้นความลับต้องมี ACL ระบุตัวบุคคลเสมอ
// ห้าม inherit จาก scope · ระบบออก ACL ให้ผู้สร้างกับผู้รับอัตโนมัติอยู่แล้ว
// แต่ของจริงมีกรณีที่ต้องให้คนนอกวงเข้าถึงชั่วคราว (ผู้ตรวจสอบ · ที่ปรึกษา) และต้องถอนคืนได้
//
// ⚠️ ให้สิทธิ์ได้เฉพาะ **รายบุคคล** เท่านั้น ทั้งที่ schema รองรับ ORG_UNIT กับ ROLE ด้วย
// เพราะ ACL แบบกลุ่มไม่ช่วยให้เอกสารลับเปิดได้ (ด่าน §4.3 ข้อ 5 ดูเฉพาะ ACL ที่ระบุตัวคน)
// การเปิดช่องให้เลือกกลุ่มจึงมีแต่จะทำให้คนเข้าใจผิดว่าให้สิทธิ์แล้วทั้งที่ยังเปิดไม่ได้
//
// ใครให้สิทธิ์ได้: คนที่ผ่าน can(attachment.grant) บนเอกสารฉบับนั้น
// ในทางปฏิบัติแปลว่า **เอกสารลับต้องมี ACL ระดับ MANAGE ของตัวเองก่อน** (ผู้สร้างได้มาแต่แรก)
// จึงไม่มีทางที่คนนอกจะ "ให้สิทธิ์ตัวเอง" เข้าไปในเอกสารลับได้

export interface DocumentAclRow {
  id: string
  userId: string
  userName: string
  username: string
  permission: string
  effect: string
  reason: string | null
  grantedAt: Date
  grantedByName: string
  expiresAt: Date | null
  /** ระบบออกให้เองตอนสร้าง/เวียนเอกสาร — ไม่ใช่สิทธิ์ที่คนกดให้ */
  isAutomatic: boolean
  /** เจ้าของเรื่อง — ถอนสิทธิ์ไม่ได้ */
  isOwner: boolean
}

/** ผู้ที่ค้นเจอในช่องค้นหา พร้อมข้อมูลที่ต้องดูก่อนตัดสินใจให้สิทธิ์ */
export interface GranteeCandidate {
  id: string
  fullName: string
  username: string
  orgUnitName: string | null
  clearanceLevel: number
  /** ชั้นความลับพอสำหรับเอกสารฉบับนี้หรือไม่ */
  hasClearance: boolean
}

/** เหตุผลที่ระบบเขียนกำกับตอนออก ACL ให้เอง — document.service ใช้ค่าเดียวกันนี้ */
export const AUTOMATIC_ACL_REASON = "ระบบออกให้อัตโนมัติเมื่อเอกสารเป็นชั้นความลับ"

export async function listDocumentAcl(
  ctx: ServiceContext,
  documentId: string,
): Promise<DocumentAclRow[]> {
  const document = await loadDocument(ctx, documentId)

  // เห็นรายชื่อผู้มีสิทธิ์ได้เท่ากับที่เห็นตัวเอกสาร — ไม่ต้องมีสิทธิ์ให้สิทธิ์ก็ดูได้
  assertPermission(ctx, PERMISSIONS.DOCUMENT_READ, toAuthzResource(document))

  const rows = await prisma.documentAcl.findMany({
    where: { documentId },
    orderBy: [{ grantedAt: "asc" }],
    include: {
      grantedBy: { select: { prefix: true, firstName: true, lastName: true } },
    },
  })

  // ACL เก็บ principalId แบบไม่มี relation (เพราะชี้ได้ทั้ง user/unit/role) จึงต้องดึงชื่อเอง
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((row) => row.principalId) } },
    select: { id: true, prefix: true, firstName: true, lastName: true, username: true },
  })

  const byId = new Map(users.map((user) => [user.id, user]))

  return rows.map((row) => {
    const user = byId.get(row.principalId)

    return {
      id: row.id,
      userId: row.principalId,
      userName: user ? fullName(user) : "(ผู้ใช้ที่ถูกลบไปแล้ว)",
      username: user?.username ?? "-",
      permission: row.permission,
      effect: row.effect,
      reason: row.reason,
      grantedAt: row.grantedAt,
      grantedByName: fullName(row.grantedBy),
      expiresAt: row.expiresAt,
      isAutomatic: row.reason === AUTOMATIC_ACL_REASON,
      isOwner: row.principalId === document.createdById,
    }
  })
}

export async function searchGrantees(
  ctx: ServiceContext,
  documentId: string,
  query: string,
): Promise<GranteeCandidate[]> {
  const document = await loadDocument(ctx, documentId)

  // ต้องมีสิทธิ์ให้สิทธิ์ก่อนจึงจะค้นหาคนได้ — ไม่งั้นช่องนี้กลายเป็นสมุดรายชื่อทั้งองค์กร
  assertPermission(ctx, PERMISSIONS.ATTACHMENT_GRANT, toAuthzResource(document))

  const keyword = query.trim()
  if (keyword.length < 2) return []

  const users = await prisma.user.findMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      isActive: true,
      OR: [
        { firstName: { contains: keyword, mode: "insensitive" } },
        { lastName: { contains: keyword, mode: "insensitive" } },
        { username: { contains: keyword, mode: "insensitive" } },
      ],
    },
    orderBy: [{ firstName: "asc" }],
    take: 20,
    select: {
      id: true,
      prefix: true,
      firstName: true,
      lastName: true,
      username: true,
      clearanceLevel: true,
      orgUnits: {
        where: { isPrimary: true },
        take: 1,
        select: { orgUnit: { select: { nameTh: true } } },
      },
    },
  })

  return users.map((user) => ({
    id: user.id,
    fullName: fullName(user),
    username: user.username,
    orgUnitName: user.orgUnits[0]?.orgUnit.nameTh ?? null,
    clearanceLevel: user.clearanceLevel,
    hasClearance: user.clearanceLevel >= document.confidentialityLevel,
  }))
}

export async function grantDocumentAcl(ctx: ServiceContext, input: GrantAclInput) {
  const document = await loadDocument(ctx, input.documentId)

  assertPermission(ctx, PERMISSIONS.ATTACHMENT_GRANT, toAuthzResource(document))

  const grantee = await prisma.user.findFirst({
    where: { id: input.userId, tenantId: ctx.tenantId, deletedAt: null, isActive: true },
    select: { id: true, prefix: true, firstName: true, lastName: true, clearanceLevel: true },
  })

  if (!grantee) throw new ServiceError("ไม่พบผู้ใช้ที่เลือก หรือบัญชีถูกระงับไปแล้ว", "NOT_FOUND")

  // ⚠️ ให้สิทธิ์คนที่ชั้นความลับไม่ถึงไม่ได้ — can() จะปฏิเสธที่ด่าน CLEARANCE อยู่ดี
  // ถ้าปล่อยให้บันทึกได้ ผู้ให้จะเข้าใจว่าให้แล้ว ส่วนผู้รับก็ยังเปิดไม่ได้โดยไม่รู้สาเหตุ
  if (input.effect === "ALLOW" && grantee.clearanceLevel < document.confidentialityLevel) {
    throw new ServiceError(
      `${fullName(grantee)} มีชั้นความลับ ${grantee.clearanceLevel} ซึ่งต่ำกว่าชั้นของเอกสาร (${document.confidentialityLevel}) — ต้องปรับชั้นความลับของผู้ใช้ก่อน`,
      "VALIDATION",
    )
  }

  // ห้ามตัดเจ้าของเรื่องออกจากเอกสารของตัวเอง ไม่งั้นเอกสารลับจะไม่เหลือใครดูแลได้เลย
  if (input.effect === "DENY" && grantee.id === document.createdById) {
    throw new ServiceError("ห้ามสิทธิ์เจ้าของเรื่องไม่ได้", "VALIDATION")
  }

  if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) {
    throw new ServiceError("วันหมดอายุของสิทธิ์ต้องเป็นวันในอนาคต", "VALIDATION")
  }

  return prisma.$transaction(async (tx) => {
    const acl = await tx.documentAcl.upsert({
      where: {
        documentId_principalType_principalId_permission: {
          documentId: document.id,
          principalType: "USER",
          principalId: grantee.id,
          permission: input.permission,
        },
      },
      // ให้ซ้ำ = แก้ของเดิม ไม่ใช่เพิ่มแถวใหม่ (unique key กันไว้อยู่แล้ว)
      update: {
        effect: input.effect,
        expiresAt: input.expiresAt ?? null,
        reason: input.reason,
        grantedById: ctx.userId,
        grantedAt: new Date(),
      },
      create: {
        documentId: document.id,
        principalType: "USER",
        principalId: grantee.id,
        permission: input.permission,
        effect: input.effect,
        expiresAt: input.expiresAt ?? null,
        reason: input.reason,
        grantedById: ctx.userId,
      },
    })

    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      action: AUDIT_ACTIONS.DOCUMENT_ACL_GRANTED,
      entityType: AUDIT_ENTITY_TYPES.DOCUMENT,
      entityId: document.id,
      actorUserId: ctx.userId,
      actorOrgUnitId: ctx.activeOrgUnitId,
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      severity: "NOTICE",
      metadata: {
        grantedToUserId: grantee.id,
        permission: input.permission,
        effect: input.effect,
        expiresAt: input.expiresAt?.toISOString() ?? null,
        reason: input.reason,
        confidentialityLevel: document.confidentialityLevel,
        automatic: false,
      },
    })

    return acl
  })
}

export async function revokeDocumentAcl(ctx: ServiceContext, documentId: string, aclId: string) {
  const document = await loadDocument(ctx, documentId)

  assertPermission(ctx, PERMISSIONS.ATTACHMENT_GRANT, toAuthzResource(document))

  const acl = await prisma.documentAcl.findFirst({ where: { id: aclId, documentId: document.id } })

  if (!acl) throw new ServiceError("ไม่พบสิทธิ์ที่ระบุ", "NOT_FOUND")

  // ⚠️ เจ้าของเรื่องต้องเปิดเอกสารของตัวเองได้เสมอ — ถ้าถอนได้ เอกสารลับจะกลายเป็น
  // เอกสารที่ไม่มีใครแตะได้อีกเลย (ไม่มี ACL ก็ผ่านด่าน §4.3 ข้อ 5 ไม่ได้)
  if (acl.principalId === document.createdById && acl.effect === "ALLOW") {
    throw new ServiceError(
      "ถอนสิทธิ์ของเจ้าของเรื่องไม่ได้ — เอกสารจะไม่เหลือผู้ดูแล",
      "VALIDATION",
    )
  }

  return prisma.$transaction(async (tx) => {
    await tx.documentAcl.delete({ where: { id: acl.id } })

    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      action: AUDIT_ACTIONS.DOCUMENT_ACL_REVOKED,
      entityType: AUDIT_ENTITY_TYPES.DOCUMENT,
      entityId: document.id,
      actorUserId: ctx.userId,
      actorOrgUnitId: ctx.activeOrgUnitId,
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      severity: "NOTICE",
      metadata: {
        revokedFromUserId: acl.principalId,
        permission: acl.permission,
        effect: acl.effect,
        reason: acl.reason,
      },
    })

    return acl
  })
}

// ---------------------------------------------------------------------------
// ภายใน
// ---------------------------------------------------------------------------

async function loadDocument(ctx: ServiceContext, documentId: string) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, tenantId: ctx.tenantId, deletedAt: null },
    include: {
      ownerUnit: { select: { path: true } },
      recipients: { select: { orgUnitId: true, userId: true } },
      acls: {
        select: {
          principalType: true,
          principalId: true,
          permission: true,
          effect: true,
          expiresAt: true,
        },
      },
    },
  })

  if (!document) throw new ServiceError("ไม่พบเอกสารที่ระบุ", "NOT_FOUND")

  return document
}

function fullName(user: { prefix?: string | null; firstName: string; lastName: string }): string {
  return `${user.prefix ?? ""}${user.firstName} ${user.lastName}`.trim()
}
