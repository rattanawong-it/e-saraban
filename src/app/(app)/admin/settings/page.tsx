import type { Metadata } from "next"

import { APP_NAME, SETTINGS } from "@/constants"
import { PERMISSIONS } from "@/lib/authz"
import { SettingsForm } from "@/components/admin/settings-form"
import { PageHeader } from "@/components/ui/primitives"
import { readSettings } from "@/server/services/setting.service"
import { requirePermission } from "@/server/session"

export const metadata: Metadata = {
  title: `${SETTINGS.title} · ${APP_NAME}`,
}

export default async function SettingsPage() {
  const session = await requirePermission(PERMISSIONS.SETTING_MANAGE)
  const settings = await readSettings(session.ctx)

  return (
    <>
      <PageHeader title={SETTINGS.title} description={SETTINGS.description} />
      <SettingsForm settings={settings} />
    </>
  )
}
