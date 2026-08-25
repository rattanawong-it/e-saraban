import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"

import { config, proxy } from "./proxy"

// spec §8.4 — CSP strict + security headers
//
// เทสต์รันด้วย NODE_ENV=test จึงได้ CSP ชุดเดียวกับ production (ไม่มี unsafe-eval/unsafe-inline)
// ซึ่งเป็นชุดที่ต้องคุมจริง ๆ

function run(path = "/dashboard") {
  return proxy(new NextRequest(`http://localhost:3000${path}`))
}

function csp(path?: string): string {
  return run(path).headers.get("content-security-policy") ?? ""
}

function directive(value: string, name: string): string {
  const found = value
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `))

  return found ?? ""
}

describe("CSP", () => {
  it("script-src ใช้ nonce ไม่ใช่ unsafe-inline (§8.4 ห้าม inline script)", () => {
    const scriptSrc = directive(csp(), "script-src")

    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/)
    expect(scriptSrc).toContain("'strict-dynamic'")
    expect(scriptSrc).not.toContain("'unsafe-inline'")
    expect(scriptSrc).not.toContain("'unsafe-eval'")
  })

  it("⚠️ nonce ต้องไม่ซ้ำกันระหว่างคำขอ — ถ้าซ้ำ ผู้โจมตีเดาได้แล้ว CSP ก็ไร้ผล", () => {
    const first = csp()
    const second = csp()

    expect(first).not.toBe(second)
  })

  it("ปิดช่องทางที่ใช้แทรกสคริปต์และขโมยข้อมูลออกนอกโดเมน", () => {
    const value = csp()

    expect(value).toContain("default-src 'self'")
    expect(value).toContain("object-src 'none'")
    expect(value).toContain("base-uri 'self'")
    expect(value).toContain("form-action 'self'")
    expect(value).toContain("frame-ancestors 'none'")
    expect(value).toContain("connect-src 'self'")
  })

  it('style="" บนอิลิเมนต์ยังใช้ได้ แต่ <style> ที่ถูกแทรกต้องมี nonce', () => {
    const value = csp()

    expect(directive(value, "style-src-attr")).toBe("style-src-attr 'unsafe-inline'")
    expect(directive(value, "style-src")).toMatch(/'nonce-[A-Za-z0-9+/=]+'/)
    expect(directive(value, "style-src")).not.toContain("'unsafe-inline'")
  })

  it("บังคับให้ทุกคำขอย่อยวิ่งบน https ตอนอยู่หลัง TLS", () => {
    expect(csp()).toContain("upgrade-insecure-requests")
  })
})

describe("security headers", () => {
  it("ครบตามตารางใน §8.4", () => {
    const headers = run().headers

    expect(headers.get("x-frame-options")).toBe("DENY")
    expect(headers.get("x-content-type-options")).toBe("nosniff")
    expect(headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin")
    expect(headers.get("cross-origin-opener-policy")).toBe("same-origin")
    expect(headers.get("permissions-policy")).toContain("camera=()")
  })
})

describe("ขอบเขตที่ proxy ทำงาน", () => {
  it("⚠️ ข้าม /api — CSP ที่มี object-src 'none' จะบล็อกตัวแสดง PDF ตอนเปิดไฟล์แนบ", () => {
    const source = config.matcher[0]?.source ?? ""

    expect(source).toContain("api")
    expect(source).toContain("_next/static")
  })

  it("ไม่ต้องทำงานกับ prefetch ของ next/link", () => {
    const missing = config.matcher[0]?.missing ?? []

    expect(missing.map((rule) => rule.key)).toContain("next-router-prefetch")
  })
})
