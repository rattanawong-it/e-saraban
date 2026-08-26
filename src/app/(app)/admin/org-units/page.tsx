import type { Metadata } from "next"

import { APP_NAME, ORG_UNITS } from "@/constants"
import { PERMISSIONS } from "@/lib/authz"
import { formatThaiDate } from "@/lib/thai"
import { prisma } from "@/lib/db"
import {
  OrgUnitsClient,
  type OrgUnitNodeView,
  type RegistrarView,
} from "@/components/admin/org-units-client"
import { PageHeader } from "@/components/ui/primitives"
import { getOrgTree, listOrgUnitsFlat, type OrgUnitNode } from "@/server/services/org-unit.service"
import { requirePermission } from "@/server/session"

export const metadata: Metadata = {
  title: `${ORG_UNITS.title} · ${APP_NAME}`,
}

export default async function OrgUnitsPage({ searchParams }: PageProps<"/admin/org-units">) {
  const session = await requirePermission(PERMISSIONS.ORGUNIT_MANAGE)
  const params = await searchParams
  const showArchived = params.archived === "1"

  const [tree, flat, users, registrars] = await Promise.all([
    getOrgTree(session.ctx, { includeArchived: showArchived }),
    listOrgUnitsFlat(session.ctx.tenantId, showArchived),
    prisma.user.findMany({
      where: { tenantId: session.ctx.tenantId, isActive: true, deletedAt: null },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, prefix: true, firstName: true, lastName: true, clearanceLevel: true },
    }),
    // นายทะเบียนหนังสือลับทั้ง tenant ทีเดียว — มีไม่กี่แถวต่อหน่วยงาน ถูกกว่าไล่ query ทีละหน่วย
    prisma.confidentialRegistrar.findMany({
      where: { orgUnit: { tenantId: session.ctx.tenantId } },
      orderBy: { assignedAt: "asc" },
      include: {
        user: {
          select: { id: true, prefix: true, firstName: true, lastName: true, clearanceLevel: true },
        },
        assignedBy: { select: { prefix: true, firstName: true, lastName: true } },
      },
    }),
  ])

  const registrarsByUnit: Record<string, RegistrarView[]> = {}

  for (const row of registrars) {
    const list = registrarsByUnit[row.orgUnitId] ?? []

    list.push({
      userId: row.userId,
      fullName: fullName(row.user),
      clearanceLevel: row.user.clearanceLevel,
      assignedByName: fullName(row.assignedBy),
      assignedAt: formatThaiDate(row.assignedAt),
    })

    registrarsByUnit[row.orgUnitId] = list
  }

  return (
    <>
      <PageHeader title={ORG_UNITS.title} description={ORG_UNITS.description} />

      <OrgUnitsClient
        tree={tree.map(toView)}
        flat={flat.map((unit) => ({
          id: unit.id,
          nameTh: unit.nameTh,
          level: unit.level,
          path: unit.path,
        }))}
        users={users.map((user) => ({
          id: user.id,
          fullName: fullName(user),
          clearanceLevel: user.clearanceLevel,
        }))}
        registrars={registrarsByUnit}
        showArchived={showArchived}
      />
    </>
  )
}

/** เติม childCount ที่ฝั่ง service ไม่ได้คำนวณไว้ — นับจากลูกที่โหลดมาจริง */
function toView(node: OrgUnitNode): OrgUnitNodeView {
  return {
    id: node.id,
    parentId: node.parentId,
    path: node.path,
    code: node.code,
    nameTh: node.nameTh,
    shortName: node.shortName,
    type: node.type,
    level: node.level,
    sortOrder: node.sortOrder,
    isActive: node.isActive,
    canIssueNumber: node.canIssueNumber,
    headName: node.headName,
    headUserId: node.headUserId,
    memberCount: node.memberCount,
    childCount: node.children.length,
    children: node.children.map(toView),
  }
}

function fullName(user: { prefix?: string | null; firstName: string; lastName: string }): string {
  return `${user.prefix ?? ""}${user.firstName} ${user.lastName}`.trim()
}
