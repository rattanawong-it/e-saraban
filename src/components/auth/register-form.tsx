"use client"

import { useActionState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react"

import { REGISTER } from "@/constants"
import { Button } from "@/components/ui/button"
import { Field, Select, Textarea, TextInput } from "@/components/ui/field"
import { Alert } from "@/components/ui/primitives"
import { registerAction } from "@/server/actions/auth.actions"
import { IDLE_STATE } from "@/server/actions/types"

// ฟอร์มสมัครใช้งาน — ตาม project-ui/Register.dc.html
// ผลลัพธ์ของขั้นตอนนี้คือ "คำขอ" ไม่ใช่บัญชี — ผู้ดูแลต้องอนุมัติก่อน

export interface OrgUnitOption {
  id: string
  label: string
  level: number
}

export function RegisterForm({ orgUnits }: { orgUnits: OrgUnitOption[] }) {
  const [state, formAction, pending] = useActionState(registerAction, IDLE_STATE)

  if (state.status === "success") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-success-bg">
          <CheckCircle2 className="size-8 text-success" aria-hidden />
        </div>
        <h2 className="text-[22px] font-bold text-text-strong">{REGISTER.successTitle}</h2>
        <p className="mt-3 text-sm leading-relaxed text-text-subtle">{REGISTER.successBody}</p>

        <Button asChild variant="outline" block className="mt-7">
          <Link href="/login">
            <ArrowLeft className="size-4" aria-hidden />
            {REGISTER.backToLogin}
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

      <form action={formAction} className="flex flex-col gap-4">
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <Field label={REGISTER.prefix} htmlFor="prefix" errors={state.fieldErrors?.prefix}>
            <TextInput id="prefix" name="prefix" placeholder="นาย" />
          </Field>
          <Field
            label={REGISTER.firstName}
            htmlFor="firstName"
            errors={state.fieldErrors?.firstName}
          >
            <TextInput id="firstName" name="firstName" required />
          </Field>
        </div>

        <Field label={REGISTER.lastName} htmlFor="lastName" errors={state.fieldErrors?.lastName}>
          <TextInput id="lastName" name="lastName" required />
        </Field>

        <Field label={REGISTER.email} htmlFor="email" errors={state.fieldErrors?.email}>
          <TextInput
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder={REGISTER.emailPlaceholder}
            required
          />
        </Field>

        <Field
          label={REGISTER.username}
          htmlFor="username"
          errors={state.fieldErrors?.username}
          hint={REGISTER.usernameHint}
        >
          <TextInput
            id="username"
            name="username"
            autoComplete="username"
            placeholder={REGISTER.usernamePlaceholder}
            required
          />
        </Field>

        <Field label={REGISTER.orgUnit} htmlFor="orgUnitId" errors={state.fieldErrors?.orgUnitId}>
          <Select id="orgUnitId" name="orgUnitId" required defaultValue="">
            <option value="" disabled>
              {REGISTER.orgUnitPlaceholder}
            </option>
            {orgUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {`${"  ".repeat(unit.level)}${unit.label}`}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={REGISTER.positionTitle}
          htmlFor="positionTitle"
          errors={state.fieldErrors?.positionTitle}
        >
          <TextInput
            id="positionTitle"
            name="positionTitle"
            placeholder={REGISTER.positionPlaceholder}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={REGISTER.password} htmlFor="password" errors={state.fieldErrors?.password}>
            <TextInput
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>
          <Field
            label={REGISTER.confirmPassword}
            htmlFor="confirmPassword"
            errors={state.fieldErrors?.confirmPassword}
          >
            <TextInput
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>
        </div>

        <Field label={REGISTER.note} htmlFor="note" errors={state.fieldErrors?.note}>
          <Textarea id="note" name="note" rows={2} placeholder={REGISTER.notePlaceholder} />
        </Field>

        <Button type="submit" size="lg" block disabled={pending} className="mt-1">
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {REGISTER.submitting}
            </>
          ) : (
            REGISTER.submit
          )}
        </Button>
      </form>
    </>
  )
}
