"use client"

import { useState } from "react"

import type { Permission } from "@/lib/authz"
import type { Theme } from "@/lib/theme"
import type { CurrentUser, UserAffiliation } from "@/server/context"

import { AppHeader } from "./app-header"
import { AppSidebar } from "./app-sidebar"

// ตัวประกอบ sidebar + header + เนื้อหา
//
// เป็น client component เพราะต้องจำสถานะ "drawer เปิดอยู่ไหม" บนจอเล็ก
// แต่ **เนื้อหาข้างในยังเป็น Server Component ทั้งหมด** เพราะส่งผ่าน children
// ซึ่งถูก render บน server แล้วส่งมาเป็น React tree สำเร็จรูป

export function AppShell({
  allowedPermissions,
  user,
  affiliations,
  activeOrgUnitId,
  activeAffiliation,
  theme,
  children,
}: {
  allowedPermissions: Permission[]
  user: CurrentUser
  affiliations: UserAffiliation[]
  activeOrgUnitId: string | null
  activeAffiliation: UserAffiliation | null
  theme: Theme
  children: React.ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar
        allowedPermissions={allowedPermissions}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          user={user}
          affiliations={affiliations}
          activeOrgUnitId={activeOrgUnitId}
          activeAffiliation={activeAffiliation}
          theme={theme}
          onOpenMenu={() => setMenuOpen(true)}
        />
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  )
}
