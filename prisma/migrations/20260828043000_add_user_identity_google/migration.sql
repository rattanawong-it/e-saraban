-- Google Sign-In (spec §17.3 · D19) — ผูกบัญชีภายนอกเข้ากับผู้ใช้ในระบบ
--
-- สามอย่างที่ทำในไฟล์นี้:
--   1. passwordHash ว่างได้ — ผู้ใช้ที่เข้าด้วย Google อย่างเดียวไม่มีรหัสผ่าน
--   2. ตาราง user_identities ใหม่ (จับคู่ด้วย sub ของ Google ไม่ใช่อีเมล)
--   3. อีเมลของผู้ใช้ต้องไม่ซ้ำกันภายใน tenant เดียวกัน — เพราะเป็นคีย์ที่ใช้จับคู่ครั้งแรก
--
-- ⚠️ ลำดับสำคัญ: ต้องบีบอีเมลเดิมเป็นตัวพิมพ์เล็ก **ก่อน** สร้าง unique index
--    ไม่งั้นเครื่องที่มี admin@krirk.ac.th กับ Admin@krirk.ac.th อยู่คนละแถว
--    จะผ่าน index แล้วไปพังตอนล็อกอินด้วย Google แทน ซึ่งหาสาเหตุยากกว่ามาก

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "user_identities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT,
    "hostedDomain" TEXT,
    "linkedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(3),

    CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_identities_userId_idx" ON "user_identities"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_provider_providerAccountId_key" ON "user_identities"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_userId_provider_key" ON "user_identities"("userId", "provider");

-- บีบอีเมลเดิมให้เป็นตัวพิมพ์เล็กทั้งหมด (ดูหมายเหตุลำดับด้านบน)
-- บนฐาน dev ปัจจุบันมี 0 แถวที่ต้องแก้ แต่ต้องมีคำสั่งนี้ไว้เพราะเครื่องจริงยังไม่ได้ตรวจ
UPDATE "users" SET "email" = lower("email") WHERE "email" IS NOT NULL AND "email" <> lower("email");

-- ถ้าคำสั่งถัดไปพัง แปลว่าเครื่องนั้นมีอีเมลซ้ำกันจริงภายใน tenant เดียวกัน
-- ให้หาแถวที่ชนด้วย:
--   SELECT "tenantId", "email", count(*) FROM "users"
--   WHERE "email" IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1;
-- แล้วให้ผู้ดูแลตัดสินว่าบัญชีไหนคือตัวจริง **ห้ามแก้ด้วยการเติมเลขต่อท้ายอีเมล**
-- เพราะอีเมลที่แก้แล้วจะจับคู่กับบัญชี Google ไม่ได้อีกเลย

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "users"("tenantId", "email");

-- AddForeignKey
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
