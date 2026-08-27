import * as React from "react"
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"

// ชิ้นส่วน UI พื้นฐานที่ใช้ซ้ำทั้งระบบ — ถอดจาก project-ui/Design System.dc.html
// การ์ด · ป้ายสถานะ · แถบแจ้งเตือน · หัวข้อหน้า · สถานะว่าง

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-border bg-card", className)} {...props} />
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4",
        className,
      )}
    >
      <div>
        <div className="text-body font-bold text-text-strong">{title}</div>
        {description ? (
          <div className="mt-0.5 text-caption text-text-subtle">{description}</div>
        ) : null}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />
}

const BADGE_TONES = {
  neutral: "bg-muted text-text-medium ring-border",
  brand: "bg-brand-pale text-primary ring-primary/20",
  success: "bg-success-bg text-success-text ring-success/25",
  warning: "bg-warning-bg text-warning-text ring-warning/25",
  danger: "bg-danger-bg text-danger-text ring-danger/25",
  info: "bg-info-bg text-info-text ring-info/25",
  gold: "bg-gold-bg text-gold-text ring-gold/25",
} as const

export type BadgeTone = keyof typeof BADGE_TONES

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-micro font-bold ring-1 ring-inset",
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span className="size-[7px] rounded-full bg-current" /> : null}
      {children}
    </span>
  )
}

/** ป้ายชั้นความลับ 4 ระดับ (spec §8.1) — สีตรงตามตารางในสเปก */
const CONFIDENTIALITY_TONES: Record<number, string> = {
  0: "bg-conf-0-bg text-conf-0-text ring-conf-0/25",
  1: "bg-conf-1-bg text-conf-1-text ring-conf-1/30",
  2: "bg-conf-2-bg text-conf-2-text ring-conf-2/30",
  3: "bg-conf-3-bg text-conf-3-text ring-conf-3/30",
}

export function ConfidentialityBadge({ level, label }: { level: number; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-micro font-bold ring-1 ring-inset",
        CONFIDENTIALITY_TONES[level] ?? CONFIDENTIALITY_TONES[0],
      )}
    >
      <span className="size-[7px] rounded-full bg-current" />
      {label}
    </span>
  )
}

const ALERT_TONES = {
  success: { cls: "bg-success-bg text-success-text ring-success/25", Icon: CheckCircle2 },
  warning: { cls: "bg-warning-bg text-warning-text ring-warning/25", Icon: AlertTriangle },
  danger: { cls: "bg-danger-bg text-danger-text ring-danger/25", Icon: XCircle },
  info: { cls: "bg-info-bg text-info-text ring-info/25", Icon: Info },
} as const

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof ALERT_TONES
  title?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  const { cls, Icon } = ALERT_TONES[tone]

  return (
    <div
      className={cn("flex gap-3 rounded-xl px-4 py-3.5 ring-1 ring-inset", cls, className)}
      role={tone === "danger" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 size-[18px] shrink-0" aria-hidden />
      <div className="min-w-0 text-label leading-relaxed">
        {title ? <div className="font-bold">{title}</div> : null}
        {children}
      </div>
    </div>
  )
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-title-l font-bold text-text-strong">{title}</h1>
        {description ? <p className="mt-1 text-label text-text-subtle">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string
  description?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon ? <div className="mb-3 text-text-subtle">{icon}</div> : null}
      <div className="text-section font-semibold text-text-medium">{title}</div>
      {description ? (
        <div className="mt-1.5 max-w-sm text-caption leading-relaxed text-text-subtle">
          {description}
        </div>
      ) : null}
    </div>
  )
}

/** ตัวเลขหนึ่งช่องใน StatRow */
export interface StatItem {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: BadgeTone
  icon?: React.ReactNode
}

/**
 * แผ่นตัวเลขสรุปเรียงเป็นตาราง — ทรงตามตัวอย่างที่ผู้ดูแลส่งมา (docs/sample_dashboard.png)
 *
 * แต่ละแผ่นวางไอคอนไว้ซ้ายเป็นสี่เหลี่ยมมนขนาดใหญ่ แล้ววางป้ายกับตัวเลขซ้อนกันทางขวา
 * — อ่านได้ในสายตาเดียวว่า "เรื่องอะไร กี่ฉบับ" ต่างจากทรงเดิมที่ป้ายอยู่บนสุด
 * ตัวเลขอยู่ล่างสุด และไอคอนลอยอยู่มุมขวาโดยไม่ได้เกี่ยวกับอะไร
 *
 * ⚠️ สีของแผ่นผูกกับ "มีงานค้างหรือไม่" ไม่ใช่ผูกกับชนิดของงาน — ผู้เรียกส่ง tone
 * มาเป็น neutral เมื่อค่าเป็นศูนย์ ตามตัวอย่างที่ช่องค่าศูนย์เป็นสีเทาและช่องที่มีค่า
 * เป็นสีเขียวอ่อน · คนกวาดตาผ่านจึงเห็นทันทีว่ามีอะไรต้องทำบ้างโดยไม่ต้องอ่านตัวเลข
 */
export function StatRow({ items, className }: { items: StatItem[]; className?: string }) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-3.5"
        >
          {item.icon ? (
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-2xl",
                BADGE_TONES[item.tone ?? "neutral"],
              )}
            >
              {item.icon}
            </span>
          ) : null}

          <div className="min-w-0">
            <div className="truncate text-caption font-semibold text-text-subtle">{item.label}</div>
            <div className="tabular mt-0.5 text-display leading-none font-bold text-text-strong">
              {item.value}
            </div>
            {item.hint ? <div className="mt-1 text-micro text-text-subtle">{item.hint}</div> : null}
          </div>
        </div>
      ))}
    </div>
  )
}
