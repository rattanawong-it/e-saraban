"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Loader2, LogIn, Lock, User } from "lucide-react"

import { LOGIN } from "@/constants"
import { Button } from "@/components/ui/button"
import { Checkbox, FieldError, Input, InputShell, Label } from "@/components/ui/field"
import { Alert } from "@/components/ui/primitives"
import { loginAction } from "@/server/actions/auth.actions"
import { IDLE_STATE } from "@/server/actions/types"

// ฟอร์มเข้าสู่ระบบ — ตาม project-ui/Login.dc.html
//
// ใช้ `useActionState` ของ React 19 แทน react-hook-form:
// ฟอร์มนี้มีสองช่องและตรวจฝั่ง server อยู่แล้ว (ต้องเช็กกับฐานข้อมูล)
// การเพิ่ม state ฝั่ง client เข้ามาจะไม่ได้อะไรกลับมา นอกจากทำให้ฟอร์ม
// ใช้งานไม่ได้เมื่อ JavaScript ยังโหลดไม่เสร็จ

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, IDLE_STATE)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <>
      {state.status === "error" ? (
        <Alert tone="danger" className="mb-5" title={state.message} />
      ) : null}

      <form action={formAction} className="flex flex-col gap-4.5">
        <div>
          <Label htmlFor="username">{LOGIN.username}</Label>
          <InputShell invalid={Boolean(state.fieldErrors?.username)}>
            <User className="size-[17px] shrink-0 text-text-subtle" aria-hidden />
            <Input
              id="username"
              name="username"
              autoComplete="username"
              placeholder={LOGIN.usernamePlaceholder}
              required
              autoFocus
            />
          </InputShell>
          <FieldError messages={state.fieldErrors?.username} />
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <Label htmlFor="password" className="mb-0">
              {LOGIN.password}
            </Label>
            <Link
              href="/forgot-password"
              className="text-[12.5px] font-semibold text-primary hover:underline"
            >
              {LOGIN.forgot}
            </Link>
          </div>
          <InputShell invalid={Boolean(state.fieldErrors?.password)}>
            <Lock className="size-[17px] shrink-0 text-text-subtle" aria-hidden />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder={LOGIN.passwordPlaceholder}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="flex cursor-pointer text-text-subtle hover:text-text-medium"
              aria-label={showPassword ? LOGIN.hidePassword : LOGIN.showPassword}
            >
              {showPassword ? (
                <EyeOff className="size-[18px]" aria-hidden />
              ) : (
                <Eye className="size-[18px]" aria-hidden />
              )}
            </button>
          </InputShell>
          <FieldError messages={state.fieldErrors?.password} />
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 select-none">
          <Checkbox name="remember" defaultChecked />
          <span className="text-[13px] text-text-medium">{LOGIN.remember}</span>
        </label>

        <Button type="submit" size="lg" block disabled={pending} className="mt-1">
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {LOGIN.submitting}
            </>
          ) : (
            <>
              <LogIn className="size-[18px]" aria-hidden />
              {LOGIN.submit}
            </>
          )}
        </Button>
      </form>

      <div className="mt-7 border-t border-border pt-5 text-center">
        <p className="text-[12.5px] leading-relaxed text-text-subtle">
          {LOGIN.noAccount}{" "}
          <Link href="/register" className="font-semibold text-primary hover:underline">
            {LOGIN.registerLink}
          </Link>
          <br />
          {LOGIN.contactAdmin}
        </p>
      </div>
    </>
  )
}
