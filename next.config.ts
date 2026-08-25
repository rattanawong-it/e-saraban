import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // สร้าง .next/standalone สำหรับ Docker image — คัดเฉพาะไฟล์ที่รันจริง
  // ทำให้ image ปลายทางไม่ต้องมี node_modules ทั้งก้อน (spec §11.1 deploy ด้วย Docker Compose)
  output: "standalone",

  // ⚠️ ตัวไล่หาไฟล์ของ Next เห็น path ของที่เก็บไฟล์แนบใน LocalFsStorage แล้ว
  // **ก๊อปไฟล์แนบจริงเข้าไปใน .next/standalone ด้วย** → ไฟล์ของผู้ใช้ติดไปกับ Docker image
  // ตอนรัน volume จะทับทับโฟลเดอร์นี้ก็จริง แต่ไฟล์ยังนอนอยู่ใน layer ของ image ตลอดไป
  outputFileTracingExcludes: {
    "*": ["./storage/**"],
  },

  experimental: {
    serverActions: {
      // spec §8.3 จำกัดไฟล์แนบ 50MB · ค่าปริยายของ Server Action คือ 1MB
      // เผื่อ overhead ของ multipart boundary ไว้อีกเล็กน้อย และต้องไม่เกิน
      // client_max_body_size ของ nginx ใน docker/nginx/conf.d/default.conf
      bodySizeLimit: "52mb",
    },
  },
}

export default nextConfig
