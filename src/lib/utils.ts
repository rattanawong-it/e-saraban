import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * ขนาดไฟล์ให้คนอ่าน — ใช้ฐาน 1024 ตามที่ระบบปฏิบัติการรายงาน
 *
 * ปัดหนึ่งตำแหน่งพอ เพราะผู้ใช้อยากรู้แค่ "ใหญ่ไหม" ไม่ได้ต้องการตัวเลขที่แม่นระดับไบต์
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`

  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
}
