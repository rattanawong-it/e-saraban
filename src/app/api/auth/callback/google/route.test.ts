import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// การแปลงความผิดพลาดของ callback เป็นทางเดินต่อของผู้ใช้ (spec §17.3 · D19)
//
// ⚠️ ด่านที่ชุดนี้เฝ้าจริง ๆ คือ **ห้ามมี error หลุดขึ้นไปเป็นหน้า 500 ของ Next**
// เพราะหน้านี้เป็นปลายทางที่ Google พาผู้ใช้กลับมา ไม่ใช่ API ที่โค้ดเราเรียกเอง
// ผู้ใช้ที่มาถึงตรงนี้ต้องได้ทางเดินต่อเสมอ ไม่ใช่ stack trace
//
// auth.service ถูกแทนทั้งโมดูล ไม่ใช่แค่บางฟังก์ชัน เพราะของจริงลากตัว prisma เข้ามาด้วย
// ซึ่งต้องมี DATABASE_URL — ชุด unit ต้องรันได้บนเครื่องที่ไม่มี Docker (vitest.config.mts)

const mocks = vi.hoisted(() => ({
  exchangeCodeForProfile: vi.fn(),
  loginWithGoogle: vi.fn(),
  takeOAuthState: vi.fn(),
}))

vi.mock("@/lib/auth/providers/google", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/providers/google")>()

  return {
    ...actual,
    getGoogleConfig: () => ({
      clientId: "id.apps.googleusercontent.com",
      clientSecret: "secret",
      allowedHostedDomain: "krirk.ac.th",
    }),
    exchangeCodeForProfile: mocks.exchangeCodeForProfile,
  }
})

vi.mock("@/lib/auth/providers/oauth-state", () => ({ takeOAuthState: mocks.takeOAuthState }))

vi.mock("@/server/services/auth.service", () => {
  // คลาสตัวแทนของ GoogleLoginError — route ตรวจด้วย instanceof จึงต้องเป็นตัวเดียวกับ
  // ที่เทสต์โยน · ทั้งคู่ import จากโมดูลที่ถูก mock นี้ จึงได้คลาสเดียวกันเสมอ
  class GoogleLoginError extends Error {
    constructor(readonly reason: string) {
      super(reason)
      this.name = "GoogleLoginError"
    }
  }

  return { GoogleLoginError, loginWithGoogle: mocks.loginWithGoogle }
})

const { GoogleAuthError } = await import("@/lib/auth/providers/google")
const { GoogleLoginError } = await import("@/server/services/auth.service")
const { GET } = await import("./route")

const STATE = "state-value"

function callbackRequest(params: Record<string, string>) {
  const url = new URL("http://localhost:3000/api/auth/callback/google")
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)

  return new Request(url)
}

/** ปลายทางของ redirect โดยตัดโดเมนออก — เทสต์สนใจแค่เส้นทางกับรหัสเหตุผล */
function destination(response: Response) {
  const location = response.headers.get("location")
  if (!location) throw new Error(`ไม่ได้ redirect (สถานะ ${response.status})`)

  const url = new URL(location)
  return `${url.pathname}${url.search}`
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})

  mocks.takeOAuthState.mockResolvedValue({
    state: STATE,
    nonce: "nonce",
    codeVerifier: "verifier",
  })
  mocks.exchangeCodeForProfile.mockResolvedValue({
    subject: "sub",
    email: "someone@krirk.ac.th",
    emailVerified: true,
    hostedDomain: "krirk.ac.th",
    name: null,
  })
  mocks.loginWithGoogle.mockResolvedValue({ linked: false })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe("callback ของ Google", () => {
  it("สำเร็จแล้วพาไปหน้าภาพรวม", async () => {
    const response = await GET(callbackRequest({ state: STATE, code: "code" }))

    expect(destination(response)).toBe("/dashboard")
  })

  it("แปลเหตุผลที่ถูกปฏิเสธเป็นรหัสบน URL ให้หน้าล็อกอินไปแปลต่อ", async () => {
    mocks.loginWithGoogle.mockRejectedValue(new GoogleLoginError("NO_ACCOUNT"))

    const response = await GET(callbackRequest({ state: STATE, code: "code" }))

    expect(destination(response)).toBe("/login?error=google_no_account")
  })

  it("โดเมนไม่ผ่านได้รหัสของตัวเอง ไม่ใช่ข้อความรวม ๆ", async () => {
    mocks.loginWithGoogle.mockRejectedValue(new GoogleLoginError("DOMAIN_NOT_ALLOWED"))

    const response = await GET(callbackRequest({ state: STATE, code: "code" }))

    expect(destination(response)).toBe("/login?error=google_domain_not_allowed")
  })

  it("ความผิดพลาดฝั่งโปรโตคอลไม่บอกผู้ใช้ว่าพังตรงไหน แต่ต้องลง log", async () => {
    mocks.exchangeCodeForProfile.mockRejectedValue(
      new GoogleAuthError("ลายเซ็นไม่ผ่าน", "BAD_ID_TOKEN"),
    )

    const response = await GET(callbackRequest({ state: STATE, code: "code" }))

    expect(destination(response)).toBe("/login?error=google_failed")
    expect(console.error).toHaveBeenCalled()
  })

  it("error ที่ไม่รู้จักต้องไม่กลายเป็นหน้า 500 — ผู้ใช้ต้องได้ทางเดินต่อเสมอ", async () => {
    // ของจริงที่เคยเกิด (28 ส.ค. 2569): dev server ค้างกับ Prisma Client รุ่นก่อน migration
    mocks.loginWithGoogle.mockRejectedValue(new Error("Unknown argument `authMethod`"))

    const response = await GET(callbackRequest({ state: STATE, code: "code" }))

    expect(destination(response)).toBe("/login?error=google_failed")
    expect(console.error).toHaveBeenCalled()
  })

  it("ผู้ใช้กดยกเลิกที่หน้าของ Google — กลับหน้าล็อกอินเงียบ ๆ ไม่ขึ้นข้อความผิดพลาด", async () => {
    const response = await GET(callbackRequest({ error: "access_denied" }))

    expect(destination(response)).toBe("/login")
  })

  it("state ที่หมดอายุหรือถูกใช้ไปแล้ว ต้องไม่ไปแลก token ต่อ", async () => {
    mocks.takeOAuthState.mockResolvedValue(null)

    const response = await GET(callbackRequest({ state: STATE, code: "code" }))

    expect(destination(response)).toBe("/login?error=google_expired")
    expect(mocks.exchangeCodeForProfile).not.toHaveBeenCalled()
  })
})
