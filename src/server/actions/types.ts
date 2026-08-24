import type { ZodError } from "zod"

// รูปแบบผลลัพธ์มาตรฐานของ Server Action ทุกตัว
//
// ใช้กับ `useActionState` ของ React 19 — ฟอร์มส่งข้อมูลแล้วได้ state กลับมา
// โดยไม่ต้องมี state ฝั่ง client เอง และยังทำงานได้แม้ JavaScript ปิดอยู่
//
// spec §11.3 ข้อ 1: "Action ทำแค่ ตรวจ auth → validate ด้วย Zod → เรียก service → revalidate"
// **ห้ามมี business logic ใน action**

export interface ActionState<TData = undefined> {
  status: "idle" | "success" | "error"
  message?: string
  /** error รายฟิลด์จาก Zod — key คือชื่อฟิลด์ในฟอร์ม */
  fieldErrors?: Record<string, string[]>
  data?: TData
}

export const IDLE_STATE: ActionState = { status: "idle" }

export function successState<T>(message?: string, data?: T): ActionState<T> {
  return { status: "success", message, data }
}

export function errorState<TData = undefined>(
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionState<TData> {
  return { status: "error", message, fieldErrors }
}

/** แปลง ZodError เป็น fieldErrors ที่ฟอร์มเอาไปแสดงใต้ช่องกรอกได้ทันที */
export function zodErrorState<TData = undefined>(error: ZodError): ActionState<TData> {
  const fieldErrors: Record<string, string[]> = {}

  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form"
    const list = fieldErrors[key] ?? []
    list.push(issue.message)
    fieldErrors[key] = list
  }

  const first = error.issues[0]?.message ?? "ข้อมูลที่กรอกไม่ถูกต้อง"
  return { status: "error", message: first, fieldErrors }
}
