import type { Metadata } from "next"

import { APP_NAME, ROLES } from "@/constants"
import { PERMISSIONS } from "@/lib/authz"
import { RolesClient } from "@/components/admin/roles-client"
import { PageHeader } from "@/components/ui/primitives"
import { listPermissions, listRoles } from "@/server/services/role.service"
import { requirePermission } from "@/server/session"

export const metadata: Metadata = {
  title: `${ROLES.title} · ${APP_NAME}`,
}

export default async function RolesPage() {
  const session = await requirePermission(PERMISSIONS.ROLE_MANAGE)

  const [roles, permissions] = await Promise.all([listRoles(session.ctx), listPermissions()])

  return (
    <>
      <PageHeader title={ROLES.title} description={ROLES.description} />

      <RolesClient
        roles={roles}
        permissions={permissions.map((permission) => ({
          code: permission.code,
          group: permission.group,
          nameTh: permission.nameTh,
          description: permission.description,
        }))}
      />
    </>
  )
}
