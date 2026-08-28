import "server-only"

import { cookies } from "next/headers"
import { jwtVerify, SignJWT } from "jose"

import { getAuthSecret } from "../session"

// เก็บ state · nonce · code_verifier ระหว่างที่ผู้ใช้ไปอยู่ที่หน้าของ Google
//
// ทำไมเก็บใน cookie ที่ลงนามแล้ว ไม่ใช่ในหน่วยความจำของ process:
// แอปนี้ตั้งใจให้ขึ้นหลาย instance ได้ (§17.4 ข้อ 3) — ถ้าเก็บในหน่วยความจำ
// ผู้ใช้ที่กลับมาจาก Google แล้วโดน load balancer ส่งเข้าอีก instance จะล็อกอินไม่ได้
// โดยไม่มีอะไรบอกสาเหตุ · cookie ลงนามด้วยกุญแจเดียวกับเซสชันจึงปลอมไม่ได้

const STATE_COOKIE = "esaraban-oauth-state"
const JWT_ISSUER = "e-saraban"
const JWT_AUDIENCE = "e-saraban-oauth"

/** อายุสั้นมากโดยตั้งใจ — พอสำหรับคนที่กดเลือกบัญชีตามปกติ แต่ไม่พอให้เอาไปใช้ทีหลัง */
const TTL_SECONDS = 600

export interface OAuthStatePayload {
  state: string
  nonce: string
  codeVerifier: string
}

export async function saveOAuthState(payload: OAuthStatePayload): Promise<void> {
  const token = await new SignJWT({
    nonce: payload.nonce,
    codeVerifier: payload.codeVerifier,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.state)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(getAuthSecret())

  const store = await cookies()

  store.set(STATE_COOKIE, token, {
    httpOnly: true,
    // ต้องเป็น lax ไม่ใช่ strict — ขากลับจาก accounts.google.com เป็น cross-site
    // navigation ถ้าใช้ strict เบราว์เซอร์จะไม่ส่ง cookie นี้มาและล็อกอินไม่มีวันสำเร็จ
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  })
}

/**
 * อ่าน state ที่เก็บไว้แล้ว**ลบทิ้งทันที** ไม่ว่าผลจะเป็นอย่างไร
 *
 * ลบทิ้งเสมอเพราะ state หนึ่งค่าใช้ได้ครั้งเดียว — ปล่อยค้างไว้คือเปิดให้ยิงซ้ำ
 */
export async function takeOAuthState(expectedState: string): Promise<OAuthStatePayload | null> {
  const store = await cookies()
  const token = store.get(STATE_COOKIE)?.value

  store.delete(STATE_COOKIE)

  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })

    if (payload.sub !== expectedState) return null
    if (typeof payload.nonce !== "string" || typeof payload.codeVerifier !== "string") return null

    return { state: payload.sub, nonce: payload.nonce, codeVerifier: payload.codeVerifier }
  } catch {
    return null
  }
}
