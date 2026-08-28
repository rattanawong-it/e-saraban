import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  buildAuthorizationRequest,
  getGoogleConfig,
  isGoogleEnabled,
  resolveRedirectUri,
} from "./google"

// ค่าตั้งและการประกอบ URL ของ Google Sign-In (spec §17.3 · D19)
//
// ชุดนี้ทดสอบเฉพาะส่วนที่ไม่ต้องคุยกับ Google จริง — การแลก token กับตรวจลายเซ็น
// id_token อยู่ในชุด integration และการกดใช้จริง

const ENV_KEYS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_ALLOWED_HD",
  "GOOGLE_REDIRECT_URI",
] as const

const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

describe("getGoogleConfig", () => {
  it("คืน null เมื่อยังไม่ได้ตั้งค่า — ปุ่มบนหน้าล็อกอินจะซ่อนตัวเอง (§17.5)", () => {
    expect(getGoogleConfig()).toBeNull()
    expect(isGoogleEnabled()).toBe(false)
  })

  it("คืน null เมื่อมีแค่ client id ไม่มี secret", () => {
    process.env.GOOGLE_CLIENT_ID = "id.apps.googleusercontent.com"

    expect(getGoogleConfig()).toBeNull()
  })

  it("บีบโดเมนที่อนุญาตเป็นตัวพิมพ์เล็ก — ค่าจาก id_token เป็นตัวพิมพ์เล็กเสมอ", () => {
    process.env.GOOGLE_CLIENT_ID = "id.apps.googleusercontent.com"
    process.env.GOOGLE_CLIENT_SECRET = "secret"
    process.env.GOOGLE_ALLOWED_HD = "Krirk.AC.TH"

    expect(getGoogleConfig()?.allowedHostedDomain).toBe("krirk.ac.th")
  })

  it("ค่าว่างของโดเมนแปลว่าไม่จำกัด ไม่ใช่สตริงว่าง", () => {
    process.env.GOOGLE_CLIENT_ID = "id.apps.googleusercontent.com"
    process.env.GOOGLE_CLIENT_SECRET = "secret"
    process.env.GOOGLE_ALLOWED_HD = "   "

    expect(getGoogleConfig()?.allowedHostedDomain).toBeNull()
  })
})

describe("resolveRedirectUri", () => {
  it("ประกอบจาก host ของ request เมื่อไม่ได้ตั้งค่าทับ", () => {
    const request = new Request("http://localhost:3000/api/auth/google/start")

    expect(resolveRedirectUri(request)).toBe("http://localhost:3000/api/auth/callback/google")
  })

  it("ใช้ X-Forwarded-* เมื่ออยู่หลัง nginx — ไม่งั้นจะได้ http ทั้งที่ผู้ใช้เข้าผ่าน https", () => {
    const request = new Request("http://app:3000/api/auth/google/start", {
      headers: { "x-forwarded-proto": "https", "x-forwarded-host": "saraban.krirk.ac.th" },
    })

    expect(resolveRedirectUri(request)).toBe("https://saraban.krirk.ac.th/api/auth/callback/google")
  })

  it("ค่าที่ตั้งไว้ใน env ชนะทุกอย่าง", () => {
    process.env.GOOGLE_REDIRECT_URI = "https://fixed.example/api/auth/callback/google"

    const request = new Request("http://localhost:3000/api/auth/google/start")

    expect(resolveRedirectUri(request)).toBe("https://fixed.example/api/auth/callback/google")
  })
})

describe("buildAuthorizationRequest", () => {
  const config = {
    clientId: "id.apps.googleusercontent.com",
    clientSecret: "secret",
    allowedHostedDomain: "krirk.ac.th",
  }

  it("ใส่ PKCE แบบ S256 · state · nonce และบังคับให้เลือกบัญชีทุกครั้ง", async () => {
    const request = await buildAuthorizationRequest(config, "http://localhost:3000/cb")
    const params = new URL(request.url).searchParams

    expect(params.get("code_challenge_method")).toBe("S256")
    expect(params.get("code_challenge")).toHaveLength(43) // sha256 แบบ base64url
    expect(params.get("prompt")).toBe("select_account")
    expect(params.get("state")).toBe(request.state)
    expect(params.get("nonce")).toBe(request.nonce)
    expect(params.get("hd")).toBe("krirk.ac.th")
  })

  it("ทุกครั้งต้องได้ state และ code_verifier ชุดใหม่", async () => {
    const first = await buildAuthorizationRequest(config, "http://localhost:3000/cb")
    const second = await buildAuthorizationRequest(config, "http://localhost:3000/cb")

    expect(first.state).not.toBe(second.state)
    expect(first.codeVerifier).not.toBe(second.codeVerifier)
    expect(first.nonce).not.toBe(second.nonce)
  })

  it("ไม่ส่ง hd ไปเลยเมื่อไม่จำกัดโดเมน", async () => {
    const request = await buildAuthorizationRequest(
      { ...config, allowedHostedDomain: null },
      "http://localhost:3000/cb",
    )

    expect(new URL(request.url).searchParams.has("hd")).toBe(false)
  })
})
