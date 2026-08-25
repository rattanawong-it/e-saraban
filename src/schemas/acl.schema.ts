import { z } from "zod"

// สิทธิ์เฉพาะรายบนเอกสารหนึ่งฉบับ (spec §9.1 · §4.3 ข้อ 5)
//
// ชุดสิทธิ์เป็นแบบ "หยาบ" สี่ระดับ ไม่ใช่ permission ระดับแอป เพราะคนที่ให้สิทธิ์
// คือเจ้าของเรื่อง ไม่ใช่ผู้ดูแลระบบ — ต้องเลือกได้โดยไม่ต้องรู้จักชื่อ permission

export const ACL_PERMISSIONS = ["VIEW", "DOWNLOAD", "EDIT", "MANAGE"] as const
export const ACL_EFFECTS = ["ALLOW", "DENY"] as const

export type AclPermissionValue = (typeof ACL_PERMISSIONS)[number]
export type AclEffectValue = (typeof ACL_EFFECTS)[number]

export const grantAclSchema = z.object({
  documentId: z.string().min(1),
  /** ตอนนี้ให้สิทธิ์ได้เฉพาะรายบุคคล — ดูเหตุผลที่ acl.service.ts */
  userId: z.string().min(1, "กรุณาเลือกผู้ที่จะได้รับสิทธิ์"),
  permission: z.enum(ACL_PERMISSIONS),
  effect: z.enum(ACL_EFFECTS).default("ALLOW"),
  /** ไม่ระบุ = ไม่มีวันหมดอายุ */
  expiresAt: z.coerce.date().optional(),
  /** บังคับกรอก — สิทธิ์พิเศษที่ไม่มีเหตุผลกำกับคือสิ่งที่ผู้ตรวจสอบตามไม่ได้ */
  reason: z.string().trim().min(1, "กรุณาระบุเหตุผลที่ให้สิทธิ์").max(500),
})

export type GrantAclInput = z.infer<typeof grantAclSchema>

export const revokeAclSchema = z.object({
  aclId: z.string().min(1),
  documentId: z.string().min(1),
})

export type RevokeAclInput = z.infer<typeof revokeAclSchema>
