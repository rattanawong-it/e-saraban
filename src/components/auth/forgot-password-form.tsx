"use client"

import { useActionState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react"

import { FORGOT_PASSWORD } from "@/constants"
import { Button } from "@/components/ui/button"
import { FieldError, Input, InputShell, Label } from "@/components/ui/field"
import { Alert } from "@/components/ui/primitives"
import { forgotPasswordAction } from "@/server/actions/auth.actions"
import { IDLE_STATE } from "@/server/actions/types"

// ⚠️ ต่างจาก project-ui/Forgot Password.dc.html โดยตั้งใจ
//
// ดีไซน์ต้นแบบวาดขั้นตอน "ส่งลิงก์ทางอีเมล → กดลิงก์ → ตั้งรหัสใหม่"
// แต่ D10 กำหนดว่า MVP แจ้งเตือน **in-app เท่านั้น ไม่มีอีเมล**
// จึงเปลี่ยนเป็นคำขอที่เข้าคิวให้ผู้ดูแลระบบรีเซ็ตให้ (ดู /admin/users)
// โครงสร้างในฐานข้อมูลยังเก็บ TTL 30 นาทีไว้ เผื่อเปิดใช้อีเมลในอนาคต

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, IDLE_STATE)

  if (state.status === "success") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-success-bg">
          <CheckCircle2 className="size-8 text-success" aria-hidden />
        </div>
        <h2 className="text-title-l font-bold text-text-strong">{FORGOT_PASSWORD.sentTitle}</h2>
        <p className="mt-3 text-body leading-relaxed text-text-subtle">
          {FORGOT_PASSWORD.sentBody}
        </p>

        <Button asChild variant="outline" block className="mt-7">
          <Link href="/login">
            <ArrowLeft className="size-4" aria-hidden />
            {FORGOT_PASSWORD.backToLogin}
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <>
      {state.status === "error" ? (
        <Alert tone="danger" className="mb-5" title={state.message} />
      ) : null}

      <form action={formAction} className="flex flex-col gap-4.5">
        <div>
          <Label htmlFor="email">{FORGOT_PASSWORD.email}</Label>
          <InputShell invalid={Boolean(state.fieldErrors?.email)}>
            <Mail className="size-[17px] shrink-0 text-text-subtle" aria-hidden />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={FORGOT_PASSWORD.emailPlaceholder}
              required
              autoFocus
            />
          </InputShell>
          <FieldError messages={state.fieldErrors?.email} />
        </div>

        <Button type="submit" size="lg" block disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {FORGOT_PASSWORD.submitting}
            </>
          ) : (
            FORGOT_PASSWORD.submit
          )}
        </Button>
      </form>

      <div className="mt-6 rounded-xl bg-secondary px-4 py-3.5">
        <p className="text-caption leading-relaxed text-text-medium">{FORGOT_PASSWORD.notice}</p>
      </div>
    </>
  )
}
