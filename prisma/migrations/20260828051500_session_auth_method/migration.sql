-- วิธียืนยันตัวตนของเซสชัน (spec §17.3 · D19)
--
-- แถวเดิมทั้งหมดเป็น PASSWORD เพราะตอนที่สร้างยังไม่มีทางเข้าด้วย Google
-- ค่าปริยายจึงถูกต้องอยู่แล้ว ไม่ต้องไล่อัปเดตย้อนหลัง

-- CreateEnum
CREATE TYPE "AuthMethod" AS ENUM ('PASSWORD', 'GOOGLE');

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "authMethod" "AuthMethod" NOT NULL DEFAULT 'PASSWORD';

