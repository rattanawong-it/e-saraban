import "server-only"

import { createRemoteJWKSet, jwtVerify } from "jose"

// Google Sign-In — เฉพาะกลไก OAuth 2.0 / OIDC (spec §17.3 · D19)
//
// ⚠️ **ไฟล์นี้ห้ามรู้จัก Session · can() · clearanceLevel** ตามข้อ 1 ของ §17.4
// หน้าที่เดียวคือ "พาไป Google แล้วเอาข้อมูลที่ยืนยันแล้วกลับมา" ส่วนการตัดสินว่า
// คนนี้เข้าระบบได้หรือไม่เป็นของ auth.service — วันที่เปลี่ยนไปใช้ผู้ให้บริการอื่น
// หรือย้าย library จะได้แก้อยู่ในโฟลเดอร์นี้ที่เดียว

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"]

/** เส้นทางที่ต้องไปลงทะเบียนไว้ใน Google Cloud Console ให้ตรงกันเป๊ะ */
export const GOOGLE_CALLBACK_PATH = "/api/auth/callback/google"

export interface GoogleConfig {
  clientId: string
  clientSecret: string
  /** โดเมน Workspace ที่ยอมรับ — null = ไม่จำกัด (ห้ามใช้บนเครื่องจริง) */
  allowedHostedDomain: string | null
}

/**
 * อ่านค่าตั้งจาก environment — คืน null เมื่อยังไม่ได้ตั้งค่า
 *
 * การคืน null ไม่ใช่ error: §17.5 กำหนดให้ปุ่ม Google ซ่อนตัวเองเมื่อยังไม่ตั้งค่า
 * เพื่อให้ deploy ที่อยู่ในวงปิด (ออกอินเทอร์เน็ตไปหา Google ไม่ได้) ใช้งานได้ตามปกติ
 */
export function getGoogleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()

  if (!clientId || !clientSecret) return null

  const hd = process.env.GOOGLE_ALLOWED_HD?.trim()

  return {
    clientId,
    clientSecret,
    allowedHostedDomain: hd ? hd.toLowerCase() : null,
  }
}

export function isGoogleEnabled(): boolean {
  return getGoogleConfig() !== null
}

// ── PKCE + state ──────────────────────────────────────────────────────────

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url")
}

function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return base64url(bytes)
}

export interface AuthorizationRequest {
  url: string
  state: string
  nonce: string
  codeVerifier: string
}

/**
 * ประกอบ URL ที่จะพาผู้ใช้ไป Google
 *
 * ใช้ PKCE (S256) ทั้งที่เป็น confidential client ที่มี secret อยู่แล้ว —
 * ตั้งใจใส่เพิ่มเพราะมันปิดช่องที่ code ถูกดักระหว่างทางแล้วเอาไปแลก token ที่อื่น
 * และไม่มีต้นทุนอะไรเลยนอกจากโค้ดสิบบรรทัด
 */
export async function buildAuthorizationRequest(
  config: GoogleConfig,
  redirectUri: string,
): Promise<AuthorizationRequest> {
  const state = randomToken()
  const nonce = randomToken()
  const codeVerifier = randomToken(64)

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier))
  const codeChallenge = base64url(new Uint8Array(digest))

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    // ให้ผู้ใช้เลือกบัญชีทุกครั้ง — เครื่องในสำนักงานมักมีหลายบัญชีค้างอยู่
    // ถ้าไม่ใส่ Google จะเลือกบัญชีล่าสุดให้เงียบ ๆ แล้วคนถัดไปเข้าเป็นคนก่อนหน้า
    prompt: "select_account",
  })

  // `hd` เป็นแค่คำใบ้ให้หน้าเลือกบัญชีของ Google กรองให้ — **ไม่ใช่ด่านความปลอดภัย**
  // ด่านจริงคือการตรวจค่า hd ใน id_token ฝั่งเราหลังแลก token แล้ว (ดู verifyIdToken)
  if (config.allowedHostedDomain) params.set("hd", config.allowedHostedDomain)

  return { url: `${AUTHORIZE_URL}?${params.toString()}`, state, nonce, codeVerifier }
}

