// Audit log (spec §8.5) — append-only + hash chain
//
// กติกาที่ห้ามละเมิด:
//   1. ไม่มีคำสั่ง UPDATE/DELETE กับตาราง audit_logs ในโค้ด
//      (ฐานข้อมูลก็บังคับซ้ำด้วย trigger — ดู migration audit_append_only)
//   2. เขียนใน transaction เดียวกับงานหลักเสมอ (spec §11.3 ข้อ 5)
//   3. การเข้าถึงที่ถูกปฏิเสธ (DENY) ต้องบันทึกทุกครั้ง

export * from "./actions"
export * from "./writer"
