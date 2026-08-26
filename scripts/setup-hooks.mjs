// ชี้ git ให้ใช้ hook ในโฟลเดอร์ .githooks/ ของโปรเจกต์
//
// เรียกจากสคริปต์ `prepare` ของ package.json ซึ่ง pnpm รันให้เองหลัง `pnpm install`
// จึงไม่มีขั้นตอน "อย่าลืมติดตั้ง hook" ให้ใครลืม
//
// ⚠️ ต้องไม่ทำให้ `pnpm install` ล้มไม่ว่ากรณีใด — ตอน build Docker image
//    .dockerignore ตัด .git ออกจาก context ไปแล้ว (และ deps stage ก็ยังไม่มี
//    โฟลเดอร์นี้ด้วยซ้ำ) การล้มตรงนี้จะทำให้ image build พังโดยไม่มีเหตุผล

import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

if (!existsSync(resolve(projectRoot, ".git"))) {
  // ไม่ได้อยู่ใน git repo (Docker build · tarball) — ไม่มี hook ให้ตั้ง ถือว่าจบงาน
  process.exit(0)
}

try {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
    cwd: projectRoot,
    stdio: "ignore",
  })
} catch {
  // ไม่มี git ใน PATH หรือสั่งไม่สำเร็จ — เตือนแล้วปล่อยผ่าน
  // hook เป็นตาข่ายรองรับ ไม่ใช่เงื่อนไขของการติดตั้ง dependency
  console.warn(
    "ตั้ง core.hooksPath ไม่สำเร็จ — pre-commit hook จะไม่ทำงาน (สั่งเองได้ด้วย pnpm hooks:install)",
  )
}
