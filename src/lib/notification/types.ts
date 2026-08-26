// NotificationAdapter — spec §11.3 ข้อ 3 บังคับให้เป็น interface **ตั้งแต่วันแรก**
// เพื่อให้เพิ่มช่องทาง Email / LINE ภายหลังได้โดยไม่แตะ business logic
//
// MVP ทำเฉพาะ in-app (spec §13 · P5) — ช่องทางอื่นเป็น Post-MVP

/** ช่องทางส่ง — MVP ใช้ IN_APP อย่างเดียว ที่เหลือเผื่ออนาคต */
export const NOTIFICATION_CHANNELS = ["IN_APP", "EMAIL", "LINE"] as const

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

/**
 * ชนิดการแจ้งเตือน
 *
 * เก็บลงฐานเป็น String ไม่ใช่ enum ของ Postgres ตามแบบเดียวกับ `AuditLog.action`
 * — เพิ่มชนิดใหม่ภายหลังจะได้ไม่ต้องมี migration · ความปลอดภัยของชนิดคุมที่ TS ตรงนี้
 *
 * ⚠️ แจ้งเฉพาะเหตุการณ์ที่ **ผู้รับต้องลงมือทำอะไรต่อ** ไม่ใช่ทุก transition ที่เกิดขึ้น
 * กระดิ่งที่ดังทุกเรื่องคือกระดิ่งที่ทุกคนเลิกกด
 */
export const NOTIFICATION_TYPES = {
  /** มีหนังสือเวียนถึงคุณ (CIRCULATED / FORWARDED) → แจ้งผู้รับทุกคน */
  documentCirculated: "document.circulated",
  /** มีหนังสือรอออกเลข (SUBMITTED) → แจ้งสารบรรณของหน่วยงานที่ออกเลข */
  documentSubmitted: "document.submitted",
  /** หนังสือของคุณได้เลขแล้ว (NUMBER_ISSUED) → แจ้งเจ้าของเรื่อง */
  documentNumberIssued: "document.number_issued",
  /** หนังสือถูกตีกลับให้แก้ (RETURNED) → แจ้งเจ้าของเรื่อง */
  documentReturned: "document.returned",
  /** ปิดเรื่องแล้ว (CLOSED) → แจ้งเจ้าของเรื่อง */
  documentClosed: "document.closed",
} as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]

/** อ้างถึงอะไร — วันนี้มีแค่เอกสาร แต่เผื่อผูกกับอย่างอื่นได้โดยไม่ต้องแก้ตาราง */
export const NOTIFICATION_REF_TYPES = ["DOCUMENT"] as const

export type NotificationRefType = (typeof NOTIFICATION_REF_TYPES)[number]

export interface NotificationMessage {
  /** ผู้รับ — ระบุเป็น user เสมอ ไม่ใช่หน่วยงาน (หน่วยงานต้องถูกกระจายก่อนถึงชั้นนี้) */
  recipientUserId: string
  type: NotificationType

  /**
   * ข้อความที่ **ประกอบเสร็จแล้ว** ไม่ใช่ template ที่รอเติมค่า
   *
   * ⚠️ ห้ามใส่ชื่อเรื่องของเอกสารชั้น 1-3 ลงมา — ชื่อเรื่องของหนังสือลับคือตัวความลับเอง
   * (บทเรียน §22.2) · ผู้ประกอบข้อความมีหน้าที่ตัดสินเรื่องนี้ก่อนส่งมาถึงชั้นนี้
   */
  title: string
  body: string

  refType?: NotificationRefType
  refId?: string
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

  /**
   * ส่งหลายฉบับพร้อมกัน — หนังสือเวียนหนึ่งฉบับมีผู้รับได้หลายสิบคน
   *
   * แยกเมธอดไว้เพราะ adapter ที่คุยกับฐานข้อมูลหรือ API ภายนอกทำเป็นก้อนเดียว
   * ได้ถูกกว่าวนเรียก `send()` ทีละคน · ข้อห้าม throw เหมือนกัน
   */
  sendMany(messages: NotificationMessage[]): Promise<void>
}

/** ลิงก์ที่กระดิ่งพาไป — ประกอบตอน render ไม่เก็บลงฐาน เผื่อ route เปลี่ยนทีหลัง */
export function notificationHref(refType: string | null, refId: string | null): string | undefined {
  if (refType === "DOCUMENT" && refId) return `/documents/${refId}`
  return undefined
}
