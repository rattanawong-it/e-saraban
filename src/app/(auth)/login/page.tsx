import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Hash, History, ShieldCheck } from "lucide-react"

import { APP_NAME, LOGIN } from "@/constants"
import { AuthBrandPanel, AuthFormPanel, AuthHeading } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import { getAppSession } from "@/server/session"

export const metadata: Metadata = {
  title: `${LOGIN.title} · ${APP_NAME}`,
}

const FEATURES = [
  { icon: ShieldCheck, label: LOGIN.features[0] },
  { icon: Hash, label: LOGIN.features[1] },
  { icon: History, label: LOGIN.features[2] },
] as const

export default async function LoginPage() {
  // ล็อกอินอยู่แล้วไม่ต้องเห็นหน้านี้อีก
  const session = await getAppSession()
  if (session) redirect("/dashboard")

  return (
    <>
      <AuthBrandPanel title={LOGIN.heroTitle} subtitle={LOGIN.heroSubtitle} features={FEATURES} />
      <AuthFormPanel>
        <AuthHeading title={LOGIN.title} subtitle={LOGIN.subtitle} />
        <LoginForm />
      </AuthFormPanel>
    </>
  )
}
