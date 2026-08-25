import type { AuthzAclEntry, AuthzResource } from "@/lib/authz"

// แปลงเอกสารที่โหลดมาแล้วให้เป็น resource ที่ can() รับได้ (spec §4.3)
//
// ⚠️ ต้องมีที่เดียว เพราะถ้าที่ไหนลืมส่ง recipients หรือ acl เข้าไป
// can() จะตัดสินจากข้อมูลไม่ครบ แล้วปฏิเสธ (หรืออนุญาต) แบบเงียบ ๆ
//
// รับพารามิเตอร์แบบโครงสร้าง ไม่ผูกกับชนิดของ Prisma ตัวใดตัวหนึ่ง
// เพราะทั้ง service และหน้าเว็บโหลดเอกสารมาคนละ include กัน

export interface AuthzDocumentLike {
  ownerUnitId: string
  ownerUnit: { path: string }
  createdById: string
  confidentialityLevel: number
  status: string
  recipients: readonly { orgUnitId: string | null; userId: string | null }[]
  acls: readonly AuthzAclEntry[]
}

export function toAuthzResource(document: AuthzDocumentLike): AuthzResource {
  return {
    ownerUnitId: document.ownerUnitId,
    ownerUnitPath: document.ownerUnit.path,
    createdById: document.createdById,
    confidentialityLevel: document.confidentialityLevel,
    status: document.status,
    recipientUnitIds: document.recipients
      .map((recipient) => recipient.orgUnitId)
      .filter((value): value is string => value !== null),
    recipientUserIds: document.recipients
      .map((recipient) => recipient.userId)
      .filter((value): value is string => value !== null),
    acl: document.acls,
  }
}
