// สตับของ `next/headers` สำหรับ integration test
//
// เส้นทางล็อกอิน (ทั้งรหัสผ่านและ Google) เป็นโค้ดชุดเดียวในระบบที่แตะ cookie และ
// header ของ request โดยตรง — ของจริงมีได้เฉพาะตอนมี request จริงเท่านั้น
// จึงต้องมีตัวแทนที่เก็บค่าไว้ในหน่วยความจำ ไม่งั้นทดสอบ auth.service ตัวจริงไม่ได้เลย
//
// ⚠️ เก็บสถานะไว้ที่ระดับโมดูล — เทสต์ต้องเรียก `__resetRequestState()` ระหว่างเคส
// ไม่งั้น cookie ของเซสชันจากเคสก่อนหน้าจะค้างมาถึงเคสถัดไป

const cookieStore = new Map<string, string>()

let requestHeaders = new Headers()

export async function cookies() {
  return {
    get(name: string) {
      const value = cookieStore.get(name)
      return value === undefined ? undefined : { name, value }
    },
    set(name: string, value: string) {
      cookieStore.set(name, value)
    },
    delete(name: string) {
      cookieStore.delete(name)
    },
  }
}

export async function headers() {
  return requestHeaders
}

/** ล้าง cookie และ header ที่ค้างจากเคสก่อน — เรียกใน beforeEach เสมอ */
export function __resetRequestState(init?: Record<string, string>) {
  cookieStore.clear()
  requestHeaders = new Headers(init ?? { "user-agent": "integration-test" })
}

/** อ่าน cookie ที่โค้ดตัวจริงเพิ่งตั้ง — ใช้ยืนยันว่าเซสชันถูกสร้างจริง */
export function __getCookie(name: string) {
  return cookieStore.get(name)
}
