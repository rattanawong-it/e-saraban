// เลขไทย ๐–๙ — spec §11.2 ระบุไว้ใน src/lib/thai/
//
// เอกสารราชการบางประเภท (คำสั่ง ประกาศ) นิยมใช้เลขไทยในเนื้อความ
// แต่ **เลขทะเบียนหนังสือใช้เลขอารบิกเสมอ** เพราะต้องเทียบ/เรียง/ค้นหาได้
// จึงแยกเป็นฟังก์ชันสำหรับ "แสดงผล" ไม่ใช่แปลงข้อมูลตอนบันทึก

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙"
const ARABIC_DIGIT_PATTERN = /[0-9]/g
const THAI_DIGIT_PATTERN = /[๐-๙]/g

/** `1234` → `๑๒๓๔` (แปลงเฉพาะตัวเลข อักขระอื่นคงเดิม) */
export function toThaiNumerals(value: number | string): string {
  return String(value).replace(ARABIC_DIGIT_PATTERN, (digit) => THAI_DIGITS[Number(digit)] ?? digit)
}

/** `๑๒๓๔` → `1234` — ใช้ล้างค่าที่ผู้ใช้พิมพ์เลขไทยเข้ามาในช่องค้นหา */
export function toArabicNumerals(value: string): string {
  return value.replace(THAI_DIGIT_PATTERN, (digit) => String(THAI_DIGITS.indexOf(digit)))
}

/** `1234567` → `๑,๒๓๔,๕๖๗` (คั่นหลักพันด้วย) */
export function formatThaiNumber(value: number): string {
  return new Intl.NumberFormat("th-TH-u-nu-thai").format(value)
}
