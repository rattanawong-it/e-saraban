"use server"

import { revalidatePath } from "next/cache"

import { AUDIT_ENTITY_TYPES } from "@/lib/audit"

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationView,
} from "../services/notification.service"
import { requireSession } from "../session"
import { toActionError } from "./helpers"
import { successState, type ActionState } from "./types"

// การแจ้งเตือน in-app (D10)
// ตรวจ auth → เรียก service → revalidate · ห้ามมี logic ที่นี่ (spec §11.3 ข้อ 1)
//
// ⚠️ ไม่มี action ไหนรับ userId จากฝั่ง client เลย — ทุกตัวใช้ `session.ctx.userId`
// เท่านั้น ไม่งั้นใครก็สั่งอ่านหรือมาร์คแจ้งเตือนของคนอื่นได้

/** ดึงรายการมาแสดงตอนกดเปิดกระดิ่ง — ไม่ดึงมาพร้อมหน้าเพราะส่วนใหญ่ผู้ใช้ไม่กด */
export async function loadNotificationsAction(): Promise<ActionState<NotificationView[]>> {
  const session = await requireSession()

  try {
    const items = await listNotifications(session.ctx, { limit: 10 })
    return successState(undefined, items)
  } catch (error) {
    return toActionError<NotificationView[]>(error, {
      ctx: session.ctx,
      action: "notification.list",
      entityType: AUDIT_ENTITY_TYPES.USER,
    })
  }
}

export async function markNotificationReadAction(id: string): Promise<ActionState> {
  const session = await requireSession()

  try {
    await markNotificationRead(session.ctx, id)

    // ตัวเลขบนกระดิ่ง render ฝั่ง server ใน layout — ต้องสั่ง revalidate ทั้ง layout
    revalidatePath("/", "layout")
    return successState()
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "notification.read",
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: id,
    })
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionState> {
  const session = await requireSession()

  try {
    const count = await markAllNotificationsRead(session.ctx)

    revalidatePath("/", "layout")
    return successState(`ทำเครื่องหมายว่าอ่านแล้ว ${count} รายการ`)
  } catch (error) {
    return toActionError(error, {
      ctx: session.ctx,
      action: "notification.read.all",
      entityType: AUDIT_ENTITY_TYPES.USER,
    })
  }
}
