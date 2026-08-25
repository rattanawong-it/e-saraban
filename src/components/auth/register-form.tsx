"use client"

import { useActionState, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
  X,
} from "lucide-react"

import { REGISTER } from "@/constants"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  Input,
  InputShell,
  Label,
  SelectControl,
  Textarea,
} from "@/components/ui/field"
import { Alert } from "@/components/ui/primitives"
import { AuthHeading } from "@/components/auth/auth-shell"
import { registerAction } from "@/server/actions/auth.actions"
import type { RegistrationSummary } from "@/server/services/auth.service"
import type { ActionState } from "@/server/actions/types"

// ฟอร์มสมัครใช้งาน — ตาม project-ui/Register.dc.html
// ผลลัพธ์ของขั้นตอนนี้คือ "คำขอ" ไม่ใช่บัญชี — ผู้ดูแลต้องอนุมัติก่อน

export interface OrgUnitOption {
  id: string
  label: string
  level: number
}

const IDLE: ActionState<RegistrationSummary> = { status: "idle" }

/** ช่องที่ต้องกรอกครบก่อนปุ่มส่งคำขอจะกดได้ — ตรงกับ registerSchema */
const REQUIRED_FIELDS = ["firstName", "lastName", "email", "orgUnitId"] as const

export function RegisterForm({
  orgUnits,
  passwordMinLength,
}: {
  orgUnits: OrgUnitOption[]
  passwordMinLength: number
}) {
  const [state, formAction, pending] = useActionState(registerAction, IDLE)
  const formRef = useRef<HTMLFormElement>(null)

  // React 19 ล้าง uncontrolled form ให้เองหลัง action ทำงานเสร็จ — เก็บสิ่งที่ผู้ใช้พิมพ์ไว้ก่อน
  // เพื่อเติมกลับเมื่อ server ปฏิเสธ (เช่นชื่อผู้ใช้ซ้ำ) จะได้ไม่ต้องกรอกใหม่ทั้งใบ
  const snapshotRef = useRef<FormData | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [mismatch, setMismatch] = useState(false)

  // null = ยังไม่ hydrate — ปุ่มยังกดได้ เพื่อให้ฟอร์มส่งได้แม้ JavaScript ยังโหลดไม่เสร็จ
  // การตรวจฝั่ง client เป็นเพียงความสะดวก ตัวจริงคือ registerSchema + validatePassword ฝั่ง server
  const [complete, setComplete] = useState<boolean | null>(null)

  const syncFormState = useCallback(() => {
    const form = formRef.current
    if (!form) return

    const data = new FormData(form)
    const password = String(data.get("password") ?? "")
    const confirmPassword = String(data.get("confirmPassword") ?? "")

    setMismatch(confirmPassword.length > 0 && confirmPassword !== password)
    setComplete(
      REQUIRED_FIELDS.every((name) => String(data.get(name) ?? "").trim().length > 0) &&
        password.length >= passwordMinLength &&
        confirmPassword === password,
    )
  }, [passwordMinLength])

  /** เติมค่าที่ผู้ใช้พิมพ์กลับเข้าฟอร์มหลัง React ล้างมันทิ้ง */
  const restoreSnapshot = useCallback(() => {
    const form = formRef.current
    const snapshot = snapshotRef.current
    if (!form || !snapshot) return

    for (const element of Array.from(form.elements)) {
      if (
        !(element instanceof HTMLInputElement) &&
        !(element instanceof HTMLSelectElement) &&
        !(element instanceof HTMLTextAreaElement)
      ) {
        continue
      }

      const value = snapshot.get(element.name)
      if (typeof value === "string") element.value = value
    }
  }, [])

  // ต้องทำหลัง React ล้างฟอร์ม — เติมค่ากลับก่อน แล้วค่อยคำนวณสถานะปุ่มใหม่
  // ถ้าไม่ sync ตรงนี้ ปุ่มจะค้างเป็นสีเขียวทั้งที่ทุกช่องว่างแล้ว
  useEffect(() => {
    if (state.status === "error") restoreSnapshot()
    // คำขอผ่านแล้วไม่เก็บรหัสผ่านค้างไว้ในหน่วยความจำ
    if (state.status === "success") snapshotRef.current = null
    syncFormState()
  }, [restoreSnapshot, syncFormState, state])

  if (state.status === "success") {
    return <RegistrationSent summary={state.data} />
  }

  return (
    <>
      <Link
        href="/login"
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {REGISTER.backToLogin}
      </Link>
      <AuthHeading title={REGISTER.title} subtitle={REGISTER.subtitle} />

      {state.status === "error" ? (
        <Alert tone="danger" className="mb-5" title={state.message} />
      ) : null}

      <form
        ref={formRef}
        action={formAction}
        onChange={syncFormState}
        onSubmit={(event) => {
          snapshotRef.current = new FormData(event.currentTarget)
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <Label htmlFor="firstName">{REGISTER.firstName}</Label>
            <InputShell invalid={Boolean(state.fieldErrors?.firstName)}>
              <User className="size-[17px] shrink-0 text-text-subtle" aria-hidden />
              <Input
                id="firstName"
                name="firstName"
                placeholder={REGISTER.firstNamePlaceholder}
                required
              />
            </InputShell>
            <FieldError messages={state.fieldErrors?.firstName} />
          </div>

          <div>
            <Label htmlFor="lastName">{REGISTER.lastName}</Label>
            <InputShell invalid={Boolean(state.fieldErrors?.lastName)}>
              <User className="size-[17px] shrink-0 text-text-subtle" aria-hidden />
              <Input
                id="lastName"
                name="lastName"
                placeholder={REGISTER.lastNamePlaceholder}
                required
              />
            </InputShell>
            <FieldError messages={state.fieldErrors?.lastName} />
          </div>
        </div>

        <div>
          <Label htmlFor="email">{REGISTER.email}</Label>
          <InputShell invalid={Boolean(state.fieldErrors?.email)}>
            <Mail className="size-[17px] shrink-0 text-text-subtle" aria-hidden />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={REGISTER.emailPlaceholder}
              required
            />
          </InputShell>
          <FieldError messages={state.fieldErrors?.email} />
          <p className="mt-1.5 text-xs leading-relaxed text-text-subtle">{REGISTER.emailHint}</p>
        </div>

        <div>
          <Label htmlFor="orgUnitId">{REGISTER.orgUnit}</Label>
          <InputShell invalid={Boolean(state.fieldErrors?.orgUnitId)}>
            <Building2 className="size-[17px] shrink-0 text-text-subtle" aria-hidden />
            <SelectControl id="orgUnitId" name="orgUnitId" required defaultValue="">
              <option value="" disabled>
                {REGISTER.orgUnitPlaceholder}
              </option>
              {orgUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {`${"  ".repeat(unit.level)}${unit.label}`}
                </option>
              ))}
            </SelectControl>
            <ChevronDown className="size-[15px] shrink-0 text-text-subtle" aria-hidden />
          </InputShell>
          <FieldError messages={state.fieldErrors?.orgUnitId} />
        </div>

        <div>
          <Label htmlFor="positionTitle">{REGISTER.positionTitle}</Label>
          <InputShell invalid={Boolean(state.fieldErrors?.positionTitle)}>
            <BriefcaseBusiness className="size-[17px] shrink-0 text-text-subtle" aria-hidden />
            <Input
              id="positionTitle"
              name="positionTitle"
              placeholder={REGISTER.positionPlaceholder}
            />
          </InputShell>
          <FieldError messages={state.fieldErrors?.positionTitle} />
        </div>

        <div>
          <Label htmlFor="password">{REGISTER.password}</Label>
          <InputShell invalid={Boolean(state.fieldErrors?.password)}>
            <Lock className="size-[17px] shrink-0 text-text-subtle" aria-hidden />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={REGISTER.passwordPlaceholder(passwordMinLength)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="flex cursor-pointer text-text-subtle hover:text-text-medium"
              aria-label={showPassword ? REGISTER.hidePassword : REGISTER.showPassword}
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

        <div>
          <Label htmlFor="confirmPassword">{REGISTER.confirmPassword}</Label>
          <InputShell invalid={mismatch || Boolean(state.fieldErrors?.confirmPassword)}>
            <Lock className="size-[17px] shrink-0 text-text-subtle" aria-hidden />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder={REGISTER.confirmPasswordPlaceholder}
              required
            />
          </InputShell>
          {mismatch ? (
            <p
              className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-danger-text"
              role="alert"
            >
              <X className="size-[13px] shrink-0" aria-hidden />
              {REGISTER.passwordMismatch}
            </p>
          ) : (
            <FieldError messages={state.fieldErrors?.confirmPassword} />
          )}
        </div>

        <Field label={REGISTER.note} htmlFor="note" errors={state.fieldErrors?.note}>
          <Textarea id="note" name="note" rows={2} placeholder={REGISTER.notePlaceholder} />
        </Field>

        <Button
          type="submit"
          size="lg"
          block
          disabled={pending || complete === false}
          className="mt-1"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {REGISTER.submitting}
            </>
          ) : (
            <>
              <ArrowRight className="size-[17px]" aria-hidden />
              {REGISTER.submit}
            </>
          )}
        </Button>
      </form>

      <div className="mt-6 border-t border-border pt-5 text-center">
        <p className="text-[12.5px] text-text-subtle">
          {REGISTER.haveAccount}{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            {REGISTER.loginLink}
          </Link>
        </p>
      </div>
    </>
  )
}

