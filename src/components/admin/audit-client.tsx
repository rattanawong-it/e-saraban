"use client"

import { useActionState } from "react"
import { Fingerprint, Loader2 } from "lucide-react"

import { AUDIT } from "@/constants"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/primitives"
import { verifyAuditChainAction } from "@/server/actions/admin.actions"
import type { ActionState } from "@/server/actions/types"
import type { ChainCheckData } from "@/server/actions/admin.actions"

// ปุ่มตรวจ hash chain (spec §8.5 — "ปุ่มตรวจสอบความสมบูรณ์ของ hash chain")
//
// เป็น client component แยกเล็ก ๆ เพราะต้องรอผลแบบ async
// ส่วนตารางที่เหลือของหน้ายังเป็น Server Component ทั้งหมด

const INITIAL: ActionState<ChainCheckData> = { status: "idle" }

export function ChainVerifyButton() {
  const [state, formAction, pending] = useActionState(verifyAuditChainAction, INITIAL)

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction}>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Fingerprint className="size-4" aria-hidden />
          )}
          {pending ? AUDIT.verifying : AUDIT.verifyChain}
        </Button>
      </form>

      {state.status === "success" ? (
        <Alert tone="success" title={state.message} />
      ) : state.status === "error" ? (
        <Alert tone="danger" title={state.message} />
      ) : null}
    </div>
  )
}
