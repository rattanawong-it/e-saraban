import { z } from "zod"

const ORG_UNIT_TYPES = [
  "UNIVERSITY",
  "FACULTY",
  "OFFICE",
  "DIVISION",
  "DEPARTMENT",
  "CENTER",
  "SECTION",
] as const

export const orgUnitTypeSchema = z.enum(ORG_UNIT_TYPES)

export type OrgUnitTypeValue = z.infer<typeof orgUnitTypeSchema>

/** ป้ายไทยของประเภทหน่วยงาน (spec §5.1) */
export const ORG_UNIT_TYPE_LABELS: Record<OrgUnitTypeValue, string> = {
  UNIVERSITY: "มหาวิทยาลัย / สถาบัน",
  FACULTY: "คณะ",
  OFFICE: "สำนัก / สำนักงาน",
  DIVISION: "กอง",
  DEPARTMENT: "ภาควิชา",
  CENTER: "ศูนย์",
  SECTION: "งาน / ฝ่าย",
}

export const createOrgUnitSchema = z.object({
  parentId: z.string().nullable().optional(),
  code: z.string().trim().min(1, "กรุณากรอกรหัสหนังสือของหน่วยงาน").max(50, "รหัสหนังสือยาวเกินไป"),
  nameTh: z.string().trim().min(1, "กรุณากรอกชื่อหน่วยงาน").max(200),
  shortName: z.string().trim().max(30, "ชื่อย่อยาวเกินไป").optional(),
  type: orgUnitTypeSchema,
  headUserId: z.string().nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
})

export type CreateOrgUnitInput = z.infer<typeof createOrgUnitSchema>

export const updateOrgUnitSchema = createOrgUnitSchema.extend({
  id: z.string().min(1),
})

export type UpdateOrgUnitInput = z.infer<typeof updateOrgUnitSchema>

export const moveOrgUnitSchema = z.object({
  id: z.string().min(1),
  newParentId: z.string().nullable(),
})

export const archiveOrgUnitSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean(),
})
