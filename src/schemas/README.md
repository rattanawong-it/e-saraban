# Zod Schemas

schema เดียวใช้ทั้ง client และ server (spec §11.1)

- form ฝั่ง client validate ด้วย react-hook-form + zodResolver จาก schema ตัวเดียวกัน
- Server Action validate ซ้ำด้วย schema ตัวเดิมก่อนส่งต่อให้ service
  — **ฝั่ง client เชื่อไม่ได้ ต้องตรวจที่ server เสมอ**

ยังไม่ได้ติดตั้ง `zod` — จะติดตั้งพร้อม form แรกใน **P1**
