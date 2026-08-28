import { z } from "zod"

import { usernameSchema } from "./auth.schema"

export const clearanceLevelSchema = z.coerce
  .number()
  .int()
  .min(0, "ชั้นความลับต้องอยู่ระหว่าง 0–3")
  .max(3, "ชั้นความลับต้องอยู่ระหว่าง 0–3")

export const createUserSchema = z.object({
  prefix: z.string().trim().max(30).optional(),
  firstName: z.string().trim().min(1, "กรุณากรอกชื่อ").max(100),
  lastName: z.string().trim().min(1, "กรุณากรอกนามสกุล").max(100),
  username: usernameSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("รูปแบบอีเมลไม่ถูกต้อง")
    .optional()
    .or(z.literal("")),
  clearanceLevel: clearanceLevelSchema.default(0),

  // สังกัดแรกกำหนดตอนสร้างเลย — ผู้ใช้ที่ไม่มีสังกัดใช้งานอะไรไม่ได้
  orgUnitId: z.string().min(1, "กรุณาเลือกหน่วยงานที่สังกัด"),
  positionTitle: z.string().trim().max(120).optional(),
  roleCode: z.string().min(1, "กรุณาเลือกบทบาท"),
})

export type CreateUserInput = z.infer<typeof createUserSchema>

export const updateUserSchema = z.object({
  id: z.string().min(1),
  prefix: z.string().trim().max(30).optional(),
  firstName: z.string().trim().min(1, "กรุณากรอกชื่อ").max(100),
  lastName: z.string().trim().min(1, "กรุณากรอกนามสกุล").max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("รูปแบบอีเมลไม่ถูกต้อง")
    .optional()
    .or(z.literal("")),
  clearanceLevel: clearanceLevelSchema,
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>

export const addAffiliationSchema = z.object({
  userId: z.string().min(1),
  orgUnitId: z.string().min(1, "กรุณาเลือกหน่วยงาน"),
  positionTitle: z.string().trim().max(120).optional(),
  roleCode: z.string().min(1, "กรุณาเลือกบทบาท"),
  isPrimary: z.boolean().default(false),
})

export type AddAffiliationInput = z.infer<typeof addAffiliationSchema>

export const removeAffiliationSchema = z.object({
  userId: z.string().min(1),
  orgUnitId: z.string().min(1),
})

export const setUserActiveSchema = z.object({
  userId: z.string().min(1),
  isActive: z.boolean(),
})

export const resetPasswordSchema = z.object({
  userId: z.string().min(1),
})

export const reviewRegistrationSchema = z.object({
  requestId: z.string().min(1),
  approve: z.boolean(),
  roleCode: z.string().optional(),
  rejectReason: z.string().trim().max(300).optional(),
})

export type ReviewRegistrationInput = z.infer<typeof reviewRegistrationSchema>
