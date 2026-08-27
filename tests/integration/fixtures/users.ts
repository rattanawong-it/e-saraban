import { prisma } from "@/lib/db"

// ผู้ใช้ที่ชุด integration สร้างขึ้นเอง — ไม่ยืมบัญชีจาก seed
//
// ⚠️ บทเรียนจาก CI รอบแรก (§23.16 ข้อ 2): สามชุดเทสต์เคยยืม `rattana.wong` มาเป็น
// นายทะเบียนหนังสือลับโดยหวังว่าเธอมีชั้นความลับ 2 ซึ่งจริงเฉพาะบนฐาน dev ที่ถูกแก้
// ด้วยมือตอนทดสอบ P3 · seed ให้เธอชั้น 1 ตามที่ตั้งใจ (เธอคือผู้ใช้สองสังกัดของ P1)
// ฐานที่เกิดใหม่จึงแดงยกชุด — ทั้งที่โค้ดไม่ได้ผิดอะไรเลย
//
// กติกาที่ได้มาจากเรื่องนี้: **ชุดเทสต์ที่ต้องการผู้ใช้ที่มีคุณสมบัติเฉพาะ ต้องสร้างเอง**
// ไม่ใช่ค้นหาจาก seed แล้วหวังว่าคุณสมบัตินั้นจะยังอยู่ · แนวเดียวกับที่
// `tests/e2e/fixtures/db-fixture.ts` ทำกับบัญชี `e2e.runner` มาตั้งแต่ต้น

/**
 * ผู้ใช้ชุดนี้ไม่เคยผ่านหน้าล็อกอิน จึงไม่ต้องแฮชด้วย argon2 ให้เสียเวลา
 * (e2e ต้องล็อกอินจริงจึงต้องแฮช) · ค่านี้ตรวจกับรหัสผ่านใดก็ไม่ผ่าน
 */
const UNUSABLE_PASSWORD_HASH = "integration-test-user-never-logs-in"

/**
 * สร้าง (หรืออัปเดต) ผู้ใช้ของชุด integration ให้มีชั้นความลับตามที่เทสต์ต้องการ — เรียกซ้ำได้เสมอ
 *
 * ไม่ผูกสังกัดให้ เพราะสิทธิ์ของ integration test มาจาก `ServiceContext` ที่เทสต์ประกอบเอง
 * และการเป็นนายทะเบียนหนังสือลับก็ดูจากตาราง `ConfidentialRegistrar` ไม่ได้ดูสังกัด
 * (`eligibleRegistrars()` ตรวจแค่ `isActive` · `deletedAt` · `clearanceLevel`)
 *
 * ไม่ลบทิ้งตอน teardown โดยตั้งใจ — audit log กับ ACL อ้างถึงผู้ใช้ด้วย FK แบบ Restrict
 * บัญชีจึงค้างอยู่บนฐานแบบเดียวกับ `e2e.runner` · ชื่อขึ้นต้น `integration.` ให้ดูออกทันที
 */
export async function ensureIntegrationUser(input: {
  tenantId: string
  /** ต่อท้าย `integration.` เป็นชื่อผู้ใช้ — ตั้งให้บอกบทบาทในเทสต์ เช่น `registrar` */
  key: string
  firstName: string
  lastName: string
  clearanceLevel: number
}) {
  const username = `integration.${input.key}`

  return prisma.user.upsert({
    where: { username },
    // ⚠️ ต้องเขียนทับทุกครั้ง ไม่ใช่แค่ตอนสร้าง — ถ้ามีเทสต์ไหนไปปรับชั้นความลับหรือปิดบัญชี
    // รอบถัดไปจะเพี้ยนแบบหาสาเหตุยาก ซึ่งเป็นบั๊กประเภทเดียวกับที่ทำให้ต้องมีไฟล์นี้
    update: {
      clearanceLevel: input.clearanceLevel,
      isActive: true,
      deletedAt: null,
    },
    create: {
      tenantId: input.tenantId,
      username,
      passwordHash: UNUSABLE_PASSWORD_HASH,
      prefix: "นาย",
      firstName: input.firstName,
      lastName: input.lastName,
      clearanceLevel: input.clearanceLevel,
      mustChangePassword: false,
    },
  })
}
