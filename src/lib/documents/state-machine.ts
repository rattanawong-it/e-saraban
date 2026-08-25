import type {
  DocumentActionTypeValue,
  DocumentDirectionValue,
  DocumentStatusValue,
} from "@/schemas/document.schema"

// วงจรชีวิตเอกสาร (spec §6.1–6.3) — ตารางเดียวคุมทุกทิศทาง
//
// ⚠️ ข้อบังคับเดียวกับ can(): **ห้ามเขียนเงื่อนไขสถานะกระจายอยู่ใน service หรือ UI**
// ทุกการเปลี่ยนสถานะต้องผ่าน nextStatus() ในไฟล์นี้ ไม่งั้นวันหนึ่งจะมีเส้นทางลับ
// ที่พาเอกสารข้ามขั้นตอนไปโดยไม่มีใครรู้ — และทะเบียนที่ผิดแก้ย้อนหลังไม่ได้ (§6.4)
//
// ไฟล์นี้เป็นฟังก์ชันบริสุทธิ์ ไม่แตะฐานข้อมูล จึงเขียน unit test ครอบทุกคู่สถานะได้

/** การกระทำที่ "เปลี่ยนสถานะ" — CREATED/UPDATED/ATTACHMENT_* ไม่อยู่ในนี้เพราะไม่ย้ายสถานะ */
export type DocumentTransition = Extract<
  DocumentActionTypeValue,
  | "SUBMITTED"
  | "RETURNED"
  | "NUMBER_ISSUED"
  | "CIRCULATED"
  | "ACKNOWLEDGED"
  | "MARKED_SENT"
  | "FORWARDED"
  | "CLOSED"
  | "CANCELLED"
>

type TransitionTable = Record<
  DocumentDirectionValue,
  Partial<
    Record<DocumentTransition, { from: readonly DocumentStatusValue[]; to: DocumentStatusValue }>
  >
>

/**
 * ตารางการเปลี่ยนสถานะตาม spec §6.1–6.3
 *
 * หมายเหตุที่ต่างจากผังในสเปกเล็กน้อย:
 *   - §6.2 วาดว่า RETURNED → DRAFT แล้วค่อย submit ใหม่ · ที่นี่ให้ RETURNED submit ได้ตรง
 *     เพราะผลลัพธ์เหมือนกันแต่ผู้ใช้กดน้อยกว่าหนึ่งครั้ง และสถานะ RETURNED ยังแก้ไขได้อยู่แล้ว
 *   - หนังสือรับออกเลขตอนลงทะเบียน (§6.3 "สารบรรณลงทะเบียนรับ + ออกเลขรับ")
 *     NUMBER_ISSUED ของ INCOMING จึงไม่เปลี่ยนสถานะ — อยู่ที่ RECEIVED เหมือนเดิม
 */
const TRANSITIONS: TransitionTable = {
  INTERNAL: {
    SUBMITTED: { from: ["DRAFT", "RETURNED"], to: "PENDING_NUMBER" },
    RETURNED: { from: ["PENDING_NUMBER"], to: "RETURNED" },
    NUMBER_ISSUED: { from: ["PENDING_NUMBER"], to: "REGISTERED" },
    CIRCULATED: { from: ["REGISTERED"], to: "CIRCULATING" },
    ACKNOWLEDGED: { from: ["CIRCULATING"], to: "CLOSED" },
    CLOSED: { from: ["REGISTERED", "CIRCULATING"], to: "CLOSED" },
    CANCELLED: { from: ["DRAFT", "PENDING_NUMBER", "RETURNED", "REGISTERED"], to: "CANCELLED" },
  },
  OUTGOING: {
    SUBMITTED: { from: ["DRAFT", "RETURNED"], to: "PENDING_NUMBER" },
    RETURNED: { from: ["PENDING_NUMBER"], to: "RETURNED" },
    NUMBER_ISSUED: { from: ["PENDING_NUMBER"], to: "REGISTERED" },
    MARKED_SENT: { from: ["REGISTERED"], to: "SENT" },
    CLOSED: { from: ["SENT"], to: "CLOSED" },
    CANCELLED: { from: ["DRAFT", "PENDING_NUMBER", "RETURNED", "REGISTERED"], to: "CANCELLED" },
  },
  INCOMING: {
    NUMBER_ISSUED: { from: ["RECEIVED"], to: "RECEIVED" },
    FORWARDED: { from: ["RECEIVED"], to: "FORWARDED" },
    ACKNOWLEDGED: { from: ["FORWARDED"], to: "CLOSED" },
    CLOSED: { from: ["RECEIVED", "FORWARDED"], to: "CLOSED" },
    CANCELLED: { from: ["RECEIVED", "FORWARDED"], to: "CANCELLED" },
  },
}

