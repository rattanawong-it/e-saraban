import { runFixture } from "./global-setup"

// ลบเอกสารที่เทสต์สร้างไว้ทั้งหมด — ฐานนี้เป็นฐานจริงของเครื่อง dev ไม่ใช่ฐานจำลอง
// ปล่อยขยะไว้จะไปกวนตัวเลขบนหน้าภาพรวมและทะเบียนของคนที่ใช้งานต่อ
export default function globalTeardown() {
  runFixture("cleanup")
}
