import type { YearMode } from "@/lib/settings/definitions"

import { getBuddhistYear, getThaiMonth, type DateInput } from "./date"

// การจัดรูปแบบเลขทะเบียนตาม pattern (spec §7.1 · D16)
//
// ไฟล์นี้เป็นฟังก์ชันบริสุทธิ์ล้วน ไม่แตะฐานข้อมูล — การเดินเลขและล็อกแถวอยู่ที่
// issueNumber() ฝั่ง service ส่วนที่นี่ทำหน้าที่เดียวคือแปลง pattern + ค่า → ข้อความ
//
// ⚠️ เลขที่ออกไปแล้วแก้ย้อนหลังไม่ได้ (spec §6.4) การเปลี่ยน pattern จึงมีผลกับ
//    เอกสารที่ออกเลข "หลังจากนี้" เท่านั้น ของเดิมเก็บ docNo ที่ render แล้วไว้ในแถวของตัวเอง

/** ค่าปริยายของทุกหน่วยงานตาม D16 — รหัสหน่วยงาน 6 หลัก ทับ ลำดับ 4 หลัก */
export const DEFAULT_NUMBER_PATTERN = "{unitCode}/{seq:4}"

/** ความกว้างสูงสุดของ zero-pad — 9 หลักพอสำหรับทุกหน่วยงานในหนึ่งปี */
const MAX_PAD_WIDTH = 9

export interface DocNumberContext {
  /** รหัสงานสารบรรณ 6 หลักของหน่วยงานเจ้าของเรื่อง */
  unitCode: string
  /** ชื่อย่อหน่วยงาน — ไม่มีก็ตกกลับไปใช้ unitCode เพื่อไม่ให้เลขมีช่องว่าง */
  unitShort?: string | null
  /** ลำดับที่ของหน่วยงานนั้นในปีนั้น */
  seq: number
  /** ปี พ.ศ. ที่ใช้เป็นคีย์ของทะเบียน */
  year: number
  /** ชื่อประเภทหนังสือ เช่น "คำสั่ง" — ใช้กับ pattern แบบ `{docType} ที่ {seq}/{year}` */
  docType?: string | null
  /** เล่มทะเบียน — เอกสารลับใช้เล่มแยกจากหนังสือปกติ (spec §7.3) */
  bookCode?: string | null
}

export interface NumberPatternIssue {
  code: "UNKNOWN_TOKEN" | "NO_SEQ" | "BAD_PAD" | "EMPTY" | "STRAY_BRACE"
  message: string
}

/** token ที่รองรับ พร้อมตัวอย่างสำหรับหน้า /admin/numbering */
export const NUMBER_PATTERN_TOKENS = [
  { token: "{unitCode}", label: "รหัสหน่วยงาน", example: "510000" },
  { token: "{unitShort}", label: "ชื่อย่อหน่วยงาน", example: "บธ." },
  { token: "{seq}", label: "ลำดับที่ (ไม่เติมศูนย์)", example: "451" },
  { token: "{seq:4}", label: "ลำดับที่ เติมศูนย์ให้ครบ 4 หลัก", example: "0451" },
  { token: "{year}", label: "ปี พ.ศ. เต็ม", example: "2569" },
  { token: "{yearShort}", label: "ปี พ.ศ. สองหลักท้าย", example: "69" },
  { token: "{docType}", label: "ชื่อประเภทหนังสือ", example: "คำสั่ง" },
  { token: "{bookCode}", label: "เล่มทะเบียน", example: "MAIN" },
] as const

const TOKEN_PATTERN = /\{([a-zA-Z]+)(?::(\d+))?\}/g

const KNOWN_TOKENS = new Set([
  "unitCode",
  "unitShort",
  "seq",
  "year",
  "yearShort",
  "docType",
  "bookCode",
])

/**
 * ปีที่ใช้เป็นคีย์ของทะเบียน (spec §7.2)
 *
 * ปีงบประมาณไทยเริ่ม 1 ตุลาคม — เอกสารที่ออกในเดือน ต.ค.–ธ.ค. จึงนับเป็น "ปีถัดไป"
 * เช่น 15 ต.ค. 2569 อยู่ในปีงบประมาณ 2570
 */
export function resolveNumberYear(mode: YearMode, value: DateInput = new Date()): number {
  const year = getBuddhistYear(value)
  if (mode === "CALENDAR") return year

  return getThaiMonth(value) >= 10 ? year + 1 : year
}

