// ข้อความและค่าคงที่ของ UI (spec §12 — แยกข้อความออกจาก component)
//
// หมายเหตุ: โฟลเดอร์นี้ **ไม่ได้อยู่ใน spec §11.2** แต่เพิ่มเข้ามาเพราะ §12
// สั่งให้แยกข้อความเป็น constants file · วางไว้ระดับ src/ ไม่ใช่ src/lib/
// เพราะเป็นข้อมูลล้วน ไม่มี logic และถูกอ้างทั้งฝั่ง client และ server

export * from "./app"
export * from "./document"
export * from "./help"
export * from "./notification"
export * from "./ui"
