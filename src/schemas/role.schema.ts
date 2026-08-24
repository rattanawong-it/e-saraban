import { z } from "zod"

import { PERMISSION_SCOPES } from "@/lib/authz/permissions"

export const permissionScopeSchema = z.enum(PERMISSION_SCOPES)

/**
 * บันทึกชุดสิทธิ์ของบทบาทหนึ่งทั้งชุด
 *
 * ส่งมาทั้งชุดเสมอ ไม่ใช่ diff — เพราะการถอดสิทธิ์ต้องมีผลจริง
 * ถ้าส่งเฉพาะที่ติ๊ก สิทธิ์ที่ถูกเอาออกจะค้างอยู่ในฐานข้อมูลเงียบ ๆ
 */
export const updateRolePermissionsSchema = z.object({
  roleId: z.string().min(1),
  permissions: z.array(
    z.object({
      code: z.string().min(1),
      scope: permissionScopeSchema,
    }),
  ),
})

export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>

export const updateRoleSchema = z.object({
  roleId: z.string().min(1),
  nameTh: z.string().trim().min(1, "กรุณากรอกชื่อบทบาท").max(100),
  description: z.string().trim().max(500).optional(),
})
