import { describe, expect, it } from "vitest"

import { DOCUMENT_STATUSES, type DocumentStatusValue } from "@/schemas/document.schema"

import {
  availableTransitions,
  canIssueNumber,
  allowedFromStatuses,
  canTransition,
  initialStatus,
  isEditable,
  isNumbered,
  isTerminal,
  nextStatus,
  type DocumentTransition,
} from "./state-machine"

// spec §14 กำหนดให้ทดสอบว่า "state machine ปฏิเสธ transition ที่ผิด"
// ชุดนี้จึงไล่ทั้งเส้นทางที่ถูกและกวาดทุกคู่ (สถานะ × transition) ที่ต้องถูกปฏิเสธ

describe("บันทึกข้อความภายใน (spec §6.1)", () => {
  it("เดินครบเส้นทางหลัก: ร่าง → รอออกเลข → ออกเลข → เวียน → ปิดเรื่อง", () => {
    expect(nextStatus("INTERNAL", "SUBMITTED", "DRAFT")).toBe("PENDING_NUMBER")
    expect(nextStatus("INTERNAL", "NUMBER_ISSUED", "PENDING_NUMBER")).toBe("REGISTERED")
    expect(nextStatus("INTERNAL", "CIRCULATED", "REGISTERED")).toBe("CIRCULATING")
    expect(nextStatus("INTERNAL", "ACKNOWLEDGED", "CIRCULATING")).toBe("CLOSED")
  })

  it("ตีกลับแล้วส่งใหม่ได้", () => {
    expect(nextStatus("INTERNAL", "RETURNED", "PENDING_NUMBER")).toBe("RETURNED")
    expect(nextStatus("INTERNAL", "SUBMITTED", "RETURNED")).toBe("PENDING_NUMBER")
  })

  it("ยกเลิกหลังออกเลขได้ — เลขที่ออกไปแล้วถูกจองไว้ ไม่นำกลับมาใช้ซ้ำ (§6.4)", () => {
    expect(nextStatus("INTERNAL", "CANCELLED", "REGISTERED")).toBe("CANCELLED")
  })

  it("ข้ามขั้นไม่ได้ — ร่างออกเลขเองไม่ได้ ต้องส่งให้สารบรรณก่อน", () => {
    expect(nextStatus("INTERNAL", "NUMBER_ISSUED", "DRAFT")).toBeNull()
    expect(nextStatus("INTERNAL", "CIRCULATED", "PENDING_NUMBER")).toBeNull()
  })
})

describe("หนังสือส่งภายนอก (spec §6.2)", () => {
  it("เดินครบเส้นทาง: ร่าง → รอออกเลข → ออกเลข → ส่งออก → ปิดเรื่อง", () => {
    expect(nextStatus("OUTGOING", "SUBMITTED", "DRAFT")).toBe("PENDING_NUMBER")
    expect(nextStatus("OUTGOING", "NUMBER_ISSUED", "PENDING_NUMBER")).toBe("REGISTERED")
    expect(nextStatus("OUTGOING", "MARKED_SENT", "REGISTERED")).toBe("SENT")
    expect(nextStatus("OUTGOING", "CLOSED", "SENT")).toBe("CLOSED")
  })

  it("หนังสือส่งภายนอกไม่มีขั้นเวียน", () => {
    expect(canTransition("OUTGOING", "CIRCULATED", "REGISTERED")).toBe(false)
  })

  it("ยังไม่ออกเลขจะบันทึกว่าส่งออกแล้วไม่ได้", () => {
    expect(nextStatus("OUTGOING", "MARKED_SENT", "PENDING_NUMBER")).toBeNull()
  })
})

describe("หนังสือรับ (spec §6.3 · A1)", () => {
  it("เริ่มที่ RECEIVED เพราะลงทะเบียนพร้อมออกเลขรับในขั้นตอนเดียว", () => {
    expect(initialStatus("INCOMING")).toBe("RECEIVED")
    expect(initialStatus("INTERNAL")).toBe("DRAFT")
    expect(initialStatus("OUTGOING")).toBe("DRAFT")
  })

  it("ออกเลขรับแล้วสถานะยังเป็น RECEIVED", () => {
    expect(nextStatus("INCOMING", "NUMBER_ISSUED", "RECEIVED")).toBe("RECEIVED")
  })

  it("ส่งต่อ → รับทราบ → ปิดเรื่อง", () => {
    expect(nextStatus("INCOMING", "FORWARDED", "RECEIVED")).toBe("FORWARDED")
    expect(nextStatus("INCOMING", "ACKNOWLEDGED", "FORWARDED")).toBe("CLOSED")
  })

  it("หนังสือรับไม่มีขั้นร่างและไม่มีการส่งให้ออกเลข", () => {
    expect(canTransition("INCOMING", "SUBMITTED", "DRAFT")).toBe(false)
    expect(canTransition("INCOMING", "MARKED_SENT", "RECEIVED")).toBe(false)
  })
})

