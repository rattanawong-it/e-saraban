import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  checkRateLimit,
  clearAllRateLimits,
  computeLockUntil,
  PUBLIC_FORM_LIMIT,
  PUBLIC_FORM_WINDOW_MS,
  resetRateLimit,
} from "./rate-limit"

// spec §8.4 — ชั้นที่ 2 ของการกัน brute force (sliding window ต่อ IP)

const WINDOW = 60_000

beforeEach(() => {
  clearAllRateLimits()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("checkRateLimit", () => {
  it("ผ่านได้ครบตามโควตา แล้วครั้งถัดไปถูกปฏิเสธ", () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      expect(checkRateLimit("ip-1", 3, WINDOW).allowed).toBe(true)
    }

    const blocked = checkRateLimit("ip-1", 3, WINDOW)

    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  it("นับแยกกันคนละ key — IP หนึ่งถูกบล็อกต้องไม่ลามไปอีก IP", () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) checkRateLimit("ip-1", 3, WINDOW)

    expect(checkRateLimit("ip-1", 3, WINDOW).allowed).toBe(false)
    expect(checkRateLimit("ip-2", 3, WINDOW).allowed).toBe(true)
  })

  it("⚠️ หน้าต่างเลื่อนตามเวลาจริง — พ้นหน้าต่างแล้วต้องกลับมายิงได้ ไม่ใช่ถูกบล็อกถาวร", () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) checkRateLimit("ip-1", 3, WINDOW)
    expect(checkRateLimit("ip-1", 3, WINDOW).allowed).toBe(false)

    vi.advanceTimersByTime(WINDOW + 1)

    expect(checkRateLimit("ip-1", 3, WINDOW).allowed).toBe(true)
  })

  it("ครั้งที่ยิงก่อนหน้าต่างหลุดออกทีละครั้ง ไม่ใช่ล้างยกชุด", () => {
    checkRateLimit("ip-1", 2, WINDOW)
    vi.advanceTimersByTime(WINDOW / 2)
    checkRateLimit("ip-1", 2, WINDOW)

    expect(checkRateLimit("ip-1", 2, WINDOW).allowed).toBe(false)

    // ครั้งแรกหลุดหน้าต่างแล้ว เหลือที่ว่างหนึ่งช่อง ครั้งที่สองยังนับอยู่
    vi.advanceTimersByTime(WINDOW / 2 + 1)

    expect(checkRateLimit("ip-1", 2, WINDOW).allowed).toBe(true)
    expect(checkRateLimit("ip-1", 2, WINDOW).allowed).toBe(false)
  })

  it("resetRateLimit ล้างประวัติของ key นั้น — ใช้ตอนล็อกอินสำเร็จ", () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) checkRateLimit("ip-1", 3, WINDOW)
    expect(checkRateLimit("ip-1", 3, WINDOW).allowed).toBe(false)

    resetRateLimit("ip-1")

    expect(checkRateLimit("ip-1", 3, WINDOW).allowed).toBe(true)
  })

  it("หน้าที่เปิดให้คนนอกใช้ต้องมีเพดานที่ไม่หลวมเกินไป", () => {
    expect(PUBLIC_FORM_LIMIT).toBeLessThanOrEqual(10)
    expect(PUBLIC_FORM_WINDOW_MS).toBeGreaterThanOrEqual(10 * 60 * 1000)
  })
})

describe("computeLockUntil — exponential backoff (§8.4)", () => {
  it("ยังไม่ถึงเกณฑ์ก็ยังไม่ล็อก", () => {
    expect(computeLockUntil(4, 5, 15)).toBeNull()
  })

  it("ผิดครบรอบแรกล็อกตามฐาน · รอบถัดไปคูณสอง", () => {
    const now = Date.now()
    const first = computeLockUntil(5, 5, 15)
    const second = computeLockUntil(10, 5, 15)

    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    expect((second as Date).getTime() - now).toBeGreaterThan((first as Date).getTime() - now)
  })
})
