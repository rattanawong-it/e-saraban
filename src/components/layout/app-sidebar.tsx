"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, X } from "lucide-react"

import { BRAND, HEADER } from "@/constants"
import type { Permission } from "@/lib/authz"
import { cn } from "@/lib/utils"

import { filterNav, NAV_GROUPS, type NavItem } from "./nav-config"

// เมนูด้านซ้าย — ตาม project-ui/Dashboard.dc.html
// พื้นเขียวเข้ม #243A1E (token: --sidebar) กว้าง 248px
// จอเล็กกว่า lg จะกลายเป็น drawer ที่เปิดจากปุ่มแฮมเบอร์เกอร์บน header

export function AppSidebar({
  allowedPermissions,
  open,
  onClose,
}: {
  allowedPermissions: Permission[]
  open: boolean
  onClose: () => void
}) {
  const pathname = usePathname()

  // กรองเมนูตามสิทธิ์จริง — ทำฝั่ง client เพราะผังเมนูมี icon component อยู่ข้างใน
  // ซึ่งส่งข้ามขอบเขต Server → Client Component ไม่ได้
  const groups = useMemo(() => {
    const allowed = new Set<string>(allowedPermissions)
    return filterNav(NAV_GROUPS, (permission) => allowed.has(permission))
  }, [allowedPermissions])

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label={HEADER.closeMenu}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/40 lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-55 flex w-62 shrink-0 flex-col bg-sidebar py-5 text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        )}
      >
        <div className="mb-4 flex items-center gap-3 border-b border-white/10 px-5 pb-4.5">
          <div className="flex h-9 items-center justify-center rounded-xl bg-white px-2">
            <Image
              src="/brand/krirk-logo.png"
              alt={BRAND.logoAlt}
              width={90}
              height={24}
              className="h-6 w-auto"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-bold">{BRAND.name}</div>
            <div className="truncate text-[10.5px] text-white/55">{BRAND.tagline}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={HEADER.closeMenu}
            className="flex size-7 cursor-pointer items-center justify-center rounded-lg bg-white/10 lg:hidden"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
          {groups.map((group, index) => (
            <div key={group.label ?? `group-${index}`} className={index > 0 ? "mt-3.5" : ""}>
              {group.label ? (
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-wider text-white/40 uppercase">
                  {group.label}
                </div>
              ) : null}
              {group.items.map((item) => (
                <NavRow key={item.href + item.label} item={item} pathname={pathname} />
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavRow({ item, pathname }: { item: NavItem; pathname: string }) {
  const childActive = item.children?.some((child) => isActive(pathname, child.href)) ?? false
  const [expanded, setExpanded] = useState(childActive)
  const active = isActive(pathname, item.href) || childActive
  const Icon = item.icon

  if (item.children && item.children.length > 0) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className={cn(
            "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13.5px] font-medium transition-colors",
            active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
          )}
        >
          {Icon ? <Icon className="size-[18px] shrink-0" strokeWidth={1.7} aria-hidden /> : null}
          <span className="flex-1 truncate">{item.label}</span>
          <ChevronDown
            className={cn("size-4 shrink-0 transition-transform", expanded && "rotate-180")}
            aria-hidden
          />
        </button>

        {expanded ? (
          <div className="mt-0.5 mb-1 ml-4 flex flex-col gap-0.5 border-l border-white/10 pl-3">
            {item.children.map((child) => (
              <NavLeaf key={child.href + child.label} item={child} pathname={pathname} />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return <NavLeaf item={item} pathname={pathname} withIcon />
}

function NavLeaf({
  item,
  pathname,
  withIcon = false,
}: {
  item: NavItem
  pathname: string
  withIcon?: boolean
}) {
  const active = isActive(pathname, item.href)
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors",
        active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
      )}
    >
      {withIcon && Icon ? (
        <Icon className="size-[18px] shrink-0" strokeWidth={1.7} aria-hidden />
      ) : null}
      <span className="flex-1 truncate">{item.label}</span>
      {item.phase ? (
        <span className="tabular shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[9.5px] font-bold text-white/50">
          {item.phase}
        </span>
      ) : null}
    </Link>
  )
}
