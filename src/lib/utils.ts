import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * ⚠️ ต้องบอก tailwind-merge ว่าขั้นตัวอักษรของเราเป็น "ขนาด" ไม่ใช่ "สี"
 *
 * ขั้นทั้งแปดใน globals.css (`--text-display` … `--text-micro`) สร้างคลาสหน้าตา
 * `text-label` `text-caption` ซึ่ง tailwind-merge ไม่รู้จัก มันจึงเดาว่าเป็น **สีตัวอักษร**
 * แล้วไปตัดคลาสสีที่มาก่อนหน้าทิ้ง
 *
 * บั๊กจริงที่เกิดขึ้น (27 ส.ค. 2569): ปุ่ม "สร้างหนังสือใหม่" คือ
 * `bg-primary text-primary-foreground` + ขนาด `text-label` → `text-primary-foreground`
 * ถูกตัดทิ้ง เหลือปุ่มพื้นเขียวเข้มกับตัวหนังสือสีเขียวเข้ม อ่านแทบไม่ออก
 *
 * โผล่ตอนย้ายมาใช้ type scale เพราะของเดิมเป็น `text-[13px]` กับ `text-sm`
 * ซึ่ง tailwind-merge รู้จักว่าเป็นขนาดอยู่แล้ว · ทุกที่ที่ `cn()` รวมสีกับขนาด
 * โดยขนาดมาทีหลังจะโดนหมดโดยไม่มีอะไรเตือน — มี unit test ล็อกไว้แล้ว
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["display", "title-l", "title", "body", "section", "label", "caption", "micro"] },
      ],
    },
  },
})

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