// ── แลก code เป็น token แล้วอ่าน id_token ─────────────────────────────────

export interface GoogleProfile {
  /** `sub` — ตัวระบุถาวรของบัญชี Google · ใช้ตัวนี้จับคู่ ไม่ใช่อีเมล */
  subject: string
  email: string | null
  emailVerified: boolean
  /** โดเมน Google Workspace · บัญชี gmail ส่วนตัวไม่มีค่านี้ */
  hostedDomain: string | null
  name: string | null
}

export class GoogleAuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = "GoogleAuthError"
  }
}

const jwks = createRemoteJWKSet(new URL(JWKS_URL))

/**
 * แลก authorization code เป็น id_token แล้วตรวจลายเซ็นกับ JWKS ของ Google
 *
 * ⚠️ **ต้องตรวจ nonce เสมอ** — ไม่งั้น id_token ที่ได้มาจากเซสชันอื่น
 * ถูกเอามายัดใส่เส้นทางนี้ได้ (token replay)
 */
export async function exchangeCodeForProfile(
  config: GoogleConfig,
  input: { code: string; codeVerifier: string; nonce: string; redirectUri: string },
): Promise<GoogleProfile> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
      code_verifier: input.codeVerifier,
    }),
  })

  if (!response.ok) {
    throw new GoogleAuthError(
      `แลก token กับ Google ไม่สำเร็จ (HTTP ${response.status})`,
      "EXCHANGE",
    )
  }

  const payload = (await response.json()) as { id_token?: unknown }
  const idToken = payload.id_token

  if (typeof idToken !== "string") {
    throw new GoogleAuthError("Google ไม่ได้ส่ง id_token กลับมา", "NO_ID_TOKEN")
  }

  const { payload: claims } = await jwtVerify(idToken, jwks, {
    issuer: ISSUERS,
    audience: config.clientId,
  }).catch(() => {
    throw new GoogleAuthError("ตรวจลายเซ็นของ id_token ไม่ผ่าน", "BAD_ID_TOKEN")
  })

  if (claims.nonce !== input.nonce) {
    throw new GoogleAuthError("ค่า nonce ไม่ตรงกับที่ส่งไป", "BAD_NONCE")
  }

  if (typeof claims.sub !== "string" || claims.sub.length === 0) {
    throw new GoogleAuthError("id_token ไม่มี sub", "NO_SUBJECT")
  }

  const email = typeof claims.email === "string" ? claims.email.toLowerCase() : null
  const hd = typeof claims.hd === "string" ? claims.hd.toLowerCase() : null

  return {
    subject: claims.sub,
    email,
    // Google ส่งค่านี้เป็น boolean แต่บาง client library เคยเจอเป็น string "true"
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    hostedDomain: hd,
    name: typeof claims.name === "string" ? claims.name : null,
  }
}

/**
 * เส้นทางกลับที่ต้องส่งให้ Google — ต้องตรงกับที่ลงทะเบียนไว้ใน Console เป๊ะทุกตัวอักษร
 *
 * ปกติประกอบจาก host ของ request เอง จึงใช้ได้ทั้ง localhost ตอน dev และโดเมนจริง
 * โดยไม่ต้องตั้งค่าอะไร · ตั้ง `GOOGLE_REDIRECT_URI` ทับได้เมื่อหน้าเว็บอยู่หลัง proxy
 * ที่ไม่ได้ส่ง X-Forwarded-* มาให้ครบ
 */
export function resolveRedirectUri(request: Request): string {
  const explicit = process.env.GOOGLE_REDIRECT_URI?.trim()
  if (explicit) return explicit

  const url = new URL(request.url)
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()

  const protocol = forwardedProto ?? url.protocol.replace(":", "")
  const host = forwardedHost ?? request.headers.get("host") ?? url.host

  return `${protocol}://${host}${GOOGLE_CALLBACK_PATH}`
}
