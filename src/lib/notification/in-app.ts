import "server-only"

import { prisma } from "@/lib/db"

import type { NotificationAdapter, NotificationChannel, NotificationMessage } from "./types"

// การแจ้งเตือนในระบบ (D10 · spec §11.2) — เขียนลงตาราง `notifications` แล้วให้กระดิ่งอ่านเอง
//
// ⚠️ **กลืน error ทุกกรณีโดยตั้งใจ** ตามที่ NotificationAdapter เขียนกำกับไว้
// การแจ้งเตือนพลาดต้องไม่ทำให้การออกเลข/เวียนหนังสือที่สำเร็จไปแล้วล้มตาม —
// เลขทะเบียนที่ออกไปแล้วถอนคืนไม่ได้ตาม §6.4 การ rollback เพราะกระดิ่งไม่ดังจึงแย่กว่ามาก
//
// ตัวเรียกต้องเรียก **หลัง transaction commit แล้วเท่านั้น** ไม่ใช่ข้างใน —
// ถ้าเขียนอยู่ในทรานแซกชันเดียวกัน error ของแถวแจ้งเตือนจะลาก business operation ล้มด้วย
// ซึ่งเป็นสิ่งที่ทั้งไฟล์นี้พยายามกันอยู่

export class InAppNotificationAdapter implements NotificationAdapter {
  readonly channel: NotificationChannel = "IN_APP"

  async send(message: NotificationMessage): Promise<void> {
    await this.sendMany([message])
  }

  async sendMany(messages: NotificationMessage[]): Promise<void> {
    if (messages.length === 0) return

    try {
      // createMany รอบเดียว — หนังสือเวียนหนึ่งฉบับมีผู้รับได้หลายสิบคน
      await prisma.notification.createMany({
        data: messages.map((message) => ({
          userId: message.recipientUserId,
          type: message.type,
          title: message.title,
          body: message.body,
          refType: message.refType ?? null,
          refId: message.refId ?? null,
        })),
      })
    } catch (error) {
      // ไม่ throw ต่อ — แต่ต้องเห็นในล็อกว่าใครไม่ได้รับแจ้งเตือนและเพราะอะไร
      console.error("[notification] เขียนแจ้งเตือน in-app ไม่สำเร็จ", {
        count: messages.length,
        types: [...new Set(messages.map((message) => message.type))],
        error,
      })
    }
  }
}

/** ตัวที่ระบบใช้จริง — เปลี่ยนช่องทางทีหลังให้เปลี่ยนที่นี่ที่เดียว */
export const notifier: NotificationAdapter = new InAppNotificationAdapter()
