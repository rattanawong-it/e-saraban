import { defineConfig, devices } from "@playwright/test"

// Playwright e2e (spec §13 — P5)
//
// ทำไมต้องมีทั้งที่มี integration test 118 เคสแล้ว: การทดสอบด้วยมือรอบเดียวเจอบั๊กสามตัว
// ที่เทสต์ทั้งหมดไม่จับ — หัวทะเบียนประกาศหน่วยงานผิดเมื่อ "ไม่เลือกตัวกรอง" · หน้าค้าง
// ตอนพิมพ์ · ไอคอนวางผิดที่ · ทั้งสามอยู่ในชั้นที่ service test มองไม่เห็น
//
// ⚠️ เทสต์ชุดนี้ยิงใส่ฐานข้อมูล **จริง** ของเครื่องที่รันอยู่ ไม่ใช่ฐานจำลอง
// จึงตั้ง workers = 1 เสมอ และทุกอย่างที่สร้างต้องมีคำนำหน้า [e2e] เพื่อให้ตามลบได้

// ⚠️ พอร์ต 3100 ไม่ใช่ 3000 โดยตั้งใจ — ชุดนี้ต้องวิ่งบน production build เท่านั้น
// ถ้าใช้พอร์ตเดียวกับ `pnpm dev` แล้วบังเอิญมี dev server เปิดค้างอยู่ Playwright
// จะไปเกาะตัวนั้นเงียบ ๆ แล้วเราจะทดสอบผิดสภาพแวดล้อมโดยไม่รู้ตัว
const PORT = Number(process.env.E2E_PORT ?? 3100)
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

// เปิดช่องให้เกาะเซิร์ฟเวอร์ที่รันค้างอยู่ตอนนั่งแก้ตัวเทสต์เอง (ไม่ต้อง build ใหม่ทุกรอบ)
// ปิดเป็นค่าตั้งต้นเพราะการเกาะเซิร์ฟเวอร์เก่าคือการทดสอบโค้ดเก่าแบบไม่มีอะไรเตือน
const REUSE_SERVER = process.env.E2E_REUSE === "1"

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  // เอกสารหนึ่งฉบับเดินหลายขั้น (ร่าง → ส่ง → ออกเลข) บางขั้นรอ transaction ของเลขทะเบียน
  timeout: 60_000,
  expect: { timeout: 10_000 },

  // ⚠️ ห้ามรันขนาน — ทุก worker แชร์ฐานเดียวกัน และการออกเลขทะเบียนล็อกตัวนับอยู่แล้ว
  // รันขนานจะได้ผลลัพธ์ที่เดาไม่ได้ ไม่ใช่เพราะโค้ดผิดแต่เพราะเทสต์แย่งกันเอง
  fullyParallel: false,
  workers: 1,

  // ล้มแล้วไม่ลองซ้ำบนเครื่อง dev — เทสต์ที่ผ่านบ้างไม่ผ่านบ้างต้องรู้ทันที ไม่ใช่ซ่อนด้วย retry
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    // เก็บร่องรอยเฉพาะตอนล้ม — trace ของทุกเคสกินดิสก์เร็วมาก
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    // ล็อกอินครั้งเดียวแล้วแชร์ session ให้ทุกเคส
    // ⚠️ ถ้าล็อกอินซ้ำทุกเคสจะไปชน rate limit ของหน้าล็อกอิน (§8.4) แล้วเทสต์จะแดงเอง
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "tests/e2e/.auth/state.json" },
      dependencies: ["setup"],
    },
  ],

  // ── ต้องเป็น production build เสมอ ไม่ใช่ `pnpm dev` ────────────────────────
  //
  // แผงเครื่องมือ dev ของ Next แทรก <style> ฟอนต์ `__nextjs-Geist` ที่ไม่มี nonce
  // ทุกหน้าจึงมี CSP error ค้างในคอนโซลหน้าละ ~33 บรรทัด (วัดจริงเมื่อ 26 ส.ค. 2569)
  // ด่าน `expect(errors).toEqual([])` ของ smoke.spec.ts จะแดงยกชุดทั้งที่โค้ดไม่ผิดอะไร
  //
  // ทางเลือกคือกรอง error พวกนั้นทิ้ง แต่ตัวกรองจะค่อย ๆ กลายเป็นตะแกรงรูโตที่บัง
  // error จริงไปด้วย · ชุดนี้เป็นด่านก่อนปิดงาน ไม่ใช่ watch mode ที่รันทุกครั้งที่พิมพ์โค้ด
  // (workers = 1 และยิงฐานจริงอยู่แล้ว) การรอ build อีกครึ่งนาทีจึงคุ้มกว่ามาก
  //
  // ผลพลอยได้: prod ไม่มี `'unsafe-eval'` ใน script-src และเสิร์ฟ CSS เป็นไฟล์แทน
  // <style> — ตรงกับสภาพที่ผู้ใช้จริงเจอ ซึ่งเป็นสภาพเดียวที่ควรเอามาตัดสินว่าผ่านไหม
  webServer: {
    command: "pnpm build && pnpm start",
    // รอที่ /api/health เพราะ / ตอบ 307 เด้งไปหน้าล็อกอิน
    url: `${BASE_URL}/api/health`,
    env: { PORT: String(PORT) },
    reuseExistingServer: REUSE_SERVER,
    // build (~35 วิ) + start · เผื่อเครื่องช้าและเผื่อ TypeScript ตรวจทั้งโปรเจกต์
    timeout: 300_000,
  },
})
