import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { APP_NAME, REGISTER } from "@/constants"
import { prisma } from "@/lib/db"
import { AuthBrandPanel, AuthFormPanel, AuthHeading } from "@/components/auth/auth-shell"
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
        <Link
          href="/login"
          className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {REGISTER.backToLogin}
        </Link>
        <AuthHeading title={REGISTER.title} subtitle={REGISTER.subtitle} />
        <RegisterForm orgUnits={orgUnits} />
      </AuthFormPanel>
    </>
  )
}
