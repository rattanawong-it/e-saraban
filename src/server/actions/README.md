# Server Actions

**Action บาง — Service หนา** (spec §11.3 ข้อ 1)

Action ทำได้แค่ 4 อย่างตามลำดับนี้เท่านั้น:

1. ตรวจ auth → ประกอบ `ServiceContext` (ดู `src/server/context.ts`)
2. validate ด้วย Zod จาก `src/schemas/`
3. เรียก service
4. `revalidatePath` / `revalidateTag`

> **ห้ามมี business logic ในไฟล์นี้เด็ดขาด** ถ้าเริ่มมี `if` ที่ตัดสินเรื่องงาน
> แปลว่ามันควรอยู่ใน service

เริ่มมีของจริงตั้งแต่ **P1** (auth) เป็นต้นไป
