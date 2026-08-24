import { redirect } from "next/navigation"

import { getAppSession } from "@/server/session"

// หน้าแรกไม่มีเนื้อหาของตัวเอง — ส่งต่อไปยังปลายทางที่ถูกต้องตามสถานะการล็อกอิน
export default async function RootPage() {
  const session = await getAppSession()
  redirect(session ? "/dashboard" : "/login")
}
