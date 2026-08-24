"use client"

import { useActionState } from "react"
import { Check, Loader2 } from "lucide-react"

import { CHANGE_PASSWORD } from "@/constants"
import { Button } from "@/components/ui/button"
import { Field, TextInput } from "@/components/ui/field"
import { Alert } from "@/components/ui/primitives"
import { changePasswordAction } from "@/server/actions/auth.actions"
import { IDLE_STATE } from "@/server/actions/types"

export function ChangePasswordForm({ minLength }: { minLength: number }) {
  const [state, formAction, pending] = useActionState(changePasswordAction, IDLE_STATE)

  return (
    <>
      {state.status === "error" ? (
        <Alert tone="danger" className="mb-5" title={state.message} />
      ) : null}

      <form action={formAction} className="flex flex-col gap-4">
        <Field
          label={CHANGE_PASSWORD.currentPassword}
          htmlFor="currentPassword"
          errors={state.fieldErrors?.currentPassword}
        >
          <TextInput
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
          />
        </Field>

        <Field
          label={CHANGE_PASSWORD.newPassword}
          htmlFor="newPassword"
          errors={state.fieldErrors?.newPassword}
        >
          <TextInput
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>

        <Field
          label={CHANGE_PASSWORD.confirmPassword}
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

        <div className="rounded-xl bg-secondary px-4 py-3.5">
          <div className="mb-2 text-[12.5px] font-bold text-secondary-foreground">
            {CHANGE_PASSWORD.policyTitle}
          </div>
          <ul className="flex flex-col gap-1.5">
            {CHANGE_PASSWORD.policyItems(minLength).map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-text-medium">
                <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <Button type="submit" size="lg" block disabled={pending} className="mt-1">
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {CHANGE_PASSWORD.submitting}
            </>
          ) : (
            CHANGE_PASSWORD.submit
          )}
        </Button>
      </form>
    </>
  )
}
