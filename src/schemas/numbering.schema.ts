import { z } from "zod"

// ค่าที่มาจากฟอร์ม /admin/numbering
//
// pattern ว่าง = "ใช้ค่าที่สูงกว่าขึ้นไป" ไม่ใช่ "ห้ามออกเลข"
// ลำดับการตกทอดคือ ทะเบียนของหน่วยงาน → ประเภทหนังสือ → ค่าปริยายของระบบ (D16)
// จึงรับสตริงว่างได้ แล้วให้ service แปลงเป็น null

const patternField = z
  .string()
  .trim()
  .max(120, "รูปแบบยาวเกินไป")
  .optional()
  .transform((value) => value || null)

export const updateTypePatternSchema = z.object({
  documentTypeId: z.string().min(1),
  numberPattern: patternField,
})

export type UpdateTypePatternInput = z.infer<typeof updateTypePatternSchema>

export const updateSequencePatternSchema = z.object({
  sequenceId: z.string().min(1),
  patternOverride: patternField,
})

export type UpdateSequencePatternInput = z.infer<typeof updateSequencePatternSchema>
