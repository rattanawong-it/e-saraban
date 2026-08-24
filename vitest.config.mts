import { defineConfig } from "vitest/config"

export default defineConfig({
  // Vite รุ่นนี้แปลง path alias จาก tsconfig ได้เอง ไม่ต้องใช้ vite-tsconfig-paths
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    globals: false,
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/server/**"],
    },
  },
})