/** สถานะที่ยังแก้ metadata และไฟล์แนบได้ (spec §6.4) */
export const EDITABLE_STATUSES: readonly DocumentStatusValue[] = ["DRAFT", "RETURNED"]

/** สถานะที่ถือว่า "ออกเลขไปแล้ว" — ห้ามลบ ห้ามแก้เลข/วันที่/ชื่อเรื่อง (spec §6.4) */
export const NUMBERED_STATUSES: readonly DocumentStatusValue[] = [
  "REGISTERED",
  "CIRCULATING",
  "SENT",
  "RECEIVED",
  "FORWARDED",
  "CLOSED",
]

/** สถานะปลายทางที่ทำอะไรต่อไม่ได้แล้ว */
export const TERMINAL_STATUSES: readonly DocumentStatusValue[] = ["CLOSED", "CANCELLED"]

/** สถานะตั้งต้นของเอกสารใหม่ — หนังสือรับเริ่มที่ RECEIVED เพราะลงทะเบียนพร้อมออกเลขเลย */
export function initialStatus(direction: DocumentDirectionValue): DocumentStatusValue {
  return direction === "INCOMING" ? "RECEIVED" : "DRAFT"
}

export function isEditable(status: DocumentStatusValue): boolean {
  return EDITABLE_STATUSES.includes(status)
}

export function isNumbered(status: DocumentStatusValue): boolean {
  return NUMBERED_STATUSES.includes(status)
}

export function isTerminal(status: DocumentStatusValue): boolean {
  return TERMINAL_STATUSES.includes(status)
}

/** สถานะปลายทางของ transition นี้ · `null` = ทำจากสถานะปัจจุบันไม่ได้ */
export function nextStatus(
  direction: DocumentDirectionValue,
  transition: DocumentTransition,
  from: DocumentStatusValue,
): DocumentStatusValue | null {
  const rule = TRANSITIONS[direction][transition]
  if (!rule) return null

  return rule.from.includes(from) ? rule.to : null
}

export function canTransition(
  direction: DocumentDirectionValue,
  transition: DocumentTransition,
  from: DocumentStatusValue,
): boolean {
  return nextStatus(direction, transition, from) !== null
}

/** สถานะที่เริ่ม transition นี้ได้ — ส่งต่อให้ด่าน STATE ของ can() (spec §4.3) */
export function allowedFromStatuses(
  direction: DocumentDirectionValue,
  transition: DocumentTransition,
): readonly DocumentStatusValue[] {
  return TRANSITIONS[direction][transition]?.from ?? []
}

/**
 * ออกเลขได้หรือไม่ — **สถานะอย่างเดียวตอบไม่ได้**
 *
 * หนังสือรับอยู่ที่ `RECEIVED` ทั้งก่อนและหลังออกเลข (§6.3) ตาราง transition
 * จึงยอมให้ `NUMBER_ISSUED` ซ้ำได้ไม่รู้จบ · ตัวที่บอกความจริงคือ "มีเลขแล้วหรือยัง"
 *
 * ⚠️ ออกเลขทับของเดิม = เลขเดิมหายจากทะเบียนโดยไม่มีเอกสารถือไว้ ซึ่ง §6.4
 * ระบุว่าเป็นสัญญาณของการทุจริต · เงื่อนไขนี้ต้องอยู่ที่นี่ที่เดียวเหมือน transition อื่น
 */
export function canIssueNumber(
  direction: DocumentDirectionValue,
  status: DocumentStatusValue,
  docNo: string | null,
): boolean {
  if (docNo !== null) return false

  return canTransition(direction, "NUMBER_ISSUED", status)
}

/** ทุก transition ที่ทำได้จากสถานะนี้ — UI ใช้ตัดสินว่าจะโชว์ปุ่มอะไร */
export function availableTransitions(
  direction: DocumentDirectionValue,
  from: DocumentStatusValue,
): DocumentTransition[] {
  return Object.entries(TRANSITIONS[direction])
    .filter(([, rule]) => rule.from.includes(from))
    .map(([transition]) => transition as DocumentTransition)
}
