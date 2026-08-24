import { canOrFalse, PERMISSIONS, type Permission } from "@/lib/authz"
import { getThemeFromCookie } from "@/lib/theme"
import { AppShell } from "@/components/layout/app-shell"
import { requireSession } from "@/server/session"

// เลย์เอาต์ของทุกหน้าที่ต้องล็อกอิน (spec §11.2 — route group `(app)`)
//
// จุดเดียวที่บังคับว่า "ต้องล็อกอินและเปลี่ยนรหัสผ่านครั้งแรกแล้ว"
// requireSession จะ redirect เองเมื่อเงื่อนไขไม่ผ่าน

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession()
  const theme = await getThemeFromCookie()

  // ส่งเป็น "รายการรหัสสิทธิ์" ไม่ใช่ผังเมนูสำเร็จรูป เพราะผังเมนูมี icon component
  // อยู่ข้างใน ซึ่งส่งข้ามขอบเขต Server → Client Component ไม่ได้
  // การกรองเมนูจึงไปทำในฝั่ง client ที่ import ผังเมนูเอง (spec §10.2 — ซ่อน ไม่ใช่ disable)
  const allowedPermissions = Object.values(PERMISSIONS).filter((permission) =>
    canOrFalse(session.ctx, permission as Permission),
  )

  return (
    <AppShell
      allowedPermissions={allowedPermissions}
      user={session.user}
      affiliations={session.affiliations}
      activeOrgUnitId={session.ctx.activeOrgUnitId}
      activeAffiliation={session.activeAffiliation}
      theme={theme}
    >
      {children}
    </AppShell>
  )
}
