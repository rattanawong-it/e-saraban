import type { Metadata } from "next"
import Link from "next/link"

import { APP_NAME, NOTIFICATION_UI } from "@/constants"
import { formatThaiDateTime } from "@/lib/thai"
import { PageHeader } from "@/components/ui/primitives"
import { listNotifications } from "@/server/services/notification.service"
import { requireSession } from "@/server/session"

export const metadata: Metadata = {
  title: `${NOTIFICATION_UI.pageTitle} · ${APP_NAME}`,
}

// รายการแจ้งเตือนทั้งหมดของผู้ใช้คนนี้ (D10)
//
// ⚠️ `listNotifications()` กรองผ่านด่านการมองเห็นเอกสารให้แล้ว — รายการที่ชี้ไปยัง
// เอกสารที่ถูกลบ ถูกปรับชั้นความลับขึ้น หรือถูกถอน ACL จะไม่โผล่มาถึงตรงนี้
// ห้ามเปลี่ยนไปอ่านตาราง notifications ตรง ๆ เพื่อความเร็ว

export default async function NotificationsPage() {
  const session = await requireSession()
  const items = await listNotifications(session.ctx, { limit: 100 })

  return (
    <>
      <PageHeader title={NOTIFICATION_UI.pageTitle} description={NOTIFICATION_UI.pageDescription} />

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-14 text-center">
          <p className="text-[14px] font-medium text-text-medium">{NOTIFICATION_UI.empty}</p>
          <p className="mt-1 text-[13px] text-text-subtle">{NOTIFICATION_UI.emptyHint}</p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border bg-card">
          {items.map((item) => {
            const unread = item.readAt === null

            const row = (
              <div className="flex items-start gap-3 px-5 py-4">
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${unread ? "bg-primary" : "bg-transparent"}`}
                  {...(unread
                    ? { "aria-label": NOTIFICATION_UI.unreadBadge }
                    : { "aria-hidden": true })}
                />

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[14px] ${unread ? "font-bold text-text-strong" : "font-medium text-text-medium"}`}
                  >
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[13px] text-text-subtle">{item.body}</p>
                </div>

                <span className="shrink-0 text-[12px] whitespace-nowrap text-text-subtle">
                  {formatThaiDateTime(item.createdAt)}
                </span>
              </div>
            )

            return (
              <li key={item.id} className="border-b border-border last:border-b-0">
                {item.href ? (
                  <Link href={item.href} className="block hover:bg-muted">
                    {row}
                  </Link>
                ) : (
                  row
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
