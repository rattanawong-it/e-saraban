import { NextResponse, type NextRequest } from "next/server"

// Security headers + CSP (spec §8.4)
//
// ⚠️ Next รุ่นนี้เปลี่ยนชื่อ `middleware` เป็น **`proxy`** แล้ว — ไฟล์นี้ต้องชื่อ proxy.ts
// และอยู่ระดับเดียวกับ app/ (ดู node_modules/next/dist/docs/01-app/03-api-reference/
// 03-file-conventions/proxy.md) · ตั้งชื่อว่า middleware.ts จะไม่ถูกเรียกเลย
//
// ไฟล์นี้ทำอย่างเดียวคือใส่ header — **ไม่ตรวจสิทธิ์** เพราะ proxy ถูกออกแบบมาให้
// รันแยกจากโค้ด render (บาง deploy ย้ายไปอยู่ที่ CDN) การตัดสินสิทธิ์จึงต้องอยู่ที่
// service layer เหมือนเดิมตาม spec §10.2 · ด่านเซสชันของหน้าเว็บอยู่ที่ layout ของ (app)
//
// ทำไมใช้ nonce ไม่ใช่ 'unsafe-inline': §8.4 สั่ง "CSP strict — ห้าม inline script"
// ต้นทุนปกติของ nonce คือทุกหน้าต้อง render สดทุก request แต่แอปนี้ทุกหน้าเป็น
// dynamic อยู่แล้ว (ทั้ง 27 route ขึ้น ƒ ตอน build) เพราะทุกหน้าอ่านเซสชัน จึงไม่เสียอะไรเพิ่ม

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const isDev = process.env.NODE_ENV === "development"

  const csp = [
    "default-src 'self'",
    // strict-dynamic: สคริปต์ที่ผ่าน nonce โหลดสคริปต์ก้อนอื่นต่อได้ (Next โหลด chunk แบบนี้)
    // dev ต้องมี unsafe-eval เพราะ React ใช้ eval ประกอบ stack ของ error ฝั่งเซิร์ฟเวอร์
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // style-src คุม <style> ที่ถูกแทรกเข้ามา ส่วน style-src-attr คุม style="" บนอิลิเมนต์
    // แยกกันเพราะ §8.4 เข้มเรื่อง **script** เป็นหลัก และแอปมี style="" อยู่จุดเดียว
    // (ระยะเยื้องของผังหน่วยงานที่คำนวณจากระดับชั้น) ซึ่งใส่ nonce ให้ไม่ได้
    //
    // ⚠️ ห้ามเติม 'unsafe-inline' ตรงนี้แม้แต่เฉพาะ dev — **มันไม่ทำงาน** เพราะสเปก CSP
    // สั่งให้เบราว์เซอร์เมิน 'unsafe-inline' ทิ้งทันทีที่มี nonce อยู่ในลิสต์เดียวกัน
    // (เคยมีบรรทัด `${isDev ? " 'unsafe-inline'" : ""}` อยู่ตรงนี้ ถอดออกเมื่อ 26 ส.ค. 2569
    // หลังยืนยันจากของจริงว่าไม่เคยมีผล) · คนละเรื่องกับ 'unsafe-eval' ของ script-src ข้างบน
    // ที่จำเป็นจริงใน dev · CSP error ที่เห็นในคอนโซลตอน dev มาจากแผงเครื่องมือของ Next เอง
    // ไม่ใช่ของแอป จึงไม่มีอะไรต้องผ่อนให้ — e2e วิ่งบน production build ด้วยเหตุผลนี้
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    // ฟอนต์ทั้งหมดเป็นไฟล์ในโปรเจกต์เอง ไม่มี CDN ภายนอกให้ต้องอนุญาต
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    // ส่งฟอร์มออกนอกโดเมนไม่ได้ — กันฟอร์มที่ถูกแทรกให้ยิงข้อมูลออกไปที่อื่น
    "form-action 'self'",
    "frame-ancestors 'none'",
    "connect-src 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ")

  // ส่ง nonce ต่อให้ตัว render ผ่าน request header — Next อ่านจาก CSP header แล้วแปะ
  // ให้ script ของเฟรมเวิร์กเองอัตโนมัติ ไม่ต้องไล่ใส่ทีละแท็ก
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  response.headers.set("Content-Security-Policy", csp)

  // frame-ancestors ครอบเรื่องเดียวกันแล้ว แต่เบราว์เซอร์เก่ายังรู้จักแค่ตัวนี้
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  // ระบบสารบรรณไม่ต้องใช้อุปกรณ์พวกนี้เลย ปิดทิ้งไม่ให้สคริปต์ไหนขอสิทธิ์ได้
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  )

  // กันหน้าอื่นที่เปิดเราขึ้นมาถืออ้างอิงถึง window ของเรา
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin")

  return response
}

export const config = {
  matcher: [
    /*
     * ทุกเส้นทาง ยกเว้น:
     * - api      → route handler ใส่ header ของตัวเองอยู่แล้ว และ CSP ที่มี object-src 'none'
     *              จะไปบล็อกตัวแสดง PDF ในตัวของเบราว์เซอร์ตอนเปิดไฟล์แนบ
     * - _next/static, _next/image → ไฟล์นิ่ง ไม่มีสคริปต์ให้ต้องคุม
     */
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}
