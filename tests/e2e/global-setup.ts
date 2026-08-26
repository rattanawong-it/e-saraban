import { execFileSync } from "node:child_process"
import path from "node:path"

// เตรียมข้อมูลก่อนรันเทสต์ — สร้างบัญชีของ e2e ให้พร้อมล็อกอิน
//
// ⚠️ ต้องสั่งผ่าน tsx คนละโปรเซส ไม่ import ตรง ๆ เพราะ Playwright แปลงไฟล์เป็น CommonJS
// แล้วโหลด Prisma client (ESM) ไม่ได้ · --conditions=react-server ทำให้ "server-only"
// กลายเป็นโมดูลเปล่า แบบเดียวกับที่ scripts/encrypt-attachments.ts ใช้อยู่

export default function globalSetup() {
  runFixture("ensure")
}

export function runFixture(command: "ensure" | "cleanup") {
  const root = path.join(__dirname, "..", "..")

  execFileSync(
    "npx",
    [
      "tsx",
      "--env-file=.env",
      "--conditions=react-server",
      path.join("tests", "e2e", "fixtures", "db-fixture.ts"),
      command,
    ],
    { cwd: root, stdio: "inherit", shell: process.platform === "win32" },
  )
}
