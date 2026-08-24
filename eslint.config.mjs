import stylistic from "@stylistic/eslint-plugin"
import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import prettier from "eslint-config-prettier/flat"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // ปิด rule ที่ชนกับ prettier — ต้องอยู่ "หลัง" config อื่นทั้งหมด
  prettier,

  {
    plugins: {
      "@stylistic": stylistic,
    },
    rules: {
      // กติกาของโปรเจกต์: ห้าม semicolon (ดู docs/progress.md §5)
      // prettier จัดรูปแบบให้อยู่แล้ว แต่ตั้งซ้ำที่นี่เพื่อให้ `pnpm lint` (และ CI)
      // จับได้ด้วย ไม่ต้องรอ `pnpm format:check` — ตั้งหลัง prettier จึงไม่ถูกปิดทิ้ง
      //
      // ใช้ของ @stylistic ไม่ใช่ rule `semi` ในตัว ESLint เพราะตัวในรู้จักแต่ไวยากรณ์ JS
      // เจอ syntax เฉพาะของ TS (interface, index signature, declare) แล้วรายงานผิด
      "@stylistic/semi": ["error", "never"],

      // Server Action ที่ใช้กับ useActionState ต้องรับ state เดิมเป็นพารามิเตอร์แรก
      // แม้จะไม่ได้ใช้ค่านั้น — ตั้งชื่อขึ้นต้นด้วย _ แล้วให้ rule ข้ามไป
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },

  globalIgnores([
    // ค่าปริยายของ eslint-config-next
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma Client ที่ generate มา — ไม่ได้เขียนเอง และไม่อยู่ใน git
    "src/generated/**",
    // ไฟล์ดีไซน์จาก Claude Design — เป็น artifact ของเครื่องมือ ไม่ใช่ซอร์สของแอป
    "project-ui/**",
  ]),
])

export default eslintConfig
