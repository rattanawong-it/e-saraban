import Link from "next/link"
import { Construction } from "lucide-react"

import { COMING_SOON } from "@/constants"
import { Button } from "@/components/ui/button"
import { Badge, Card } from "@/components/ui/primitives"

// หน้าแทนสำหรับเมนูที่ยังไม่ถึงเฟส
//
// ทำเป็นหน้าจริงแทนที่จะปล่อย 404 เพราะเมนูใน sidebar ถอดมาจากผัง §10.1 ทั้งผัง
// ผู้ใช้ที่กดเข้ามาควรได้คำอธิบายว่าทำไมยังไม่มี ไม่ใช่หน้าเออเรอร์

export function ComingSoon({
  title,
  phase,
  description,
}: {
  title: string
  phase: string
  description?: string
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="px-8 py-14 text-center">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-secondary">
          <Construction className="size-8 text-primary" strokeWidth={1.6} aria-hidden />
        </div>

        <Badge tone="warning" className="mb-4">
          {COMING_SOON.badge} · {phase}
        </Badge>

        <h1 className="text-title-l font-bold text-text-strong">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-label leading-relaxed text-text-subtle">
          {description ?? COMING_SOON.body(phase)}
        </p>

        <Button asChild variant="outline" className="mt-7">
          <Link href="/dashboard">{COMING_SOON.backToDashboard}</Link>
        </Button>
      </Card>
    </div>
  )
}
