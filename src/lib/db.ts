import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "@/generated/prisma/client"

// Prisma 7 ไม่อ่าน DATABASE_URL เองอีกแล้ว — ต้องส่ง connection ผ่าน driver adapter
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error("ไม่พบตัวแปรสภาพแวดล้อม DATABASE_URL — ดูตัวอย่างที่ .env.example")
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  })
}

// ใน dev ที่ Next hot-reload ซ้ำ ๆ ต้อง cache ไว้บน globalThis
// ไม่งั้นจะเปิด connection pool ใหม่ทุกครั้งจน Postgres ปฏิเสธการเชื่อมต่อ
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