/** จอที่สองของตัวอย่าง — ยืนยันว่าคำขอถูกส่งไปยังผู้ดูแลของหน่วยงานใด */
function RegistrationSent({ summary }: { summary?: RegistrationSummary }) {
  return (
    <div className="pt-5 text-center">
      <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-success-bg">
        <CheckCircle2 className="size-8 text-success" aria-hidden />
      </div>
      <h2 className="text-[22px] font-bold text-text-strong">{REGISTER.successTitle}</h2>

      {summary ? (
        <>
          <p className="mt-2.5 text-sm leading-relaxed text-text-subtle">
            {REGISTER.successLeadPrefix} <b className="text-text-strong">{summary.fullName}</b>{" "}
            {REGISTER.successLeadSuffix}
          </p>
          <p className="mt-1 text-[14.5px] font-bold text-text-strong">{summary.orgUnitName}</p>
        </>
      ) : null}

      {summary ? (
        <div className="mt-6 rounded-xl border border-border bg-surface-sunken px-4 py-3.5">
          <p className="text-[11.5px] font-semibold text-text-subtle">
            {REGISTER.successUsernameLabel}
          </p>
          <p className="mt-1 font-mono text-[17px] font-bold text-text-strong">
            {summary.username}
          </p>
          <p className="mt-1 text-[11.5px] text-text-subtle">{REGISTER.successUsernameHint}</p>
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-border bg-card px-4 py-4 text-left text-[12.5px] leading-relaxed text-text-medium">
        {REGISTER.successNoticePrefix} <b className="text-text-strong">{summary?.email}</b>{" "}
        {REGISTER.successNoticeSuffix}
      </div>

      <Button asChild size="lg" block className="mt-5">
        <Link href="/login">{REGISTER.backToLogin}</Link>
      </Button>
    </div>
  )
}
