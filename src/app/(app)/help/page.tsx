import type { Metadata } from "next"

import { APP_NAME, HELP, HELP_SECTIONS } from "@/constants"
import { canOrFalse, type Permission } from "@/lib/authz"
import { Alert, Card, CardBody, PageHeader } from "@/components/ui/primitives"
import { requireSession } from "@/server/session"

export const metadata: Metadata = {
  title: `${HELP.title} · ${APP_NAME}`,
}

// คู่มือผู้ใช้ในระบบ (spec §13 — P5)
//
// เป็น Server Component ล้วน ไม่มี JavaScript ฝั่ง client เลย — สารบัญใช้ anchor link
// ธรรมดา · คู่มือคือหน้าที่ต้องเปิดได้แม้ตอนที่อย่างอื่นในระบบมีปัญหา ยิ่งพึ่งพาน้อยยิ่งดี
//
// หมวดและข้อที่ผู้ใช้ไม่มีสิทธิ์ทำจะถูกซ่อน ตามหลักเดียวกับเมนูข้าง (§10.2) —
// คู่มือที่สอนสิ่งที่กดไม่ได้ทำให้หาเรื่องที่ต้องการเจอยากขึ้นเปล่า ๆ

export default async function HelpPage() {
  const session = await requireSession()

  const has = (permission?: string) =>
    !permission || canOrFalse(session.ctx, permission as Permission)

  const sections = HELP_SECTIONS.filter((section) => has(section.permission))
    .map((section) => ({
      ...section,
      entries: section.entries.filter((entry) => has(entry.permission)),
    }))
    .filter((section) => section.entries.length > 0)

  return (
    <>
      <PageHeader title={HELP.title} description={HELP.description} />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* สารบัญ — ติดขอบบนเมื่อเลื่อนบนจอกว้าง ส่วนจอเล็กวางไว้ด้านบนตามลำดับการอ่าน */}
        <nav
          aria-label={HELP.tocTitle}
          className="shrink-0 rounded-xl border border-border bg-card p-4 lg:sticky lg:top-6 lg:w-60"
        >
          <p className="mb-2 text-[12px] font-bold text-text-subtle">{HELP.tocTitle}</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 lg:flex-col lg:gap-1">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-[13.5px] font-medium text-text-medium hover:text-primary hover:underline"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {sections.map((section) => (
            <Card key={section.id} id={section.id} className="scroll-mt-6">
              <CardBody className="flex flex-col gap-5">
                <h2 className="text-[16px] font-bold text-text-strong">{section.title}</h2>

                {section.entries.map((entry) => (
                  <div key={entry.q}>
                    <h3 className="text-[14px] font-bold text-text-strong">{entry.q}</h3>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-text-medium">{entry.a}</p>

                    {/* ใช้ Alert ตัวเดียวกับที่ทั้งระบบใช้ ไม่ประกอบสีเตือนขึ้นมาเองซ้ำ */}
                    {entry.warn ? (
                      <Alert tone="warning" className="mt-2">
                        {entry.warn}
                      </Alert>
                    ) : null}
                  </div>
                ))}
              </CardBody>
            </Card>
          ))}

          <Card>
            <CardBody>
              <h2 className="text-[15px] font-bold text-text-strong">{HELP.contactTitle}</h2>
              <p className="mt-1 text-[13.5px] leading-relaxed text-text-medium">
                {HELP.contactBody}
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}
