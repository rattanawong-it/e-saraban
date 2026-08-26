import { beforeEach, describe, expect, it, vi } from "vitest"

// ต้อง mock ก่อน import ตัวจริง — โมดูลอ่าน prisma ตอนโหลด
const createMany = vi.fn()

vi.mock("@/lib/db", () => ({ prisma: { notification: { createMany } } }))

const { InAppNotificationAdapter } = await import("./in-app")
const { NOTIFICATION_TYPES, notificationHref } = await import("./types")

// D10 · spec §11.2 — สัญญาข้อสำคัญที่สุดของ adapter ตัวนี้คือ **ห้าม throw**
// การแจ้งเตือนพลาดต้องไม่ทำให้การออกเลข/เวียนหนังสือที่สำเร็จไปแล้วถูก rollback

const adapter = new InAppNotificationAdapter()

const message = {
  recipientUserId: "user-1",
  type: NOTIFICATION_TYPES.documentCirculated,
  title: "มีหนังสือเวียนถึงคุณ",
  body: "ขออนุมัติจัดประชุม",
  refType: "DOCUMENT" as const,
  refId: "doc-1",
}

beforeEach(() => {
  createMany.mockReset()
  createMany.mockResolvedValue({ count: 1 })
})

describe("InAppNotificationAdapter", () => {
  it("ประกาศช่องทางเป็น IN_APP", () => {
    expect(adapter.channel).toBe("IN_APP")
  })

  it("เขียนแถวเดียวครบทุกฟิลด์", async () => {
    await adapter.send(message)

    expect(createMany).toHaveBeenCalledTimes(1)
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "user-1",
          type: "document.circulated",
          title: "มีหนังสือเวียนถึงคุณ",
          body: "ขออนุมัติจัดประชุม",
          refType: "DOCUMENT",
          refId: "doc-1",
        },
      ],
    })
  })

  it("ผู้รับหลายคนเขียนรอบเดียว ไม่ใช่วนทีละคน", async () => {
    await adapter.sendMany([
      message,
      { ...message, recipientUserId: "user-2" },
      { ...message, recipientUserId: "user-3" },
    ])

    expect(createMany).toHaveBeenCalledTimes(1)
    expect(createMany.mock.calls.at(0)?.[0].data).toHaveLength(3)
  })

  it("ไม่มีผู้รับ = ไม่แตะฐานข้อมูลเลย", async () => {
    await adapter.sendMany([])

    expect(createMany).not.toHaveBeenCalled()
  })

  it("แปลง refType/refId ที่ไม่ได้ส่งมาเป็น null", async () => {
    await adapter.send({
      recipientUserId: "user-1",
      type: NOTIFICATION_TYPES.documentClosed,
      title: "ปิดเรื่องแล้ว",
      body: "",
    })

    expect(createMany.mock.calls.at(0)?.[0].data[0]).toMatchObject({ refType: null, refId: null })
  })

  // ── สัญญาข้อที่ห้ามพัง ────────────────────────────────────────────────
  it("ฐานข้อมูลล่มแล้วต้องไม่ throw — ไม่งั้นการออกเลขที่สำเร็จแล้วจะถูก rollback", async () => {
    createMany.mockRejectedValue(new Error("connection terminated"))
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(adapter.send(message)).resolves.toBeUndefined()

    // กลืน error ได้ แต่ต้องไม่กลืนเงียบ — ต้องเหลือร่องรอยในล็อก
    expect(logged).toHaveBeenCalledOnce()
    logged.mockRestore()
  })
})

describe("notificationHref", () => {
  it("เอกสารพาไปหน้ารายละเอียด", () => {
    expect(notificationHref("DOCUMENT", "doc-1")).toBe("/documents/doc-1")
  })

  it("ไม่มีที่อ้างถึง = ไม่มีลิงก์ (กระดิ่งต้องไม่พาไป /documents/null)", () => {
    expect(notificationHref(null, null)).toBeUndefined()
    expect(notificationHref("DOCUMENT", null)).toBeUndefined()
    expect(notificationHref(null, "doc-1")).toBeUndefined()
  })
})
