import type { Metadata } from "next"
import localFont from "next/font/local"

import { APP_DESCRIPTION, APP_LOCALE, APP_NAME } from "@/constants"
import { getThemeFromCookie } from "@/lib/theme"

import "./globals.css"

// Anuphan (ไทย) + Inter (อังกฤษ/ตัวเลข) — ตาม project-ui/Design System.dc.html
// self-host ตาม spec §10.2 (ไม่พึ่ง CDN เพราะ deploy on-premise)
// ไฟล์ต้นทางจาก @fontsource/* (SIL Open Font License 1.1)
const anuphan = localFont({
  variable: "--font-anuphan",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
  src: [
    { path: "./fonts/anuphan-thai-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/anuphan-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/anuphan-thai-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/anuphan-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/anuphan-thai-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/anuphan-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/anuphan-thai-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/anuphan-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
})

const inter = localFont({
  variable: "--font-inter",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
  src: [
    { path: "./fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/inter-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
})

// ข้อความมาจาก src/constants/ ตาม spec §12 — ห้ามเขียนไทยลง component ตรง ๆ
export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // ธีมเก็บใน cookie แล้วอ่านฝั่ง server — ไม่ใช้ inline script
  // เพราะ spec §8.4 บังคับ CSP แบบ `default-src 'self'` ห้าม inline script
  // ผลพลอยได้: ไม่มีจอกระพริบตอนโหลด (no flash of wrong theme)
  const theme = await getThemeFromCookie()

  return (
    <html
      lang={APP_LOCALE}
      className={`${anuphan.variable} ${inter.variable} h-full antialiased ${
        theme === "dark" ? "dark" : ""
      }`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
