// ข้อความของการแจ้งเตือน in-app (spec §12 · D10)
//
// แยกไฟล์จาก ui.ts เพราะข้อความชุดนี้ถูก **เขียนลงฐานข้อมูล** ตอนเกิดเหตุการณ์
// ไม่ใช่ข้อความที่ render สด · แก้คำที่นี่แล้วแถวเก่าในตารางจะยังเป็นคำเดิม
// (ตั้งใจให้เป็นแบบนั้น — แจ้งเตือนคือบันทึกว่า "ตอนนั้นระบบบอกอะไร")

export const NOTIFICATION_TEXT = {
  // ── หัวข้อ ────────────────────────────────────────────────────────
  circulatedTitle: "มีหนังสือเวียนถึงคุณ",
  submittedTitle: "มีหนังสือรอออกเลข",
  numberIssuedTitle: "หนังสือของคุณได้เลขทะเบียนแล้ว",
  returnedTitle: "หนังสือถูกตีกลับให้แก้ไข",
  closedTitle: "ปิดเรื่องแล้ว",

  /**
   * ข้อความแทนชื่อเรื่องของเอกสารชั้น 1-3
   *
   * ⚠️ ชื่อเรื่องของหนังสือลับคือตัวความลับเอง (บทเรียน §22.2) การแจ้งเตือนอ่านได้
   * โดยไม่ผ่านด่าน can() ของเอกสาร จึงห้ามพา subject ออกมาทางนี้เด็ดขาด
   */
  confidentialSubject: "(หนังสือลับ — เปิดดูรายละเอียดในระบบ)",

  /** ไม่มีเลขที่ยังไม่ออก — ใช้ในข้อความที่อ้างถึงเลขหนังสือ */
  noDocNo: "ยังไม่มีเลข",
} as const

/** ประกอบเนื้อความจากชิ้นส่วนที่ปลอดภัยแล้ว — ตัวตัดสินเรื่องชั้นความลับอยู่ที่ผู้เรียก */
export const NOTIFICATION_BODY = {
  circulated: (subject: string, from: string) => `${subject} · จาก ${from}`,
  submitted: (subject: string, unit: string) => `${subject} · หน่วยงาน ${unit}`,
  numberIssued: (subject: string, docNo: string) => `${subject} · เลขที่ ${docNo}`,
  returned: (subject: string, note: string) =>
    note ? `${subject} · เหตุผล: ${note}` : `${subject} · ไม่ได้ระบุเหตุผล`,
  closed: (subject: string) => subject,
} as const

/** ข้อความบนหน้าจอของกระดิ่งและหน้ารายการ — แยกจาก NOTIFICATION_TEXT ที่ถูกเขียนลงฐาน */
export const NOTIFICATION_UI = {
  panelTitle: "การแจ้งเตือน",
  markAllRead: "อ่านทั้งหมดแล้ว",
  viewAll: "ดูทั้งหมด",
  empty: "ยังไม่มีการแจ้งเตือน",
  emptyHint: "เมื่อมีหนังสือเวียนถึงคุณ ถูกตีกลับ หรือได้เลขทะเบียน จะแจ้งให้ทราบที่นี่",
  loading: "กำลังโหลด...",
  unreadBadge: "ยังไม่อ่าน",

  // ── หน้า /notifications ──────────────────────────────────────────
  pageTitle: "การแจ้งเตือน",
  pageDescription: "เรื่องที่ระบบแจ้งให้คุณทราบ เรียงจากใหม่ไปเก่า",

  /** ตัวเลขบนกระดิ่งเมื่อเกิน UNREAD_CAP */
  overflowCount: (cap: number) => `${cap}+`,
} as const
