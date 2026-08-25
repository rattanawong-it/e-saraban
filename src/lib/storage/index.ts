// ที่เก็บไฟล์แนบ (spec §11.2) — StorageAdapter: LocalFs วันนี้ · S3 ในอนาคต
//
// ไฟล์ของเอกสารชั้นความลับถูกเข้ารหัสมาก่อนถึงที่นี่แล้วเสมอ (ดู src/lib/crypto/)
// ตัว adapter ไม่ต้องรู้เรื่องนั้นเลย เพราะรับ-ส่ง byte ดิบอย่างเดียว

export * from "./file-type"
export * from "./local-fs"
export * from "./types"
