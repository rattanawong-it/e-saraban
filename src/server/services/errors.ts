import "server-only"

import {
  can,
  denyReasonLabel,
  type AuthzResource,
  type CanOptions,
  type Permission,
} from "@/lib/authz"

import type { ServiceContext } from "../context"

// ข้อผิดพลาดของชั้น service — ข้อความเป็นไทยพร้อมแสดงให้ผู้ใช้เห็นได้เลย
//
// แยกเป็นคลาสเดียวแทนการโยน Error ดิบ เพื่อให้ Server Action แยกได้ว่า
// "ข้อผิดพลาดที่คาดไว้" (แสดงข้อความ) ต่างจาก "บั๊ก" (ต้องขึ้นหน้า error)

export type ServiceErrorCode = "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION" | "RATE_LIMIT"

export class ServiceError extends Error {
  readonly code: ServiceErrorCode

  constructor(message: string, code: ServiceErrorCode = "VALIDATION") {
    super(message)
    this.name = "ServiceError"
    this.code = code
  }
}

export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError
}

/**
 * ตรวจสิทธิ์ที่ชั้น service (spec §11.3 ข้อ 2) — ไม่ผ่านแล้วโยนทันที
 *
 * ⚠️ ต้องเรียกทุก service method ที่เปลี่ยนแปลงข้อมูล **แม้ UI จะซ่อนปุ่มไปแล้ว**
 * เพราะ Server Action ถูกเรียกตรงจากภายนอกได้
 */
export function assertPermission(
  ctx: ServiceContext,
  permission: Permission,
  resource?: AuthzResource,
  options?: CanOptions,
): void {
  const result = can(ctx, permission, resource, options)

  if (!result.allowed) {
    throw new ServiceError(denyReasonLabel(result.reason), "FORBIDDEN")
  }
}
