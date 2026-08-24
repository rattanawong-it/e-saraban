import "server-only"

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, writeAuditStandalone } from "@/lib/audit"

import type { ServiceContext } from "../context"
import { isServiceError } from "../services/errors"
import { errorState, type ActionState } from "./types"

// ตัวช่วยที่ใช้ร่วมกันในทุก Server Action
//
// หน้าที่สำคัญที่สุด: เมื่อ service ปฏิเสธด้วยเหตุผลด้านสิทธิ์
// ต้อง **เขียน audit ผลลัพธ์ DENY เสมอ** ตาม spec §8.5
// ("การเข้าถึงที่ถูกปฏิเสธ — สำคัญที่สุดสำหรับตรวจจับการพยายามบุกรุก")

export async function toActionError<TData = undefined>(
  error: unknown,
  context?: { ctx: ServiceContext; action: string; entityType?: string; entityId?: string },
): Promise<ActionState<TData>> {
  if (isServiceError(error)) {
    if (context && error.code === "FORBIDDEN") {
      await writeAuditStandalone({
        tenantId: context.ctx.tenantId,
        action: AUDIT_ACTIONS.ACCESS_DENIED,
        entityType: (context.entityType ?? AUDIT_ENTITY_TYPES.USER) as never,
        entityId: context.entityId ?? null,
        actorUserId: context.ctx.userId,
        actorOrgUnitId: context.ctx.activeOrgUnitId,
        sessionId: context.ctx.sessionId,
        ip: context.ctx.ip,
        userAgent: context.ctx.userAgent,
        result: "DENY",
        severity: "WARNING",
        metadata: { attemptedAction: context.action, reason: error.message },
      })
    }

    return errorState<TData>(error.message)
  }

  // ไม่ใช่ข้อผิดพลาดที่คาดไว้ = บั๊ก — log ไว้ให้ผู้ดูแลเห็นใน console ของ server
  // แต่ไม่ส่งรายละเอียดกลับไปฝั่ง client เพราะอาจมีข้อมูลภายในหลุดออกไป
  console.error("[server action] ข้อผิดพลาดที่ไม่ได้คาดไว้:", error)
  return errorState<TData>("เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง")
}

/** อ่านค่า checkbox จาก FormData — HTML ส่งมาเฉพาะตอนติ๊กเท่านั้น */
export function readCheckbox(formData: FormData, name: string): boolean {
  const value = formData.get(name)
  return value === "on" || value === "true" || value === "1"
}

/** อ่านค่า string จาก FormData แบบตัดช่องว่างหัวท้าย */
export function readString(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === "string" ? value.trim() : ""
}

/** อ่านค่า string ที่อาจไม่มี — คืน undefined เมื่อว่าง เพื่อให้ Zod `.optional()` ทำงาน */
export function readOptionalString(formData: FormData, name: string): string | undefined {
  const value = readString(formData, name)
  return value === "" ? undefined : value
}
