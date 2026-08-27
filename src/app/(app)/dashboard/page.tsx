import type { Metadata } from "next"
import Link from "next/link"
import { CalendarDays, FileClock, FilePen, Inbox, RotateCcw } from "lucide-react"

import { APP_NAME, COMMON, CONFIDENTIALITY_LEVELS, DASHBOARD, URGENCY_LEVELS } from "@/constants"
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/audit"
import { canOrFalse, PERMISSIONS } from "@/lib/authz"
import { formatThaiDate, formatThaiDateTime } from "@/lib/thai"
import {
  Badge,
  Card,
  CardHeader,
  ConfidentialityBadge,
  EmptyState,
  PageHeader,
  StatRow,
} from "@/components/ui/primitives"
import {
  getAwaitingAcknowledgement,
  getDocumentStats,
  getRecentActivity,
} from "@/server/services/dashboard.service"
import { requireSession } from "@/server/session"

export const metadata: Metadata = {
  title: `${DASHBOARD.title} · ${APP_NAME}`,
}

export default async function DashboardPage() {
  const session = await requireSession()
  const [documents, awaitingAck, activity] = await Promise.all([
    getDocumentStats(session.ctx),
    getAwaitingAcknowledgement(session.ctx),
    getRecentActivity(session.ctx),
  ])

  // ธงสิทธิ์ตัวเดียวที่หน้านี้ต้องใช้ — อ่านจาก context ตรง ๆ ไม่ต้องแตะฐานข้อมูล
  const canReadAudit = canOrFalse(session.ctx, PERMISSIONS.AUDIT_READ)

  const today = formatThaiDate(new Date(), "long")

  const month = documents.thisMonth
  const monthTotal = month.internal + month.outgoing + month.incoming

  return (
    // ── หน้าเดียวจบ ไม่มีแถบเลื่อนของหน้า (เฉพาะจอ lg ขึ้นไป ตามที่ผู้ดูแลกำหนด) ──────
    //
    // ⚠️ สูตรนี้ผูกกับค่าที่นิยามอยู่ที่อื่นสองตัว ถ้าใครไปแก้ต้องมาแก้ที่นี่ด้วย:
    //     4.25rem = ความสูง header (`h-17` ใน app-header.tsx)
    //     3.5rem  = padding บน+ล่างของ <main> (`lg:py-7` ใน app-shell.tsx คือ 1.75rem × 2)
    //   มี e2e ล็อกไว้แล้ว ("หน้าภาพรวมจบในหน้าจอเดียว") — แก้ความสูง header
    //   แล้วลืมมาแก้ตรงนี้ เทสต์จะแดงทันทีแทนที่จะเงียบแล้วปล่อยให้หน้าล้นทีหลัง
    //
    // ⚠️ ทุกชั้นที่เป็น flex ระหว่างกล่องนี้ลงไปถึงกล่องที่เลื่อนได้ ต้องมี `min-h-0`
    //   ไม่งั้นกล่องลูกจะ "ยืดออก" แทนที่จะ "เลื่อน" (พฤติกรรมปริยายของ flex item
    //   คือ min-height:auto ซึ่งห้ามไม่ให้หดต่ำกว่าเนื้อหาข้างใน)
    <div className="lg:flex lg:h-[calc(100dvh-4.25rem-3.5rem)] lg:flex-col lg:overflow-hidden">
      <PageHeader
        title={DASHBOARD.title}
        description={`${session.activeAffiliation?.orgUnitName ?? ""} · ${today}`}
        className="mb-4"
      />

      {/* แถบงานค้าง — สี่แผ่นเรียงแถวเดียวทรงเตี้ย (docs/sample_v2.png)
          ยอดออกเลขเดือนนี้เป็นชิปมุมขวาของหัวการ์ด แยกรายทิศทางตอนชี้เมาส์
          (docs/sample_v3.png) — เดิมกินครึ่งการ์ดเป็นสามแถว */}
      <Card className="overflow-hidden lg:shrink-0">
        <CardHeader
          title={DASHBOARD.actionSection}
          className="py-3"
          action={
            <span
              title={DASHBOARD.monthBreakdown(month.internal, month.outgoing, month.incoming)}
              className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-border bg-surface-sunken px-3 py-1 text-caption font-semibold text-text-medium"
            >
              <CalendarDays className="size-4 text-text-subtle" aria-hidden />
              {DASHBOARD.monthChip(monthTotal)}
            </span>
          }
        />

        <StatRow
          className="p-4"
          items={[
            {
              label: DASHBOARD.statPendingNumber,
              value: documents.pendingNumber.toLocaleString("th-TH"),
              tone: documents.pendingNumber > 0 ? "warning" : "neutral",
              icon: <FileClock className="size-4.5" aria-hidden />,
            },
            {
              label: DASHBOARD.statAwaitingAck,
              value: documents.awaitingMyAck.toLocaleString("th-TH"),
              tone: documents.awaitingMyAck > 0 ? "brand" : "neutral",
              icon: <Inbox className="size-4.5" aria-hidden />,
            },
            {
              label: DASHBOARD.statMyDrafts,
              value: documents.myDrafts.toLocaleString("th-TH"),
              tone: documents.myDrafts > 0 ? "brand" : "neutral",
              icon: <FilePen className="size-4.5" aria-hidden />,
            },
            {
              label: DASHBOARD.statMyReturned,
              value: documents.myReturned.toLocaleString("th-TH"),
              tone: documents.myReturned > 0 ? "danger" : "neutral",
              icon: <RotateCcw className="size-4.5" aria-hidden />,
            },
          ]}
        />
      </Card>

      {awaitingAck.length > 0 ? (
        <Card className="mt-4 overflow-hidden lg:flex lg:min-h-0 lg:flex-[1_1_0] lg:flex-col">
          <CardHeader
            title={DASHBOARD.awaitingAckTitle}
            className="py-3"
            action={
              <Link
                href="/inbox"
                className="text-caption font-semibold text-primary hover:underline"
              >
                {COMMON.showAll} →
              </Link>
            }
          />

          <ul className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {awaitingAck.map((row) => (
              <li key={row.recipientId} className="border-b border-row-border last:border-b-0">
                <Link
                  href={`/documents/${row.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-sunken"
                >
                  <div className="min-w-0">
                    <div className="truncate text-label font-semibold text-text-strong">
                      {row.subject}
                    </div>
                    <div className="tabular text-micro text-text-subtle">
                      {row.docNo ?? DASHBOARD.noDocNoYet}
                      {row.dueDate
                        ? ` · ${DASHBOARD.awaitingAckDue(formatThaiDate(row.dueDate, "short"))}`
                        : ""}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {row.confidentialityLevel > 0 ? (
                      <ConfidentialityBadge
                        level={row.confidentialityLevel}
                        label={CONFIDENTIALITY_LEVELS[row.confidentialityLevel]?.label ?? ""}
                      />
                    ) : null}
                    {row.urgencyLevel > 0 ? (
                      <Badge tone={row.urgencyLevel >= 2 ? "danger" : "warning"}>
                        {URGENCY_LEVELS[row.urgencyLevel]?.label}
                      </Badge>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="mt-4 overflow-hidden lg:flex lg:min-h-0 lg:flex-[2_1_0] lg:flex-col">
        <CardHeader
          title={DASHBOARD.recentActivity}
          className="py-3"
          action={
            canReadAudit ? (
              <Link
                href="/admin/audit"
                className="text-caption font-semibold text-primary hover:underline"
              >
                {COMMON.showAll} →
              </Link>
            ) : null
          }
        />

        {activity.length === 0 ? (
          <EmptyState title={DASHBOARD.recentActivityEmpty} />
        ) : (
          <ul className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {activity.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 border-b border-row-border px-4 py-2.5 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-label font-semibold text-text-strong">
                    {AUDIT_ACTION_LABELS[row.action as AuditAction] ?? row.action}
                  </div>
                  <div className="truncate text-micro text-text-subtle">
                    {row.actor
                      ? `${row.actor.prefix ?? ""}${row.actor.firstName} ${row.actor.lastName}`.trim()
                      : DASHBOARD.systemActor}
                  </div>
                </div>

                {/* ผู้ดูแลขอให้เห็นสถานะของกิจกรรมด้วย — DENY คือความพยายามเข้าถึงที่ถูกปฏิเสธ
                    ซึ่งเป็นสิ่งที่ต้องสะดุดตาที่สุดในรายการนี้ (§8.5) */}
                <Badge tone={row.result === "DENY" ? "danger" : "success"} dot>
                  {row.result === "DENY" ? DASHBOARD.activityDenied : DASHBOARD.activityAllowed}
                </Badge>

                <div className="tabular shrink-0 text-micro text-text-subtle">
                  {formatThaiDateTime(row.at, "short")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
