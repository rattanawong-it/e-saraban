# Services

business logic ทั้งหมดอยู่ที่นี่ — document, numbering, attachment, audit ฯลฯ

กติกาจาก spec §11.3:

- ทุกเมธอด**รับ `ctx: ServiceContext` เป็น argument แรก** (ข้อ 2)
- **ตรวจสิทธิ์ที่ชั้นนี้เสมอ ไม่ใช่ที่ UI** — UI ซ่อนปุ่มได้ แต่ server ต้องตรวจซ้ำ (ข้อ 2)
- ใส่ `tenantId` ใน where clause **ทุก query** (ข้อ 4)
- **เขียน audit ใน transaction เดียวกับงานหลัก** ห้ามแยก (ข้อ 5)

เริ่มมีของจริงตั้งแต่ **P1**
