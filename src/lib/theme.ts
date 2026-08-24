import { cookies } from "next/headers"

export const THEME_COOKIE = "esaraban-theme"

export type Theme = "light" | "dark"

/**
 * อ่านธีมจาก cookie — ทำฝั่ง server เพื่อไม่ต้องใช้ inline script
 * (spec §8.4 บังคับ CSP `default-src 'self'` ห้าม inline script)
 */
export async function getThemeFromCookie(): Promise<Theme> {
  const store = await cookies()
  return store.get(THEME_COOKIE)?.value === "dark" ? "dark" : "light"
}
