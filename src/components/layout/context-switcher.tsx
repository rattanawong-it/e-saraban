"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { Building2, Check, ChevronDown, Loader2 } from "lucide-react"

import { HEADER } from "@/constants"
import { cn } from "@/lib/utils"
import { switchContextAction } from "@/server/actions/auth.actions"
import { IDLE_STATE } from "@/server/actions/types"
import type { UserAffiliation } from "@/server/context"

// Context Switcher (spec §5.2 · §10.2)
//
// "อยู่บน header เสมอ แสดงหน่วยงานปัจจุบันชัดเจน — เพราะการทำงานผิดหน่วยงาน
//  คือความผิดพลาดที่แก้ยากที่สุด"
//
// ผู้ใช้ที่มีสังกัดเดียว **ไม่เห็นปุ่มเปิดเมนู** (spec §5.2 "ซ่อน switcher ทั้งหมด")
// แต่ยังเห็นชื่อหน่วยงานที่กำลังทำงานอยู่ เพื่อไม่ให้เข้าใจผิดว่าทำงานในนามใคร

export function ContextSwitcher({
  affiliations,
  activeOrgUnitId,
}: {
  affiliations: UserAffiliation[]
  activeOrgUnitId: string | null
}) {
  const [open, setOpen] = useState(false)
  const [, formAction, pending] = useActionState(switchContextAction, IDLE_STATE)
  const containerRef = useRef<HTMLDivElement>(null)

  const active = affiliations.find((item) => item.orgUnitId === activeOrgUnitId)
  const multiple = affiliations.length > 1

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const body = (
    <>
      <Building2 className="size-[17px] shrink-0 text-primary" strokeWidth={1.7} aria-hidden />
      <div className="min-w-0 text-left">
        <div className="text-[9px] tracking-wide text-text-subtle uppercase">
          {HEADER.workingAs}
        </div>
        <div className="truncate text-[12.5px] leading-tight font-bold text-primary">
          {active?.orgUnitName ?? HEADER.singleAffiliation}
        </div>
      </div>
    </>
  )

  if (!multiple) {
    return (
      <div className="flex h-11 max-w-[15rem] shrink-0 items-center gap-2.5 rounded-lg border border-primary/20 bg-secondary px-3 lg:min-w-[18rem] lg:px-4">
        {body}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={HEADER.switchUnit}
        className="flex h-11 max-w-[15rem] cursor-pointer items-center gap-2.5 rounded-lg border border-primary/20 bg-secondary px-3 transition-colors hover:bg-secondary/70 lg:min-w-[18rem] lg:px-4"
      >
        {body}
        {pending ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-text-subtle" aria-hidden />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-text-subtle" aria-hidden />
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute top-13 left-0 z-71 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-xl"
        >
          <div className="border-b border-row-border px-4 py-3 text-[11px] font-bold tracking-wide text-text-subtle uppercase">
            {HEADER.switchUnit}
          </div>

          {affiliations.map((affiliation) => {
            const isActive = affiliation.orgUnitId === activeOrgUnitId

            return (
              <form key={affiliation.orgUnitId} action={formAction} onSubmit={() => setOpen(false)}>
                <input type="hidden" name="orgUnitId" value={affiliation.orgUnitId} />
                <button
                  type="submit"
                  role="menuitem"
                  disabled={isActive || pending}
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-row-border px-4 py-3 text-left transition-colors last:border-b-0",
                    isActive ? "bg-secondary" : "cursor-pointer hover:bg-muted",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-text-strong">
                      {affiliation.orgUnitName}
                    </div>
                    <div className="mt-0.5 truncate text-[11.5px] text-text-subtle">
                      {[affiliation.positionTitle, affiliation.roleLabels.join(" · ")]
                        .filter(Boolean)
                        .join(" — ")}
                    </div>
                  </div>
                  {isActive ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  ) : null}
                </button>
              </form>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
