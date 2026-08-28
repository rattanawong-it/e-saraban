import { NextResponse } from "next/server"

import {
  exchangeCodeForProfile,
  getGoogleConfig,
  GoogleAuthError,
  resolveRedirectUri,
} from "@/lib/auth/providers/google"
import { takeOAuthState } from "@/lib/auth/providers/oauth-state"
import { GoogleLoginError, loginWithGoogle } from "@/server/services/auth.service"
import { isServiceError } from "@/server/services/errors"

// ขากลับจาก Google (spec §17.3 · D19)
//
// เส้นทางนี้เปิดให้ทุกคนเรียกได้ตามธรรมชาติของ OAuth จึงต้องถือว่า **ทุกค่าที่ได้มา
// เป็นของที่ผู้เรียกกำหนดเองทั้งหมด** — ของจริงมีอย่างเดียวคือ id_token ที่ Google
// ลงนาม และตรวจลายเซ็นแล้วใน exchangeCodeForProfile()

export const dynamic = "force-dynamic"

/** พากลับไปหน้าล็อกอินพร้อมรหัสเหตุผล — ข้อความไทยอยู่ที่หน้า /login */
function backToLogin(request: Request, reason: string) {
  const url = new URL("/login", request.url)
  url.searchParams.set("error", reason)
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const config = getGoogleConfig()
  if (!config) return new NextResponse(null, { status: 404 })

  const url = new URL(request.url)

  // ผู้ใช้กด "ยกเลิก" ที่หน้าของ Google — ไม่ใช่ความผิดพลาด พากลับเงียบ ๆ
  if (url.searchParams.get("error")) return NextResponse.redirect(new URL("/login", request.url))

  const state = url.searchParams.get("state")
  const code = url.searchParams.get("code")

  if (!state || !code) return backToLogin(request, "google_bad_request")

  // อ่าน state ที่เก็บไว้แล้วลบทิ้งทันที — ใช้ได้ครั้งเดียวเสมอ
  const saved = await takeOAuthState(state)
  if (!saved) return backToLogin(request, "google_expired")

  try {
    const profile = await exchangeCodeForProfile(config, {
      code,
      codeVerifier: saved.codeVerifier,
      nonce: saved.nonce,
      redirectUri: resolveRedirectUri(request),
    })

    await loginWithGoogle(profile, config.allowedHostedDomain)

    return NextResponse.redirect(new URL("/dashboard", request.url))
  } catch (error) {
    if (error instanceof GoogleLoginError) {
      return backToLogin(request, `google_${error.reason.toLowerCase()}`)
    }

    // ยิงถี่เกินกำหนด — ใช้ด่านเดียวกับหน้าที่ไม่ต้องล็อกอินอื่น ๆ
    if (isServiceError(error) && error.code === "RATE_LIMIT") {
      return backToLogin(request, "google_rate_limit")
    }

    // ความผิดพลาดฝั่งโปรโตคอล — ไม่บอกผู้ใช้ว่าพังตรงไหน แต่ต้องเหลือร่องรอยใน log
    if (error instanceof GoogleAuthError) {
      console.error("[google-auth]", error.code, error.message)
      return backToLogin(request, "google_failed")
    }

    // ⚠️ **error ที่ไม่รู้จักต้องไม่หลุดขึ้นไปเป็นหน้า 500 ของ Next**
    //
    // เดิมโยนต่อเพื่อไม่ให้บั๊กจริงถูกกลบ แต่ของจริงที่เกิดขึ้น (28 ส.ค. 2569) คือ
    // dev server ค้างอยู่กับ Prisma Client รุ่นก่อน migration แล้ว createSession() พัง —
    // ผู้ใช้เห็นหน้า stack trace ของ Next แทนที่จะรู้ว่าให้ลองใหม่หรือใช้รหัสผ่าน
    //
    // หน้านี้เป็นปลายทางที่ Google พาผู้ใช้กลับมา ไม่ใช่ API ที่โค้ดเราเรียกเอง
    // สิ่งที่ควรได้จึงเป็นทางเดินต่อ ไม่ใช่ร่องรอยของบั๊ก · ร่องรอยยังอยู่ครบใน log
    console.error("[google-auth] unexpected", error)

    return backToLogin(request, "google_failed")
  }
}
