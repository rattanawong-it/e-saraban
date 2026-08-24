import type { Metadata } from "next"

import { APP_NAME, USERS } from "@/constants"
import { PERMISSIONS } from "@/lib/authz"
import { UsersClient } from "@/components/admin/users-client"
import { PageHeader } from "@/components/ui/primitives"
import { listOrgUnitsFlat } from "@/server/services/org-unit.service"
import { listRoleOptions } from "@/server/services/role.service"
import {
  listPendingResetRequests,
  listRegistrationRequests,
  listUsers,
} from "@/server/services/user.service"
import { requirePermission } from "@/server/session"

export const metadata: Metadata = {
  title: `${USERS.title} · ${APP_NAME}`,
}

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const session = await requirePermission(PERMISSIONS.USER_MANAGE)
  const params = await searchParams

  const query = typeof params.q === "string" ? params.q : ""
  const showInactive = params.inactive === "1"

  const [users, orgUnits, roles, registrations, resets] = await Promise.all([
    listUsers(session.ctx, { query, includeInactive: showInactive }),
    listOrgUnitsFlat(session.ctx.tenantId),
    listRoleOptions(),
    listRegistrationRequests(session.ctx),
    listPendingResetRequests(session.ctx),
  ])

  return (
    <>
      <PageHeader title={USERS.title} description={USERS.description} />

      <UsersClient
        users={users.map((user) => ({
          ...user,
          // Date ส่งข้าม server → client ได้ แต่แปลงเป็น ISO ตั้งแต่ต้นทาง
          // เพื่อให้ชนิดข้อมูลของ props เป็น serializable ชัดเจน
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        }))}
        orgUnits={orgUnits.map((unit) => ({
          id: unit.id,
          nameTh: unit.nameTh,
          level: unit.level,
        }))}
        roles={roles.map((role) => ({ code: role.code, nameTh: role.nameTh }))}
        registrations={registrations.map((request) => ({
          id: request.id,
          fullName: `${request.prefix ?? ""}${request.firstName} ${request.lastName}`.trim(),
          username: request.username,
          email: request.email,
          orgUnitName: request.orgUnit.nameTh,
          positionTitle: request.positionTitle,
          note: request.note,
          createdAt: request.createdAt.toISOString(),
        }))}
        resets={resets.map((reset) => ({
          id: reset.id,
          email: reset.email,
          userId: reset.userId,
          userFullName: reset.user ? `${reset.user.firstName} ${reset.user.lastName}`.trim() : null,
          createdAt: reset.createdAt.toISOString(),
        }))}
        query={query}
        showInactive={showInactive}
      />
    </>
  )
}
