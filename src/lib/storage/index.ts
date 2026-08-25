// ที่เก็บไฟล์แนบ (spec §11.2) — StorageAdapter: LocalFs วันนี้ · S3 ในอนาคต
//
// P2 เก็บเป็นไฟล์ธรรมดาตาม D18 — การเข้ารหัส envelope (§8.2) เลื่อนไป P3
// ตัว adapter ไม่ต้องแก้ตอนนั้นเพราะรับ-ส่ง byte ดิบอยู่แล้ว

export * from "./file-type"
export * from "./local-fs"
export * from "./types"
