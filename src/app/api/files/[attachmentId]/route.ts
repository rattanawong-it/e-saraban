import type { Readable } from "node:stream"

import { NextResponse } from "next/server"

import { isServiceError } from "@/server/services/errors"
import { openAttachment } from "@/server/services/attachment.service"
import { getAppSession } from "@/server/session"

// ทางเดียวที่จะเข้าถึงไฟล์แนบได้ (spec §8.3)
//
// ⚠️ **ห้ามมี URL ตรงถึงไฟล์เด็ดขาด** — ไฟล์เก็บนอก public/ และเสิร์ฟผ่านที่นี่เท่านั้น
// เพราะทุกครั้งที่มีคนเปิดไฟล์ต้องผ่าน can() + ตรวจชั้นความลับ + เขียน audit
// ซึ่ง static file server ทำให้ไม่ได้
//
// ครบทั้งเจ็ดข้อของ §8.3 แล้วตั้งแต่ P3: ตรวจ session · can() · ชั้นความลับ · ถอดรหัส stream ·
// แปะลายน้ำทับทุกหน้าของเอกสารลับ · เขียน audit · ส่งกลับ

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/files/[attachmentId]">,
) {
  const session = await getAppSession()

  // ตอบ 401 ไม่ redirect — ผู้เรียกคือ <img>/<iframe>/fetch ไม่ใช่การกดลิงก์
  if (!session) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 })
  }

  const { attachmentId } = await params

  try {
    const file = await openAttachment(session.ctx, attachmentId)

    // ชื่อไฟล์ภาษาไทยต้องส่งเป็น filename* แบบ RFC 5987 ไม่งั้นเบราว์เซอร์อ่านเป็นตัวขยะ
    const encodedName = encodeURIComponent(file.fileName)

    // §8.3 — เอกสารลับส่งแบบ inline เท่านั้น ให้เบราว์เซอร์เปิดดู ไม่ใช่ชวนให้บันทึกลงเครื่อง
    // (ไม่ใช่การป้องกันเชิงเทคนิคที่สมบูรณ์ · ลายน้ำกับ audit คือมาตรการจริง)
    const disposition = file.inlineOnly
      ? `inline; filename*=UTF-8''${encodedName}`
      : `attachment; filename*=UTF-8''${encodedName}`

    return new NextResponse(toWebStream(file.stream), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.sizeBytes),
        "Content-Disposition": disposition,
        // เอกสารลับต้องไม่ถูกเก็บใน cache ของเบราว์เซอร์หรือ proxy ระหว่างทาง
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    if (isServiceError(error)) {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 400
      return NextResponse.json({ error: error.message }, { status })
    }

    throw error
  }
}

/** Node stream → Web stream ที่ Response ต้องการ */
function toWebStream(stream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
      stream.on("end", () => controller.close())
      stream.on("error", (error) => controller.error(error))
    },
    cancel() {
      stream.destroy()
    },
  })
}
