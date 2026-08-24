import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"

// endpoint สำหรับ healthcheck ของ container (docs/progress.md §8 ข้อ 8)
//
// ยิงที่หน้าแรกไม่เหมาะ เพราะเป็นหน้า render จริงที่ต้องอ่าน session และ redirect
// ที่นี่ตรวจแค่ว่า "แอปตอบได้" และ "ต่อฐานข้อมูลติด" ซึ่งเป็นสองอย่างที่
// compose ต้องรู้ก่อนปล่อย traffic เข้ามา
//
// ไม่เปิดเผยรายละเอียดของระบบ (เวอร์ชัน · ชื่อฐานข้อมูล) เพราะเป็น endpoint สาธารณะ

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json(
      { status: "error" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
