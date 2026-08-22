// รูปแบบข้อมูลแบบไทย (spec §11.2) — พ.ศ. · เลขไทย
//
// ยังไม่มี: การจัดรูปแบบเลขหนังสือตาม pattern (`{unitCode}/{seq:4}` ฯลฯ)
// เพราะ pattern ตั้งค่าได้ต่อหน่วยงาน × ประเภท × ทิศทาง (spec §7.1)
// ต้องอ่านจากตาราง NumberSequence ซึ่งจะมีใน P2

export * from "./date"
export * from "./numerals"
