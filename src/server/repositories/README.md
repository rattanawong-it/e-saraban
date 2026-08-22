# Repositories

Prisma query ล้วน ๆ — ไม่มีการตัดสินใจเชิงธุรกิจ ไม่มีการตรวจสิทธิ์

แยกออกมาจาก service เพื่อให้ query ที่ซับซ้อน (materialized path ของ OrgUnit,
การค้นด้วย pg_trgm, การล็อกแถว `FOR UPDATE` ตอนออกเลข) ทดสอบและปรับจูนได้เอง

เริ่มมีของจริงตั้งแต่ **P1**
