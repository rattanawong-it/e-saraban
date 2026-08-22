// การให้สิทธิ์ (spec §11.2) — can(), scope resolver, permission constants
//
// ตอนนี้มีแค่ค่าคงที่ · `can()` และ scope resolver จะมาใน P1 พร้อมตาราง
// Role/Permission ใน schema — ดูกติกาที่ spec §11.3 ข้อ 2:
// **ตรวจสิทธิ์ที่ service layer เสมอ ไม่ใช่ที่ UI**

export * from "./permissions"