describe("กติกาที่ใช้ร่วมกันทุกทิศทาง (spec §6.4)", () => {
  it("แก้ไขได้เฉพาะร่างกับที่ถูกตีกลับ", () => {
    expect(isEditable("DRAFT")).toBe(true)
    expect(isEditable("RETURNED")).toBe(true)
    expect(isEditable("PENDING_NUMBER")).toBe(false)
    expect(isEditable("REGISTERED")).toBe(false)
  })

  it("สถานะที่ถือว่าออกเลขแล้ว", () => {
    expect(isNumbered("REGISTERED")).toBe(true)
    expect(isNumbered("SENT")).toBe(true)
    expect(isNumbered("RECEIVED")).toBe(true)
    expect(isNumbered("DRAFT")).toBe(false)
    expect(isNumbered("PENDING_NUMBER")).toBe(false)
  })

  it("สถานะปลายทางทำอะไรต่อไม่ได้แล้ว", () => {
    expect(isTerminal("CLOSED")).toBe(true)
    expect(isTerminal("CANCELLED")).toBe(true)

    for (const direction of ["INTERNAL", "OUTGOING", "INCOMING"] as const) {
      expect(availableTransitions(direction, "CLOSED")).toEqual([])
      expect(availableTransitions(direction, "CANCELLED")).toEqual([])
    }
  })

  it("allowedFromStatuses คืนชุดเดียวกับที่ nextStatus ยอมรับ", () => {
    const transitions: DocumentTransition[] = [
      "SUBMITTED",
      "RETURNED",
      "NUMBER_ISSUED",
      "CIRCULATED",
      "ACKNOWLEDGED",
      "MARKED_SENT",
      "FORWARDED",
      "CLOSED",
      "CANCELLED",
    ]

    for (const direction of ["INTERNAL", "OUTGOING", "INCOMING"] as const) {
      for (const transition of transitions) {
        const allowed = allowedFromStatuses(direction, transition)

        for (const status of DOCUMENT_STATUSES as readonly DocumentStatusValue[]) {
          const ok = nextStatus(direction, transition, status) !== null
          expect(ok).toBe(allowed.includes(status))
        }
      }
    }
  })

  it("availableTransitions บอกปุ่มที่ UI ควรโชว์", () => {
    expect(availableTransitions("INTERNAL", "DRAFT").sort()).toEqual(["CANCELLED", "SUBMITTED"])
    expect(availableTransitions("OUTGOING", "REGISTERED").sort()).toEqual([
      "CANCELLED",
      "MARKED_SENT",
    ])
    expect(availableTransitions("INCOMING", "RECEIVED").sort()).toEqual([
      "CANCELLED",
      "CLOSED",
      "FORWARDED",
      "NUMBER_ISSUED",
    ])
  })
})

describe("กันออกเลขซ้ำ (spec §6.4)", () => {
  it("ออกเลขได้เมื่อยังไม่มีเลข", () => {
    expect(canIssueNumber("INTERNAL", "PENDING_NUMBER", null)).toBe(true)
    expect(canIssueNumber("OUTGOING", "PENDING_NUMBER", null)).toBe(true)
    expect(canIssueNumber("INCOMING", "RECEIVED", null)).toBe(true)
  })

  // เคสที่เจอจากการใช้งานจริง: หนังสือรับอยู่ที่ RECEIVED ทั้งก่อนและหลังออกเลข
  // ตาราง transition จึงยังยอมให้ NUMBER_ISSUED ซ้ำ — ตัวที่ต้องห้ามคือ "มีเลขแล้ว"
  it("หนังสือรับที่มีเลขแล้ว ออกเลขซ้ำไม่ได้ แม้สถานะจะยังเป็น RECEIVED", () => {
    expect(canTransition("INCOMING", "NUMBER_ISSUED", "RECEIVED")).toBe(true)
    expect(canIssueNumber("INCOMING", "RECEIVED", "รับ 1/2569")).toBe(false)
  })

  it("เอกสารที่ออกเลขแล้วทุกทิศทางออกเลขซ้ำไม่ได้", () => {
    expect(canIssueNumber("INTERNAL", "REGISTERED", "510000/0001")).toBe(false)
    expect(canIssueNumber("OUTGOING", "SENT", "510000/0002")).toBe(false)
  })

  it("สถานะที่ออกเลขไม่ได้ก็ยังออกไม่ได้แม้ไม่มีเลข", () => {
    expect(canIssueNumber("INTERNAL", "DRAFT", null)).toBe(false)
    expect(canIssueNumber("INCOMING", "CLOSED", null)).toBe(false)
  })
})
