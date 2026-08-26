"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"

import { HEADER, NOTIFICATION_UI } from "@/constants"
import { formatThaiDateTime } from "@/lib/thai"
import {
  loadNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/server/actions/notification.actions"
import type { NotificationView } from "@/server/services/notification.service"

// กระดิ่งแจ้งเตือน (D10 · spec §10.2)
//
// ⚠️ **ไม่ polling** — ระบบสารบรรณไม่ใช่แชท ช้าไปจนถึงตอนโหลดหน้าถัดไปไม่มีใครเดือดร้อน
// ส่วนการยิงทุก 30 วินาที × ผู้ใช้ทั้งองค์กร คือภาระที่ได้ผลตอบแทนแทบเป็นศูนย์
//
// ตัวเลขบนกระดิ่ง render มาจาก server (layout อ่านให้) ส่วน**รายการ**ดึงตอนกดเปิด
// เพราะผู้ใช้ส่วนใหญ่ไม่กดกระดิ่งในการโหลดหน้าหนึ่งครั้ง จะดึงมารอไว้ก็เปล่าประโยชน์

export function NotificationBell({ unreadCount, cap }: { unreadCount: number; cap: number }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationView[] | null>(null)
  const [loading, startLoading] = useTransition()
  const [, startMarking] = useTransition()
  const panelRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [open])

  function toggle() {
    const next = !open
    setOpen(next)

    // ดึงใหม่ทุกครั้งที่เปิด ไม่ cache ไว้ — ระหว่างที่ค้างหน้าเดิมอาจมีของใหม่เข้ามา
    if (next) {
      startLoading(async () => {
        const state = await loadNotificationsAction()
        setItems(state.data ?? [])
      })
    }
  }

  function markRead(id: string) {
    startMarking(async () => {
      await markNotificationReadAction(id)
      setItems((current) =>
        current === null
          ? current
          : current.map((item) => (item.id === id ? { ...item, readAt: new Date() } : item)),
      )
      router.refresh()
    })
  }

  function markAll() {
    startMarking(async () => {
      await markAllNotificationsReadAction()
      setItems((current) =>
        current === null ? current : current.map((item) => ({ ...item, readAt: new Date() })),
      )
      router.refresh()
    })
  }

  return (
    <div ref={panelRef} className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-label={HEADER.notifications}
        aria-expanded={open}
        aria-haspopup="menu"
        className="relative flex size-9.5 cursor-pointer items-center justify-center rounded-lg bg-muted text-text-medium transition-colors hover:bg-secondary"
      >
        <Bell className="size-[18px]" aria-hidden />

        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4.5 font-bold text-white">
            {unreadCount >= cap ? NOTIFICATION_UI.overflowCount(cap) : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute top-12 right-0 z-71 w-88 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-popover shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-[14px] font-bold text-text-strong">
              {NOTIFICATION_UI.panelTitle}
            </span>

            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAll}
                className="cursor-pointer text-[12px] text-primary hover:underline"
              >
                {NOTIFICATION_UI.markAllRead}
              </button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && items === null ? (
              <p className="px-4 py-6 text-center text-[13px] text-text-subtle">
                {NOTIFICATION_UI.loading}
              </p>
            ) : items && items.length > 0 ? (
              <ul>
                {items.map((item) => (
                  <li key={item.id} className="border-b border-border/60 last:border-b-0">
                    <NotificationRow item={item} onOpen={() => markRead(item.id)} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] font-medium text-text-medium">{NOTIFICATION_UI.empty}</p>
                <p className="mt-1 text-[12px] text-text-subtle">{NOTIFICATION_UI.emptyHint}</p>
              </div>
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-4 py-3 text-center text-[12.5px] font-medium text-primary hover:bg-muted"
          >
            {NOTIFICATION_UI.viewAll}
          </Link>
        </div>
      ) : null}
    </div>
  )
}

/**
 * หนึ่งรายการ
 *
 * เป็นลิงก์เมื่อเอกสารยังเปิดได้ · เป็นข้อความเฉย ๆ เมื่อไม่มีที่ไป
 * (`href` ว่างได้เมื่อการแจ้งเตือนไม่ได้ผูกกับเอกสาร) — ไม่ทำเป็นลิงก์ที่พาไปหน้าพัง
 */
function NotificationRow({ item, onOpen }: { item: NotificationView; onOpen: () => void }) {
  const unread = item.readAt === null

  const content = (
    <>
      <div className="flex items-start gap-2">
        {unread ? (
          <span
            className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
            aria-label={NOTIFICATION_UI.unreadBadge}
          />
        ) : (
          <span className="mt-1.5 size-2 shrink-0" aria-hidden />
        )}

        <div className="min-w-0">
          <p
            className={`text-[13.5px] ${unread ? "font-bold text-text-strong" : "font-medium text-text-medium"}`}
          >
            {item.title}
          </p>
          <p className="mt-0.5 truncate text-[12.5px] text-text-subtle">{item.body}</p>
          <p className="mt-1 text-[11px] text-text-subtle">
            {formatThaiDateTime(item.createdAt, "short")}
          </p>
        </div>
      </div>
    </>
  )

  if (!item.href) return <div className="px-4 py-3">{content}</div>

  return (
    <Link href={item.href} onClick={onOpen} className="block px-4 py-3 hover:bg-muted">
      {content}
    </Link>
  )
}
