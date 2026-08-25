import type { Metadata } from "next"

import { APP_NAME, REGISTER } from "@/constants"
import { prisma } from "@/lib/db"
import { DEFAULT_SETTINGS } from "@/lib/settings"
import { AuthBrandPanel, AuthFormPanel } from "@/components/auth/auth-shell"
import { RegisterForm, type OrgUnitOption } from "@/components/auth/register-form"

export const metadata: Metadata = {
  title: `${REGISTER.title} · ${APP_NAME}`,
}

export default async function RegisterPage() {
  // หน้านี้เปิดให้คนที่ยังไม่ล็อกอินเข้าถึงได้ จึงเปิดเผยเฉพาะ id กับชื่อหน่วยงาน
  // ซึ่งเป็นข้อมูลสาธารณะอยู่แล้ว (ปรากฏในผังองค์กรของสถาบัน)
  const units = await prisma.orgUnit.findMany({
    where: { isActive: true },
    orderBy: { path: "asc" },
    select: { id: true, nameTh: true, level: true },
  })

  const orgUnits: OrgUnitOption[] = units.map((unit) => ({
    id: unit.id,
    label: unit.nameTh,
    level: unit.level,
  }))

  return (
    <>
      <AuthBrandPanel title={REGISTER.heroTitle} subtitle={REGISTER.heroSubtitle} />
      <AuthFormPanel wide>
        {/*
          ลิงก์ย้อนกลับกับหัวข้ออยู่ในฟอร์ม ไม่ใช่ที่นี่ เพราะตัวอย่างซ่อนทั้งสองอย่าง
          เมื่อส่งคำขอสำเร็จ — สถานะนั้นอยู่ฝั่ง client เท่านั้น
        */}
        {/*
          หน้านี้ยังไม่รู้ว่าผู้สมัครจะสังกัด tenant ใด จึงใช้ค่าปริยายของนโยบายรหัสผ่าน
          เป็นตัวบอกความยาวขั้นต่ำบนหน้าจอ — การบังคับจริงเกิดที่ submitRegistration
          ซึ่งอ่านค่าของ tenant ตามหน่วยงานที่เลือก
        */}
        <RegisterForm orgUnits={orgUnits} passwordMinLength={DEFAULT_SETTINGS.password.minLength} />
      </AuthFormPanel>
    </>
  )
}
