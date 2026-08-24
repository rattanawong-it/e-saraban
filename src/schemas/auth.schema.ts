import { z } from "zod"

// ข้อความ error เป็นภาษาไทยตั้งแต่ระดับ schema
// เพราะ Server Action ส่งผลลัพธ์กลับไปแสดงบนฟอร์มโดยตรง (spec §12)

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "ชื่อผู้ใช้ต้องยาวอย่างน้อย 3 ตัวอักษร")
  .max(50, "ชื่อผู้ใช้ยาวเกินไป")
  .regex(/^[a-zA-Z0-9._-]+$/, "ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 จุด ขีดล่าง และขีดกลาง")

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
  remember: z.boolean().default(false),
})

export type LoginInput = z.infer<typeof loginSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน"),
    newPassword: z.string().min(1, "กรุณากรอกรหัสผ่านใหม่"),
    confirmPassword: z.string().min(1, "กรุณายืนยันรหัสผ่านใหม่"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม",
    path: ["newPassword"],
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("รูปแบบอีเมลไม่ถูกต้อง"),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const registerSchema = z
  .object({
    prefix: z.string().trim().max(30).optional(),
    firstName: z.string().trim().min(1, "กรุณากรอกชื่อ").max(100),
    lastName: z.string().trim().min(1, "กรุณากรอกนามสกุล").max(100),
    email: z.string().trim().email("รูปแบบอีเมลไม่ถูกต้อง"),
    username: usernameSchema,
    orgUnitId: z.string().min(1, "กรุณาเลือกหน่วยงานที่สังกัด"),
    positionTitle: z.string().trim().max(120).optional(),
    password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
    confirmPassword: z.string().min(1, "กรุณายืนยันรหัสผ่าน"),
    note: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "รหัสผ่านทั้งสองช่องไม่ตรงกัน",
    path: ["confirmPassword"],
  })

export type RegisterInput = z.infer<typeof registerSchema>

export const switchContextSchema = z.object({
  orgUnitId: z.string().min(1, "กรุณาเลือกหน่วยงาน"),
})