/**
 * แปลง pattern + ค่า → เลขที่หนังสือ
 *
 * โยน error ทันทีเมื่อเจอ token ที่ไม่รู้จัก — ปล่อยผ่านแล้วเลขจะออกมาผิดรูป
 * และเลขที่ออกไปแล้วแก้ย้อนหลังไม่ได้ตาม §6.4
 */
export function renderDocNumber(pattern: string, ctx: DocNumberContext): string {
  return pattern.replace(TOKEN_PATTERN, (match, name: string, pad?: string) => {
    switch (name) {
      case "unitCode":
        return ctx.unitCode
      case "unitShort":
        return ctx.unitShort?.trim() || ctx.unitCode
      case "seq":
        return padSequence(ctx.seq, pad)
      case "year":
        return String(ctx.year)
      case "yearShort":
        return String(ctx.year).slice(-2)
      case "docType":
        return ctx.docType?.trim() ?? ""
      case "bookCode":
        return ctx.bookCode?.trim() ?? ""
      default:
        throw new Error(`pattern เลขทะเบียนมี token ที่ไม่รู้จัก: ${match}`)
    }
  })
}

/**
 * ตรวจ pattern ก่อนบันทึก — ใช้ที่ /admin/numbering และฝั่ง service
 * คืนรายการปัญหา ไม่โยน error เพื่อให้แสดงบนฟอร์มได้ทีเดียวหลายข้อ
 */
export function validateNumberPattern(pattern: string): NumberPatternIssue[] {
  const issues: NumberPatternIssue[] = []
  const trimmed = pattern.trim()

  if (trimmed.length === 0) {
    return [{ code: "EMPTY", message: "กรุณากรอกรูปแบบเลขทะเบียน" }]
  }

  let hasSeq = false

  for (const match of trimmed.matchAll(TOKEN_PATTERN)) {
    const [, name, pad] = match

    if (!name || !KNOWN_TOKENS.has(name)) {
      issues.push({ code: "UNKNOWN_TOKEN", message: `ไม่รู้จัก ${match[0]}` })
      continue
    }

    if (name === "seq") {
      hasSeq = true

      if (pad !== undefined) {
        const width = Number(pad)
        if (width < 1 || width > MAX_PAD_WIDTH) {
          issues.push({
            code: "BAD_PAD",
            message: `จำนวนหลักของ {seq:n} ต้องอยู่ระหว่าง 1–${MAX_PAD_WIDTH} (ได้ ${pad})`,
          })
        }
      }
    }
  }

  // ไม่มี {seq} = ทุกฉบับได้เลขเดียวกัน ซึ่งจะไปชน @@unique ตอนออกเลขฉบับที่สอง
  if (!hasSeq) {
    issues.push({ code: "NO_SEQ", message: "รูปแบบต้องมี {seq} หรือ {seq:n} อย่างน้อยหนึ่งจุด" })
  }

  // วงเล็บที่เหลือหลังตัด token ออก แปลว่าพิมพ์ตกหรือเกิน
  if (/[{}]/.test(trimmed.replace(TOKEN_PATTERN, ""))) {
    issues.push({ code: "STRAY_BRACE", message: "มีวงเล็บปีกกาที่ไม่ได้เป็นส่วนของ token" })
  }

  return issues
}

/** ตัวอย่างผลลัพธ์สำหรับแสดงบนหน้าตั้งค่า — ใช้ค่าตัวอย่างชุดเดียวกับ NUMBER_PATTERN_TOKENS */
export function previewDocNumber(pattern: string): string {
  return renderDocNumber(pattern, {
    unitCode: "510000",
    unitShort: "บธ.",
    seq: 451,
    year: 2569,
    docType: "คำสั่ง",
    bookCode: "MAIN",
  })
}

/**
 * เติมศูนย์ให้ครบตามที่ pattern สั่ง
 *
 * ถ้าเลขยาวกว่าที่สั่งไว้ **ห้ามตัดทิ้ง** — ตัดแล้วเลขที่ 10001 กับ 1 จะกลายเป็นเลขเดียวกัน
 * ยอมให้ล้นออกมาแทน เพราะเลขซ้ำร้ายแรงกว่าเลขที่ยาวเกินรูปแบบ
 */
function padSequence(seq: number, pad?: string): string {
  const digits = String(seq)
  if (pad === undefined) return digits

  const width = Math.min(Number(pad), MAX_PAD_WIDTH)
  return digits.padStart(width, "0")
}
