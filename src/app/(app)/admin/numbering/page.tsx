import type { Metadata } from "next"

import { APP_NAME, NUMBERING } from "@/constants"
import { PERMISSIONS } from "@/lib/authz"
import { NumberingClient } from "@/components/admin/numbering-client"
import { PageHeader } from "@/components/ui/primitives"
import { readNumberingConfig } from "@/server/services/numbering.service"
import { requirePermission } from "@/server/session"

export const metadata: Metadata = {
  title: `${NUMBERING.title} · ${APP_NAME}`,
}

export default async function NumberingPage() {
  const session = await requirePermission(PERMISSIONS.SETTING_MANAGE)
  const config = await readNumberingConfig(session.ctx)

  return (
    <>
      <PageHeader title={NUMBERING.title} description={NUMBERING.description} />
      <NumberingClient config={config} />
    </>
  )
}
