import { z } from "zod"

// ค่าคงที่และ schema ฝั่งเอกสาร (spec §6 · §9.1)
//
// ประกาศชุดค่าไว้ที่นี่ที่เดียวแล้วให้ทั้ง state machine · service · UI อ้างจากตรงนี้
// เพื่อไม่ให้มี enum สองชุดที่ค่อย ๆ เลื่อนออกจากกัน

export const DOCUMENT_DIRECTIONS = ["INTERNAL", "OUTGOING", "INCOMING"] as const
export type DocumentDirectionValue = (typeof DOCUMENT_DIRECTIONS)[number]

export const DOCUMENT_STATUSES = [
  "DRAFT",
  "PENDING_NUMBER",
  "RETURNED",
  "REGISTERED",
  "CIRCULATING",
  "SENT",
  "RECEIVED",
  "FORWARDED",
  "CLOSED",
  "CANCELLED",
] as const
export type DocumentStatusValue = (typeof DOCUMENT_STATUSES)[number]

export const DOCUMENT_ACTION_TYPES = [
  "CREATED",
  "UPDATED",
  "SUBMITTED",
  "RETURNED",
  "NUMBER_ISSUED",
  "CIRCULATED",
  "ACKNOWLEDGED",
  "MARKED_SENT",
  "FORWARDED",
  "CLOSED",
  "CANCELLED",
  "ATTACHMENT_ADDED",
  "ATTACHMENT_REMOVED",
] as const
export type DocumentActionTypeValue = (typeof DOCUMENT_ACTION_TYPES)[number]

export const RECIPIENT_KINDS = ["TO", "CC", "FYI"] as const
export type RecipientKindValue = (typeof RECIPIENT_KINDS)[number]

export const RECIPIENT_STATUSES = ["PENDING", "SENT", "READ", "ACKNOWLEDGED"] as const
export type RecipientStatusValue = (typeof RECIPIENT_STATUSES)[number]

export const DIRECTION_LABELS: Record<DocumentDirectionValue, string> = {
  INTERNAL: "บันทึกข้อความภายใน",
  OUTGOING: "หนังสือส่งภายนอก",
  INCOMING: "หนังสือรับ",
}

export const STATUS_LABELS: Record<DocumentStatusValue, string> = {
  DRAFT: "ร่าง",
  PENDING_NUMBER: "รอออกเลข",
  RETURNED: "ตีกลับให้แก้ไข",
  REGISTERED: "ออกเลขแล้ว",
  CIRCULATING: "อยู่ระหว่างเวียน",
  SENT: "ส่งออกแล้ว",
  RECEIVED: "ลงทะเบียนรับแล้ว",
  FORWARDED: "ส่งต่อแล้ว",
  CLOSED: "ปิดเรื่อง",
  CANCELLED: "ยกเลิก",
}

export const ACTION_LABELS: Record<DocumentActionTypeValue, string> = {
  CREATED: "สร้างเอกสาร",
  UPDATED: "แก้ไขเอกสาร",
  SUBMITTED: "ส่งให้สารบรรณออกเลข",
  RETURNED: "ตีกลับให้แก้ไข",
  NUMBER_ISSUED: "ออกเลขทะเบียน",
  CIRCULATED: "เวียนหนังสือ",
  ACKNOWLEDGED: "รับทราบ",
  MARKED_SENT: "บันทึกว่าส่งออกแล้ว",
  FORWARDED: "ส่งต่อหน่วยงาน",
  CLOSED: "ปิดเรื่อง",
  CANCELLED: "ยกเลิกเอกสาร",
  ATTACHMENT_ADDED: "แนบไฟล์",
  ATTACHMENT_REMOVED: "ลบไฟล์แนบ",
}

export const RECIPIENT_KIND_LABELS: Record<RecipientKindValue, string> = {
  TO: "เรียน",
  CC: "สำเนาถึง",
  FYI: "เพื่อทราบ",
}

/** ผู้รับหนึ่งราย — เป็นหน่วยงานหรือบุคคลอย่างใดอย่างหนึ่ง (CHECK constraint บังคับในฐานข้อมูล) */
export const recipientSchema = z
  .object({
    orgUnitId: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
    kind: z.enum(RECIPIENT_KINDS).default("TO"),
  })
  .refine((data) => Boolean(data.orgUnitId) !== Boolean(data.userId), {
    message: "ผู้รับต้องเป็นหน่วยงานหรือบุคคลอย่างใดอย่างหนึ่ง",
  })

const baseDocumentFields = {
  documentTypeId: z.string().min(1, "กรุณาเลือกประเภทหนังสือ"),
  subject: z.string().trim().min(1, "กรุณากรอกชื่อเรื่อง").max(500, "ชื่อเรื่องยาวเกินไป"),
  summary: z.string().trim().max(2000).optional(),
  docDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  confidentialityLevel: z.coerce.number().int().min(0).max(3).default(0),
  urgencyLevel: z.coerce.number().int().min(0).max(3).default(0),
  externalSenderName: z.string().trim().max(200).optional(),
  externalRecipientName: z.string().trim().max(200).optional(),
  refDocNo: z.string().trim().max(100).optional(),
  parentDocumentId: z.string().min(1).optional(),
}

export const createDocumentSchema = z.object({
  ...baseDocumentFields,
  /** ว่างไว้ = ใช้หน่วยงานที่กำลังทำงานอยู่ (activeOrgUnitId) */
  ownerUnitId: z.string().min(1).optional(),
  recipients: z.array(recipientSchema).default([]),
})

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>

export const updateDocumentSchema = z.object({
  id: z.string().min(1),
  ...baseDocumentFields,
})

export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>

/** ลงทะเบียนหนังสือรับ (A1) — ออกเลขรับทันทีในขั้นตอนเดียว */
export const registerIncomingSchema = z.object({
  ...baseDocumentFields,
  ownerUnitId: z.string().min(1).optional(),
  receivedDate: z.coerce.date().optional(),
  externalSenderName: z.string().trim().min(1, "กรุณากรอกชื่อหน่วยงานผู้ส่ง").max(200),
})

export type RegisterIncomingInput = z.infer<typeof registerIncomingSchema>

export const documentNoteSchema = z.object({
  id: z.string().min(1),
  note: z.string().trim().max(1000).optional(),
})

export const returnDocumentSchema = z.object({
  id: z.string().min(1),
  /** เหตุผลที่ตีกลับ — บังคับกรอก เพราะเป็น control แทนขั้นอนุมัติตาม A2 */
  note: z.string().trim().min(1, "กรุณาระบุเหตุผลที่ตีกลับ").max(1000),
})

export const circulateDocumentSchema = z.object({
  id: z.string().min(1),
  recipients: z.array(recipientSchema).min(1, "กรุณาเลือกผู้รับอย่างน้อยหนึ่งราย"),
  note: z.string().trim().max(1000).optional(),
})

export const forwardDocumentSchema = circulateDocumentSchema
