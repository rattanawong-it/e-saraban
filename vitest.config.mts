import { fileURLToPath } from "node:url"

import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  // Vite รุ่นนี้แปลง path alias จาก tsconfig ได้เอง ไม่ต้องใช้ vite-tsconfig-paths
  resolve: {
    tsconfigPaths: true,
    alias: {
      // โมดูลฝั่งเซิร์ฟเวอร์ import "server-only" ซึ่งโยน error นอก React Server Component
      // แทนด้วยโมดูลเปล่าเหมือนที่ vitest.integration.config.mts ทำ เพื่อให้ทดสอบโค้ดตัวจริงได้
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // integration test ต้องมี Postgres จริง — แยกไปที่ `pnpm test:integration`
    // เพื่อให้ `pnpm test` รันได้บนเครื่องที่ไม่มี Docker
    exclude: [...configDefaults.exclude, "tests/integration/**"],
    globals: false,
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/server/**"],
    },
  },
})
