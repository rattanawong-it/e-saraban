// NotificationAdapter — spec §11.3 ข้อ 3 บังคับให้เป็น interface **ตั้งแต่วันแรก**
// เพื่อให้เพิ่มช่องทาง Email / LINE ภายหลังได้โดยไม่แตะ business logic
//
// MVP ทำเฉพาะ in-app (spec §13 · P5) — ช่องทางอื่นเป็น Post-MVP

/** ช่องทางส่ง — MVP ใช้ IN_APP อย่างเดียว ที่เหลือเผื่ออนาคต */
export const NOTIFICATION_CHANNELS = ["IN_APP", "EMAIL", "LINE"] as const

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export interface NotificationMessage {
  /** ผู้รับ — ระบุเป็น user เสมอ ไม่ใช่หน่วยงาน (หน่วยงานต้องถูกกระจายก่อนถึงชั้นนี้) */
  recipientUserId: string
  title: string
  body: string
  /** ลิงก์ภายในระบบ เช่น `/documents/[id]` — ไม่ใช่ URL เต็ม */
  href?: string
}

export interface NotificationAdapter {
  readonly channel: NotificationChannel

  /**
   * ส่งการแจ้งเตือน
   *
   * ⚠️ ห้าม throw ให้ business operation ล้มตาม — การแจ้งเตือนพลาด
   * ต้องไม่ทำให้การออกเลข/เวียนหนังสือที่สำเร็จไปแล้วถูก rollback
   */
  send(message: NotificationMessage): Promise<void>
}
