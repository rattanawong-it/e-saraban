// การเข้ารหัสไฟล์แนบ (spec §8.2)
//
// โมดูลนี้จัดการ **เฉพาะการเข้ารหัส** ส่วนการอ่าน-เขียนไฟล์เป็นของ src/lib/storage/
// ตัว StorageAdapter รับ-ส่งเฉพาะ byte ที่เข้ารหัสแล้ว จึงไม่รู้จักกุญแจเลยแม้แต่น้อย

export * from "./envelope"
export * from "./key-provider"
export * from "./types"
