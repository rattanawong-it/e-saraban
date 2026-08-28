import { NextResponse } from "next/server"

import {
  buildAuthorizationRequest,
  getGoogleConfig,
  resolveRedirectUri,
} from "@/lib/auth/providers/google"
import { saveOAuthState } from "@/lib/auth/providers/oauth-state"

// จุดเริ่มของการเข้าสู่ระบบด้วย Google (spec §17.3 · D19)
//
// เป็น route handler ไม่ใช่ Server Action เพราะปลายทางคือการ redirect ออกนอกโดเมน
// ซึ่งต้องเกิดจากการกดลิงก์ธรรมดา ใช้งานได้แม้ JavaScript ยังโหลดไม่เสร็จ

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const config = getGoogleConfig()

  // ยังไม่ได้ตั้งค่า = ฟีเจอร์นี้ปิดอยู่ · ตอบ 404 ให้เหมือนไม่มีเส้นทางนี้อยู่จริง
  // ปุ่มบนหน้าล็อกอินก็ซ่อนอยู่แล้ว คนที่มาถึงตรงนี้ได้คือคนที่เดา URL เอง
  if (!config) return new NextResponse(null, { status: 404 })

  const redirectUri = resolveRedirectUri(request)
  const authorization = await buildAuthorizationRequest(config, redirectUri)

  await saveOAuthState({
    state: authorization.state,
    nonce: authorization.nonce,
    codeVerifier: authorization.codeVerifier,
  })

  return NextResponse.redirect(authorization.url)
}
