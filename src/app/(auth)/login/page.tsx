import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Hash, History, ShieldCheck } from "lucide-react"

import { APP_NAME, LOGIN, LOGIN_ERRORS } from "@/constants"
import { AuthBrandPanel, AuthFormPanel, AuthHeading } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import { isGoogleEnabled } from "@/lib/auth/providers/google"
import { getAppSession } from "@/server/session"

export const metadata: Metadata = {
  title: `${LOGIN.title} · ${APP_NAME}`,
}

const FEATURES = [
  { icon: ShieldCheck, label: LOGIN.features[0] },
  { icon: Hash, label: LOGIN.features[1] },
  { icon: History, label: LOGIN.features[2] },
] as const

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // ล็อกอินอยู่แล้วไม่ต้องเห็นหน้านี้อีก
  const session = await getAppSession()
  if (session) redirect("/dashboard")

  const params = await searchParams
  const errorCode = typeof params.error === "string" ? params.error : ""

  // แปลรหัสจาก callback เป็นข้อความไทย — รหัสที่ไม่รู้จักถือว่าไม่มีข้อผิดพลาด
  // เพราะใครก็ตามใส่ ?error=อะไรก็ได้ใน URL แล้วส่งต่อให้คนอื่นหลอกได้
  const externalError = LOGIN_ERRORS[errorCode]

  return (
    <>
      <AuthBrandPanel title={LOGIN.heroTitle} subtitle={LOGIN.heroSubtitle} features={FEATURES} />
      <AuthFormPanel>
        <AuthHeading title={LOGIN.title} subtitle={LOGIN.subtitle} />
        <LoginForm googleEnabled={isGoogleEnabled()} externalError={externalError} />
      </AuthFormPanel>
    </>
  )
}
