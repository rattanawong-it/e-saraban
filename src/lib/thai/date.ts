// วันที่แบบไทย — spec §10.2 กำหนดว่า "แสดง พ.ศ. เสมอ"
//
// ใช้ Intl ของ Node แทนการบวก 543 เอง เพราะ ICU รู้จักปฏิทินพุทธ ชื่อเดือนไทย
// และรูปแบบย่อ/เต็มอยู่แล้ว (ตรวจแล้วว่า node:24-alpine มี full ICU ไม่ใช่ small)
//
// ⚠️ ทุกฟังก์ชันตรึง timeZone เป็น Asia/Bangkok เสมอ ไม่พึ่งค่าของเครื่อง
//    เพราะ container รันด้วย TZ=UTC — ถ้าปล่อยตามเครื่อง เอกสารที่สร้างหลัง
//    19:00 น. จะถูกแสดงเป็นวันถัดไป ซึ่งกระทบวันที่ในทะเบียนหนังสือโดยตรง

export const THAI_TIME_ZONE = "Asia/Bangkok"
export const THAI_BUDDHIST_LOCALE = "th-TH-u-ca-buddhist"

/** พ.ศ. = ค.ศ. + 543 */
export const BUDDHIST_ERA_OFFSET = 543

export type DateInput = Date | string | number

/** `short` = 22/08/2569 · `medium` = 22 ส.ค. 2569 · `long` = 22 สิงหาคม 2569 */
export type ThaiDateStyle = "short" | "medium" | "long"

const DATE_STYLE_OPTIONS: Record<ThaiDateStyle, Intl.DateTimeFormatOptions> = {
  short: { day: "2-digit", month: "2-digit", year: "numeric" },
  medium: { day: "numeric", month: "short", year: "numeric" },
  long: { day: "numeric", month: "long", year: "numeric" },
}

const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}

function toDate(value: DateInput): Date {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`ค่าวันที่ไม่ถูกต้อง: ${String(value)}`)
  }

  return date
}

function format(value: DateInput, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(THAI_BUDDHIST_LOCALE, {
    timeZone: THAI_TIME_ZONE,
    ...options,
  }).format(toDate(value))
}

/** วันที่ไทยพร้อม พ.ศ. — `formatThaiDate(d, "long")` → `22 สิงหาคม 2569` */
export function formatThaiDate(value: DateInput, style: ThaiDateStyle = "medium"): string {
  return format(value, DATE_STYLE_OPTIONS[style])
}

/** วันที่ + เวลา 24 ชม. — `22 ส.ค. 2569 10:30` */
export function formatThaiDateTime(value: DateInput, style: ThaiDateStyle = "medium"): string {
  return format(value, { ...DATE_STYLE_OPTIONS[style], ...TIME_OPTIONS })
}

/** เวลาอย่างเดียว 24 ชม. — `10:30` */
export function formatThaiTime(value: DateInput): string {
  return format(value, TIME_OPTIONS)
}

/** ปี พ.ศ. ของวันที่นั้นตามเวลาไทย — ใช้ตอนออกเลขทะเบียนแบบรีเซ็ตรายปี (spec §7.2) */
export function getBuddhistYear(value: DateInput = new Date()): number {
  return Number(format(value, { year: "numeric" }).replace(/\D/g, ""))
}

/** เดือน 1–12 ตามเวลาไทย — ใช้ตัดสินว่าเข้าปีงบประมาณถัดไปหรือยัง (spec §7.2) */
export function getThaiMonth(value: DateInput = new Date()): number {
  return Number(format(value, { month: "numeric" }).replace(/\D/g, ""))
}

/** ค.ศ. → พ.ศ. (คำนวณตรง ๆ ไม่ผูกกับวันที่) */
export function toBuddhistYear(gregorianYear: number): number {
  return gregorianYear + BUDDHIST_ERA_OFFSET
}

/** พ.ศ. → ค.ศ. */
export function toGregorianYear(buddhistYear: number): number {
  return buddhistYear - BUDDHIST_ERA_OFFSET
}
