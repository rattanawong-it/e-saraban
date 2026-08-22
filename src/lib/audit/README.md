# Audit

audit writer + hash chain (spec §11.2)

- **เขียนใน transaction เดียวกับ business operation เสมอ** (spec §11.3 ข้อ 5)
  → ไม่มีทางที่ action สำเร็จแต่ audit หาย
- hash chain ทำให้ตรวจได้ว่ามีใครแก้ log ย้อนหลังหรือไม่
- spec §12 กำหนด retention: online ไม่น้อยกว่า 3 ปี แล้วค่อย archive

audit เบื้องต้นเริ่มที่ **P1** · hash chain + หน้า `/admin/audit` อยู่ที่ **P3**
