import "server-only"

import { readFile } from "node:fs/promises"
import path from "node:path"

import fontkit from "@pdf-lib/fontkit"
import { degrees, PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib"

import { formatThaiDateTime } from "@/lib/thai"

// ลายน้ำบนเอกสารลับ (spec §8.3)
//
// ฝัง **ชื่อผู้เปิด + username + วันเวลา + IP** ทับทุกหน้าแบบทแยง
// → ถ้าภาพหน้าจอหรือไฟล์รั่วออกไป จะสาวกลับถึงตัวผู้ทำได้
//
// ⚠️ ข้อจำกัดที่ต้องสื่อสารกับผู้บริหาร (spec §8.3 เขียนไว้ตรง ๆ):
// ลายน้ำเป็น **มาตรการป้องปรามและสืบสวน** ไม่ใช่การปิดกั้น — คนที่เห็นเอกสารบนจอย่อมถ่ายภาพได้เสมอ
//
// วาดเป็นตารางซ้ำทั้งหน้า ไม่ใช่ข้อความเดียวกลางหน้า เพราะข้อความเดียวถูกครอบตัดทิ้งได้ในคลิกเดียว

/** ฟอนต์สารบรรณ (Sarabun · OFL 1.1) — ฟอนต์มาตรฐานหนังสือราชการไทย */
const FONT_PATH = path.join(process.cwd(), "src", "lib", "pdf", "fonts", "Sarabun-Regular.ttf")

const FONT_SIZE = 11
const OPACITY = 0.28
const ROTATION = degrees(45)

/** ระยะห่างของตารางลายน้ำ (จุด) — ถี่พอให้ครอบตัดหนีไม่ได้ แต่ยังอ่านเนื้อเอกสารออก */
const STEP_X = 300
const STEP_Y = 190

export interface WatermarkIdentity {
  /** ชื่อ-นามสกุลผู้เปิด ตามที่แสดงในระบบ */
  fullName: string
  username: string
  openedAt: Date
  ip: string | null
}

/** อ่านฟอนต์ครั้งเดียวแล้วใช้ซ้ำ — ไฟล์แนบถูกเปิดบ่อย ไม่ควรอ่านดิสก์ทุกครั้ง */
let fontBytesPromise: Promise<Buffer> | null = null

function loadFontBytes(): Promise<Buffer> {
  fontBytesPromise ??= readFile(FONT_PATH)
  return fontBytesPromise
}

/**
 * แปะลายน้ำทับทุกหน้าของ PDF
 *
 * @throws เมื่ออ่าน PDF ไม่ได้ (เช่นไฟล์ถูกตั้งรหัสผ่านไว้) — ผู้เรียก **ต้องไม่**
 * ส่งไฟล์ต้นฉบับออกไปแทน เพราะนั่นคือการปล่อยเอกสารลับออกไปโดยไม่มีลายน้ำ
 */
export async function watermarkPdf(
  pdfBytes: Uint8Array,
  identity: WatermarkIdentity,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes)

  pdf.registerFontkit(fontkit)
  const font = await pdf.embedFont(await loadFontBytes(), { subset: true })

  const lines = buildLines(identity)

  for (const page of pdf.getPages()) {
    stampPage(page, font, lines)
  }

  return pdf.save()
}

/** ข้อความสองบรรทัดตาม §8.3 — ใครเปิด เมื่อไร จากเครื่องไหน */
function buildLines(identity: WatermarkIdentity): [string, string] {
  return [
    `${identity.fullName} (${identity.username})`,
    `${formatThaiDateTime(identity.openedAt)} · IP ${identity.ip ?? "ไม่ทราบ"}`,
  ]
}

function stampPage(page: PDFPage, font: PDFFont, lines: [string, string]) {
  const { width, height } = page.getSize()

  // หมุน 45° แล้วข้อความยื่นออกนอกกรอบ จึงต้องเริ่มวาดตั้งแต่นอกหน้ากระดาษ
  for (let x = -STEP_X; x < width + STEP_X; x += STEP_X) {
    for (let y = -STEP_Y; y < height + STEP_Y; y += STEP_Y) {
      lines.forEach((line, index) => {
        page.drawText(line, {
          x,
          y: y - index * (FONT_SIZE + 3),
          font,
          size: FONT_SIZE,
          color: rgb(0.45, 0.45, 0.45),
          opacity: OPACITY,
          rotate: ROTATION,
        })
      })
    }
  }
}
