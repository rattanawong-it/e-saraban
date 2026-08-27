import { DOCUMENTS } from "@/constants"
import { formatThaiDateTime } from "@/lib/thai"
import { cn } from "@/lib/utils"
import {
  ACTION_LABELS,
  STATUS_LABELS,
  type DocumentActionTypeValue,
  type DocumentStatusValue,
} from "@/schemas/document.schema"
import { Card, CardHeader, EmptyState } from "@/components/ui/primitives"

// ประวัติการดำเนินการที่ผู้ใช้เห็น (spec §6.4)
//
// ⚠️ นี่คือ DocumentAction ไม่ใช่ AuditLog — คนละชั้นกันโดยตั้งใจ
// ที่นี่เล่าเรื่องให้เจ้าหน้าที่อ่าน ส่วน audit เป็นหลักฐานของผู้ตรวจสอบ

export interface TimelineEntry {
  id: string
  actionType: DocumentActionTypeValue
  fromStatus: DocumentStatusValue | null
  toStatus: DocumentStatusValue | null
  note: string | null
  createdAt: Date
  actorName: string | null
  actorUnitName: string | null
}

/** การกระทำที่ควรสะดุดตา — ผู้ใช้กวาดตาหาสองอย่างนี้ก่อนเสมอ */
const HIGHLIGHTED: Partial<Record<DocumentActionTypeValue, string>> = {
  RETURNED: "bg-danger text-white",
  NUMBER_ISSUED: "bg-primary text-primary-foreground",
  CANCELLED: "bg-danger text-white",
  CLOSED: "bg-success text-white",
}

export function DocumentTimeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title={DOCUMENTS.detailTimeline} />

      {entries.length === 0 ? (
        <EmptyState title={DOCUMENTS.timelineEmpty} />
      ) : (
        <ol className="flex flex-col gap-0 p-5">
          {entries.map((entry, index) => (
            <li key={entry.id} className="relative flex gap-3.5 pb-5 last:pb-0">
              {/* เส้นเชื่อมระหว่างจุด — ตัวสุดท้ายไม่ต้องมี ไม่งั้นจะมีหางลอยอยู่ */}
              {index < entries.length - 1 ? (
                <span className="absolute top-6 bottom-0 left-[11px] w-px bg-border" aria-hidden />
              ) : null}

              <span
                className={cn(
                  "z-1 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-micro font-bold ring-4 ring-card",
                  HIGHLIGHTED[entry.actionType] ?? "bg-muted text-text-medium",
                )}
                aria-hidden
              >
                {entries.length - index}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-label font-bold text-text-strong">
                    {ACTION_LABELS[entry.actionType]}
                  </span>
                  {entry.fromStatus && entry.toStatus && entry.fromStatus !== entry.toStatus ? (
                    <span className="text-micro text-text-subtle">
                      {DOCUMENTS.timelineStatus(
                        STATUS_LABELS[entry.fromStatus],
                        STATUS_LABELS[entry.toStatus],
                      )}
                    </span>
                  ) : null}
                </div>

                <div className="tabular mt-0.5 text-micro text-text-subtle">
                  {entry.actorName ?? DOCUMENTS.actorSystem}
                  {entry.actorUnitName ? ` · ${entry.actorUnitName}` : ""}
                  {` · ${formatThaiDateTime(entry.createdAt)}`}
                </div>

                {entry.note ? (
                  <p className="mt-1.5 rounded-lg bg-surface-sunken px-3 py-2 text-caption leading-relaxed whitespace-pre-line text-text-medium">
                    {entry.note}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
