"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

import { THEME_COOKIE, type Theme } from "@/lib/theme"

/**
 * สลับธีมสว่าง/มืด
 *
 * เก็บใน cookie ไม่ใช่ localStorage เพราะ layout อ่านฝั่ง server
 * จึงไม่ต้องมี inline script (ซึ่ง CSP ตาม spec §8.4 ห้าม) และไม่มีจอกระพริบ
 */
export async function setThemeAction(theme: Theme): Promise<void> {
  const store = await cookies()

  store.set(THEME_COOKIE, theme, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })

  revalidatePath("/", "layout")
}
