// ค่าตั้งต้นของตัวกรอง — **แหล่งความจริงเพียงที่เดียว** ของหน้าค้นหาและหน้าทะเบียน
//
// ทำไมต้องอยู่ใน constants/ ไม่ใช่ในไฟล์คอมโพเนนต์: มีสามฝ่ายที่ต้องเห็นค่าชุดเดียวกัน
//   1. หน้าเพจ — เติมให้ช่องที่ไม่มีใน query string
//   2. คอมโพเนนต์ตัวกรอง — ค่าที่วางในฟอร์ม
//   3. ชุด e2e — ยืนยันว่ากด "ล้างเงื่อนไข" แล้วได้ค่าตั้งต้นจริง
//
// ข้อ 3 คือเหตุผลที่ไฟล์นี้ต้องไม่ import React/Next อะไรเลย — Playwright แปลงไฟล์เทสต์
// เป็น CommonJS แล้ว import คอมโพเนนต์ที่มี JSX เข้าไปไม่ได้

/** ค่าของทุกช่องบนการ์ดตัวกรองหน้าค้นหา (§10.1) */
export interface SearchFilterValues {
  q: string
  direction: string
  status: string
  documentTypeId: string
  ownerUnitId: string
  confidentiality: string
  urgency: string
  dateField: string
  from: string
  to: string
  hasAttachment: boolean
  sort: string
}

/**
 * ค่าตั้งต้นของตัวกรองหน้าค้นหา — ปุ่ม "ล้างเงื่อนไข" พากลับมาที่ชุดนี้ทั้งชุด
 *
 * ⚠️ ค่าว่างในที่นี้แปลว่า **"ทุกอย่าง"** ไม่ใช่ "ยังไม่ได้เลือก" — ตัวเลือกแรกของ
 * `<select>` ที่เกี่ยวข้องคือ "ทุกประเภท / ทุกสถานะ" อยู่แล้ว จึงเป็นค่าตั้งต้นที่ถูกต้อง
 *
 * ⚠️ `sort` กับ `dateField` มีค่าตั้งต้นจริงที่ไม่ใช่ค่าว่าง — ถ้าล้างเป็นค่าว่าง
 * ฟอร์มจะส่งค่าที่ service ไม่รู้จัก และผลการค้นหาจะเรียงลำดับตามอะไรก็ไม่รู้
 */
export const SEARCH_FILTER_DEFAULTS: SearchFilterValues = {
  q: "",
  direction: "",
  status: "",
  documentTypeId: "",
  ownerUnitId: "",
  confidentiality: "",
  urgency: "",
  dateField: "docDate",
  from: "",
  to: "",
  hasAttachment: false,
  sort: "latest",
}

/** ค่าของทุกช่องบนการ์ดตัวกรองหน้าทะเบียนหนังสือ (§10.1 · D12) */
export interface RegisterFilterValues {
  book: string
  orgUnitId: string
  year: string
  documentTypeId: string
  from: string
  to: string
}

/**
 * ค่าตั้งต้นของตัวกรองหน้าทะเบียน — ปุ่ม "ล้างเงื่อนไข" พากลับมาที่ชุดนี้ทั้งชุด
 *
 * ⚠️ เป็นฟังก์ชันไม่ใช่ค่าคงที่ เพราะปีตั้งต้นคือ **ปีล่าสุดที่เลือกได้** ซึ่งเปลี่ยนทุกปี
 * รับรายการปีเข้ามาแทนการคำนวณเองในนี้ จะได้ไม่มีวันหลุดจากตัวเลือกที่มีจริงใน `<select>`
 *
 * ⚠️ `book` กับ `year` มีค่าตั้งต้นจริงที่ไม่ใช่ค่าว่าง — ทะเบียนหนังสือไม่มีสภาพ
 * "ไม่เลือกเล่ม" หรือ "ไม่เลือกปี" ให้แสดงได้ ต้องมีค่าเสมอ
 */
export function registerFilterDefaults(years: number[]): RegisterFilterValues {
  return {
    book: "outgoing",
    orgUnitId: "",
    year: String(years[0] ?? new Date().getFullYear() + 543),
    documentTypeId: "",
    from: "",
    to: "",
  }
}
