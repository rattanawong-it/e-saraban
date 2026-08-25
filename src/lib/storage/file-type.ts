// ตรวจชนิดไฟล์จาก "เนื้อไฟล์จริง" ไม่ใช่จากนามสกุลหรือ Content-Type (spec §8.4)
//
// เหตุผล: ทั้งนามสกุลและ Content-Type มาจากฝั่งผู้ใช้ทั้งคู่ ปลอมได้ทั้งคู่
// ไฟล์ .exe ที่เปลี่ยนชื่อเป็น .pdf และประกาศ Content-Type เป็น application/pdf
// จะผ่านด่านที่เช็คแค่สองอย่างนั้นได้สบาย
//
// ไฟล์นี้เป็นฟังก์ชันบริสุทธิ์ — รับ byte ต้น ๆ ของไฟล์แล้วบอกว่าคืออะไร

/** จำนวน byte ที่ต้องอ่านมาให้พอสำหรับตรวจทุกชนิดที่รองรับ */
export const MAGIC_BYTES_NEEDED = 8

export interface DetectedFileType {
  /** mime ที่อ่านได้จากเนื้อไฟล์ */
  mimeType: string
  /** ชื่อชนิดแบบอ่านออก ใช้ในข้อความ error */
  label: string
}

const PDF = [0x25, 0x50, 0x44, 0x46] // %PDF
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG = [0xff, 0xd8, 0xff]
const ZIP = [0x50, 0x4b] // PK — docx/xlsx เป็น zip ข้างใน
const OLE2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] // .doc/.xls รุ่นเก่า

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false
  return signature.every((byte, index) => bytes[index] === byte)
}

/**
 * อ่านชนิดไฟล์จาก magic number
 *
 * ⚠️ docx/xlsx/pptx เป็นไฟล์ zip เหมือนกันหมด แยกจากกันด้วย magic number ไม่ได้
 * จึงคืน `application/zip` แล้วให้ผู้เรียกไปเทียบกับ mime ที่ประกาศมาอีกที (ดู isMimeConsistent)
 */
export function detectFileType(bytes: Uint8Array): DetectedFileType | null {
  if (startsWith(bytes, PDF)) return { mimeType: "application/pdf", label: "PDF" }
  if (startsWith(bytes, PNG)) return { mimeType: "image/png", label: "PNG" }
  if (startsWith(bytes, JPEG)) return { mimeType: "image/jpeg", label: "JPEG" }
  if (startsWith(bytes, OLE2))
    return { mimeType: "application/x-ole-storage", label: "Word/Excel รุ่นเก่า" }
  if (startsWith(bytes, ZIP)) return { mimeType: "application/zip", label: "ZIP (docx/xlsx)" }

  return null
}

/** mime ที่เป็นไฟล์ Office รุ่นใหม่ — เนื้อในเป็น zip ทั้งหมด */
const OOXML_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
])

/** mime ของ Office รุ่นเก่า — เนื้อในเป็น OLE2 compound file */
const OLE2_MIME_TYPES = new Set(["application/msword", "application/vnd.ms-excel"])

/**
 * เนื้อไฟล์ตรงกับ mime ที่ประกาศมาหรือไม่
 *
 * ยอมรับกรณีที่ magic number แยกไม่ได้จริง ๆ (docx/xlsx ต่างเป็น zip)
 * แต่ไม่ยอมให้ไฟล์ zip อ้างว่าเป็น PDF หรือกลับกัน
 */
export function isMimeConsistent(declaredMime: string, detected: DetectedFileType | null): boolean {
  if (!detected) return false

  if (detected.mimeType === "application/zip") return OOXML_MIME_TYPES.has(declaredMime)
  if (detected.mimeType === "application/x-ole-storage") return OLE2_MIME_TYPES.has(declaredMime)

  return detected.mimeType === declaredMime
}
