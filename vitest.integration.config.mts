import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

// Integration test — ต้องมี Postgres จริงรันอยู่ (docker compose up -d) และ seed แล้ว
// แยกจาก vitest.config.mts เพราะ `pnpm test` ต้องรันได้บนเครื่องที่ไม่มี Docker
//
// รันด้วย: pnpm test:integration

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // service layer ทุกไฟล์ import "server-only" ซึ่งโยน error นอก React Server Component
      // แทนที่ด้วยโมดูลเปล่าเพื่อให้ทดสอบ "โค้ดตัวจริง" ได้ ไม่ต้องก๊อปปี้ logic มาไว้ในเทสต์
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
      // เส้นทางล็อกอินอ่าน cookie/header ของ request ซึ่งมีได้เฉพาะตอนมี request จริง
      // แทนด้วยตัวเก็บในหน่วยความจำ เพื่อให้ทดสอบด่านของ auth.service ตัวจริงได้
      "next/headers": fileURLToPath(new URL("./tests/stubs/next-headers.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globals: false,
    // ทุกไฟล์แตะฐานข้อมูลเดียวกัน — รันทีละไฟล์กันชนกันเอง
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
