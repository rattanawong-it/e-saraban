"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { BookOpen, KeyRound, LogOut, Menu, Moon, Search, Sun } from "lucide-react"

import { HEADER, HELP_NAV_LABEL } from "@/constants"
import type { Theme } from "@/lib/theme"
import { logoutAction } from "@/server/actions/auth.actions"
import { setThemeAction } from "@/server/actions/ui.actions"
import type { CurrentUser, UserAffiliation } from "@/server/context"

import { ContextSwitcher } from "./context-switcher"
import { NotificationBell } from "./notification-bell"

// แถบบนของแอป — ตาม project-ui/Dashboard.dc.html
// สูง 68px · Context Switcher อยู่ซ้ายสุดเสมอตาม spec §10.2

export function AppHeader({
  user,
  affiliations,
  activeOrgUnitId,
  activeAffiliation,
  theme,
  unreadCount,
  unreadCap,
  onOpenMenu,
}: {
  user: CurrentUser
  affiliations: UserAffiliation[]
  activeOrgUnitId: string | null
  activeAffiliation: UserAffiliation | null
  theme: Theme
  unreadCount: number
  unreadCap: number
  onOpenMenu: () => void
}) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [pendingTheme, startThemeTransition] = useTransition()
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!profileOpen) return

    function onPointerDown(event: MouseEvent) {
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [profileOpen])

  return (
    <header className="flex h-17 shrink-0 items-center gap-3 border-b border-border bg-card px-3.5 lg:px-7">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label={HEADER.openMenu}
        className="flex size-9.5 cursor-pointer items-center justify-center rounded-lg bg-muted text-text-medium lg:hidden"
      >
        <Menu className="size-[19px]" aria-hidden />
      </button>

      <ContextSwitcher affiliations={affiliations} activeOrgUnitId={activeOrgUnitId} />

      {/* ช่องค้นหาเป็นของ P4 — ใส่ไว้ให้เห็นตำแหน่งจริงแต่ยังกดไม่ได้ */}
      <div className="hidden h-11 max-w-95 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-border bg-muted px-4 text-text-subtle xl:flex">
        <Search className="size-[17px] shrink-0" aria-hidden />
        <span className="truncate text-[13.5px]">{HEADER.searchPlaceholder}</span>
      </div>

      <div className="flex-1" />

      <button
        type="button"
        aria-label={HEADER.toggleTheme}
        disabled={pendingTheme}
        onClick={() =>
          startThemeTransition(() => {
            void setThemeAction(theme === "dark" ? "light" : "dark")
          })
        }
        className="flex size-9.5 cursor-pointer items-center justify-center rounded-lg bg-muted text-text-medium transition-colors hover:bg-secondary"
      >
        {theme === "dark" ? (
          <Sun className="size-[18px]" aria-hidden />
        ) : (
          <Moon className="size-[18px]" aria-hidden />
        )}
      </button>

      <NotificationBell unreadCount={unreadCount} cap={unreadCap} />

      <div ref={profileRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setProfileOpen((value) => !value)}
          aria-expanded={profileOpen}
          aria-haspopup="menu"
          className="flex size-9.5 cursor-pointer items-center justify-center rounded-lg bg-primary text-[13px] font-bold text-primary-foreground"
        >
          {user.initials}
        </button>

        {profileOpen ? (
          <div
            role="menu"
            className="absolute top-12 right-0 z-71 w-62 overflow-hidden rounded-xl border border-border bg-popover shadow-xl"
          >
            <div className="px-4.5 py-4">
              <div className="text-[14.5px] font-bold text-text-strong">{user.fullName}</div>
              <div className="mt-0.5 text-[12.5px] text-text-subtle">
                {user.email ?? user.username}
              </div>
              <div className="mt-2 text-[11px] text-text-subtle">
                {[activeAffiliation?.roleLabels[0], activeAffiliation?.orgUnitName]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>

            <div className="h-px bg-row-border" />
            {/* คู่มืออยู่ในเมนูโปรไฟล์ ไม่ใช่เมนูข้าง — เป็นของที่เปิดนาน ๆ ครั้ง
                ถ้าไปเบียดเมนูข้างจะทำให้เมนูงานประจำหายากขึ้นทุกวันเพื่อแลกกับวันที่ไม่ค่อยมี */}
            <Link
              href="/help"
              role="menuitem"
              className="flex items-center gap-2.5 px-4.5 py-3 text-[13.5px] font-semibold text-text-medium transition-colors hover:bg-muted"
            >
              <BookOpen className="size-4" aria-hidden />
              {HELP_NAV_LABEL}
            </Link>

            <div className="h-px bg-row-border" />
            <Link
              href="/change-password"
              role="menuitem"
              className="flex items-center gap-2.5 px-4.5 py-3 text-[13.5px] font-semibold text-text-medium transition-colors hover:bg-muted"
            >
              <KeyRound className="size-4" aria-hidden />
              {HEADER.changePassword}
            </Link>

            <div className="h-px bg-row-border" />
            <form action={logoutAction}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full cursor-pointer items-center gap-2.5 px-4.5 py-3 text-left text-[13.5px] font-semibold text-danger transition-colors hover:bg-danger-bg"
              >
                <LogOut className="size-4" aria-hidden />
                {HEADER.logout}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </header>
  )
}
