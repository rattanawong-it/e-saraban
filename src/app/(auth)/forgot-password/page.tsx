import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { APP_NAME, FORGOT_PASSWORD } from "@/constants"
import { AuthBrandPanel, AuthFormPanel, AuthHeading } from "@/components/auth/auth-shell"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export const metadata: Metadata = {
  title: `${FORGOT_PASSWORD.title} · ${APP_NAME}`,
}

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthBrandPanel title={FORGOT_PASSWORD.heroTitle} subtitle={FORGOT_PASSWORD.heroSubtitle} />
      <AuthFormPanel>
        <Link
          href="/login"
          className="mb-6 inline-flex items-center gap-1.5 text-label font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {FORGOT_PASSWORD.backToLogin}
        </Link>
        <AuthHeading title={FORGOT_PASSWORD.title} subtitle={FORGOT_PASSWORD.subtitle} />
        <ForgotPasswordForm />
      </AuthFormPanel>
    </>
  )
}
