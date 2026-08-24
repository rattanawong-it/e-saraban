import type { Metadata } from "next"

import { APP_NAME, CHANGE_PASSWORD } from "@/constants"
import { getSystemSettings } from "@/lib/settings"
import { AuthBrandPanel, AuthFormPanel, AuthHeading } from "@/components/auth/auth-shell"
import { ChangePasswordForm } from "@/components/auth/change-password-form"
import { Alert } from "@/components/ui/primitives"
import { requireSession } from "@/server/session"

export const metadata: Metadata = {
  title: `${CHANGE_PASSWORD.title} · ${APP_NAME}`,
}

// อยู่ในกลุ่ม (auth) แม้จะต้องล็อกอินก่อน เพราะผู้ใช้ที่ยังไม่เปลี่ยนรหัสผ่านครั้งแรก
// **ยังเข้าหน้าอื่นไม่ได้** (requireSession จะ redirect มาที่นี่) จึงไม่ควรเห็น
// sidebar และเมนูของแอปที่ยังใช้งานไม่ได้
export default async function ChangePasswordPage() {
  const session = await requireSession({ skipPasswordCheck: true })
  const settings = await getSystemSettings(session.ctx.tenantId)
  const isFirstTime = session.user.mustChangePassword

  return (
    <>
      <AuthBrandPanel
        title={isFirstTime ? CHANGE_PASSWORD.firstTimeTitle : CHANGE_PASSWORD.title}
        subtitle={CHANGE_PASSWORD.firstTimeBody}
      />
      <AuthFormPanel>
        <AuthHeading title={CHANGE_PASSWORD.title} subtitle={session.user.fullName} />
        {isFirstTime ? (
          <Alert tone="warning" className="mb-5" title={CHANGE_PASSWORD.firstTimeTitle}>
            {CHANGE_PASSWORD.firstTimeBody}
          </Alert>
        ) : null}
        <ChangePasswordForm minLength={settings.password.minLength} />
      </AuthFormPanel>
    </>
  )
}
