// การให้สิทธิ์ (spec §11.2) — can(), scope resolver, permission constants
//
// กติกาที่ spec §11.3 ข้อ 2 บังคับไว้:
// **ตรวจสิทธิ์ที่ service layer เสมอ ไม่ใช่ที่ UI**
// UI ใช้ can() เพื่อ "ซ่อนปุ่ม" ได้ แต่ service ต้องเรียกซ้ำเองทุกครั้ง

export * from "./can"
export * from "./context"
export * from "./matrix"
export * from "./permissions"
