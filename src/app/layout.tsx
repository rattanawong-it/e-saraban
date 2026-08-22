import type { Metadata } from "next"
import localFont from "next/font/local"

import { APP_DESCRIPTION, APP_LOCALE, APP_NAME } from "@/constants"

import "./globals.css"

// IBM Plex Sans Thai — self-host ตาม spec §10.2 (ไม่พึ่ง CDN เพราะ deploy on-premise)
// ไฟล์ต้นทางจาก @fontsource/ibm-plex-sans-thai (SIL Open Font License 1.1)
// แต่ละน้ำหนักมี 2 subset: thai + latin — เบราว์เซอร์เลือก glyph ให้เองตาม coverage
const ibmPlexSansThai = localFont({
  variable: "--font-sans",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
  src: [
    { path: "./fonts/ibm-plex-sans-thai-thai-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-sans-thai-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-sans-thai-thai-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-sans-thai-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-sans-thai-thai-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/ibm-plex-sans-thai-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/ibm-plex-sans-thai-thai-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/ibm-plex-sans-thai-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
})

// ข้อความมาจาก src/constants/ ตาม spec §12 — ห้ามเขียนไทยลง component ตรง ๆ
export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang={APP_LOCALE} className={`${ibmPlexSansThai.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
