import { describe, expect, it } from "vitest"

import { detectFileType, isMimeConsistent } from "./file-type"

// spec §8.4 — ตรวจชนิดไฟล์จากเนื้อไฟล์จริง ไม่ใช่จากนามสกุลหรือ Content-Type ที่ปลอมได้

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values)
}

describe("detectFileType", () => {
  it("อ่าน PDF จาก %PDF", () => {
    expect(detectFileType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))?.mimeType).toBe("application/pdf")
  })

  it("อ่าน PNG และ JPEG", () => {
    expect(detectFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.mimeType).toBe(
      "image/png",
    )
    expect(detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0))?.mimeType).toBe("image/jpeg")
  })

  it("docx/xlsx อ่านได้แค่ว่าเป็น zip — magic number แยกจากกันไม่ได้", () => {
    expect(detectFileType(bytes(0x50, 0x4b, 0x03, 0x04))?.mimeType).toBe("application/zip")
  })

  it("ไฟล์ที่ไม่รู้จักคืน null", () => {
    expect(detectFileType(bytes(0x00, 0x01, 0x02, 0x03))).toBeNull()
    expect(detectFileType(bytes())).toBeNull()
  })

  it("ไฟล์สั้นกว่าลายเซ็นไม่ถือว่าตรง", () => {
    expect(detectFileType(bytes(0x25, 0x50))).toBeNull()
  })
})

describe("isMimeConsistent", () => {
  it("PDF ที่ประกาศว่าเป็น PDF ผ่าน", () => {
    expect(isMimeConsistent("application/pdf", detectFileType(bytes(0x25, 0x50, 0x44, 0x46)))).toBe(
      true,
    )
  })

  it("⚠️ ไฟล์ zip ที่อ้างว่าเป็น PDF ต้องไม่ผ่าน — เคสไฟล์ปลอมนามสกุล", () => {
    expect(isMimeConsistent("application/pdf", detectFileType(bytes(0x50, 0x4b, 0x03, 0x04)))).toBe(
      false,
    )
  })

  it("⚠️ ไฟล์ปฏิบัติการที่อ้างว่าเป็น PDF ต้องไม่ผ่าน", () => {
    // MZ = Windows PE executable
    expect(isMimeConsistent("application/pdf", detectFileType(bytes(0x4d, 0x5a, 0x90, 0x00)))).toBe(
      false,
    )
  })

  it("zip ผ่านได้เมื่อประกาศเป็น docx หรือ xlsx", () => {
    const zip = detectFileType(bytes(0x50, 0x4b, 0x03, 0x04))
    expect(isMimeConsistent(DOCX_MIME, zip)).toBe(true)
    expect(isMimeConsistent(XLSX_MIME, zip)).toBe(true)
  })

  it("OLE2 ผ่านได้เมื่อประกาศเป็น .doc/.xls รุ่นเก่า", () => {
    const ole2 = detectFileType(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1))
    expect(isMimeConsistent("application/msword", ole2)).toBe(true)
    expect(isMimeConsistent("application/pdf", ole2)).toBe(false)
  })

  it("ไฟล์ที่อ่านชนิดไม่ออกต้องไม่ผ่าน", () => {
    expect(isMimeConsistent("application/pdf", null)).toBe(false)
  })
})
