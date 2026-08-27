import type { Metadata } from "next"
import Link from "next/link"
import { FileClock, FilePen, Inbox, MailOpen, NotebookPen, RotateCcw, Send } from "lucide-react"

import {
  APP_NAME,
  COMMON,
  CONFIDENTIALITY_LEVELS,
  DASHBOARD,
  ROLE_LABELS,
  URGENCY_LEVELS,
} from "@/constants"
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/audit"
import { canOrFalse, PERMISSIONS, type RoleCode } from "@/lib/authz"
import { formatThaiDate, formatThaiDateTime } from "@/lib/thai"
import { cn } from "@/lib/utils"
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

  // เดิมธงนี้มาจาก getDashboardStats() ซึ่งยิง COUNT แปดครั้งเพื่อเอาตัวเลขของหมวด
  // "ผู้ใช้และหน่วยงาน" ที่ผู้ดูแลสั่งให้ถอดออก · ตอนนี้เหลือใช้แค่ธงสิทธิ์ตัวเดียว
  // จึงอ่านจาก context ตรง ๆ ไม่ต้องแตะฐานข้อมูลเลย
  const canReadAudit = canOrFalse(session.ctx, PERMISSIONS.AUDIT_READ)

  const today = formatThaiDate(new Date(), "long")

  const thisMonth = [
    {
      label: DASHBOARD.monthInternal,
      value: documents.thisMonth.internal,
      icon: <NotebookPen className="size-4.5" aria-hidden />,
    },
    {
      label: DASHBOARD.monthOutgoing,
      value: documents.thisMonth.outgoing,
      icon: <Send className="size-4.5" aria-hidden />,
    },
    {
      label: DASHBOARD.monthIncoming,
      value: documents.thisMonth.incoming,
      icon: <MailOpen className="size-4.5" aria-hidden />,
    },
  ]

  return (
    // ── หน้าเดียวจบ ไม่มีแถบเลื่อนของหน้า (เฉพาะจอ lg ขึ้นไป ตามที่ผู้ดูแลกำหนด) ──────
    //
    // ⚠️ สูตรนี้ผูกกับค่าที่นิยามอยู่ที่อื่นสองตัว ถ้าใครไปแก้ต้องมาแก้ที่นี่ด้วย:
    //     4.25rem = ความสูง header (`h-17` ใน app-header.tsx)
    //     3.5rem  = padding บน+ล่างของ <main> (`lg:py-7` ใน app-shell.tsx คือ 1.75rem × 2)
    //   มี e2e ล็อกไว้แล้ว ("หน้าภาพรวมต้องจบในหน้าจอเดียว") — แก้ความสูง header
    //   แล้วลืมมาแก้ตรงนี้ เทสต์จะแดงทันทีแทนที่จะเงียบแล้วปล่อยให้หน้าล้นทีหลัง
    //
    // ⚠️ ทุกชั้นที่เป็น flex ระหว่างกล่องนี้ลงไปถึงกล่องที่เลื่อนได้ ต้องมี `min-h-0`
    //   ไม่งั้นกล่องลูกจะ "ยืดออก" แทนที่จะ "เลื่อน" (พฤติกรรมปริยายของ flex item
    //   คือ min-height:auto ซึ่งห้ามไม่ให้หดต่ำกว่าเนื้อหาข้างใน)
    //
    // ต่ำกว่า lg ปล่อยให้เลื่อนทั้งหน้าตามปกติ — จอมือถือยัดทุกอย่างลงหน้าเดียว
    // ได้ก็ต่อเมื่อบีบจนอ่านไม่ออก
    <div className="lg:flex lg:h-[calc(100dvh-4.25rem-3.5rem)] lg:flex-col lg:overflow-hidden">
      <PageHeader
        title={DASHBOARD.title}
        description={`${session.activeAffiliation?.orgUnitName ?? ""} · ${today}`}
      />

      {/* ตัวเลขสรุปทั้งหมดอยู่ในกรอบเดียว — คนเปิดหน้านี้มาดูว่า "วันนี้ต้องทำอะไร"
          เดิมกระจายเป็นการ์ดแยกสี่ใบบวกอีกใบของยอดรายเดือน ต้องกวาดตาห้าจุด
          กว่าจะตอบตัวเองได้ว่ามีงานค้างหรือเปล่า

          ยอดรายเดือนอยู่แถบล่างของกรอบเดียวกันแต่พื้นต่างสี เพราะเป็น "ข้อมูลอ้างอิง"
          ไม่ใช่ "งานที่ต้องลงมือ" — ถ้าวางเสมอกันสายตาจะให้น้ำหนักเท่ากันทั้งที่ไม่ควร */}
      {/* ทรงตามตัวอย่างที่ผู้ดูแลส่งมา (docs/sample_dashboard.png) — แบ่งเป็นสองกลุ่ม
          ที่มีหัวข้อกำกับของตัวเอง ไอคอนเป็นแผ่นสี่เหลี่ยมมนวางซ้าย ป้ายอยู่บน ตัวเลขอยู่ล่าง
          และช่องที่ยังมีงานค้างเป็นสีเขียวอ่อน ส่วนช่องที่เป็นศูนย์เป็นสีเทา

          ต่างจากตัวอย่างอยู่จุดเดียว: แถบ "หนังสือเดือนนี้" ของตัวอย่างวางสามช่องเรียงแนวนอน
          แต่ชื่อจริงของเรายาวกว่าตัวอย่างมาก ("บันทึกข้อความภายใน") พอบีบลงสามคอลัมน์
          ในครึ่งการ์ดแล้วชื่อโดนตัดทุกช่อง — เรียงเป็นสามแถวแทน อ่านครบและสูงพอ ๆ กัน */}
      <Card className="overflow-hidden lg:shrink-0">
        <CardHeader title={DASHBOARD.documentSection} />

        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <section>
            <h2 className="text-caption font-semibold text-text-subtle">
              {DASHBOARD.actionSection}
            </h2>

            <StatRow
              className="mt-2.5"
              items={[
                {
                  label: DASHBOARD.statPendingNumber,
                  value: documents.pendingNumber.toLocaleString("th-TH"),
                  tone: documents.pendingNumber > 0 ? "warning" : "neutral",
                  icon: <FileClock className="size-5.5" aria-hidden />,
                },
                {
                  label: DASHBOARD.statAwaitingAck,
                  value: documents.awaitingMyAck.toLocaleString("th-TH"),
                  tone: documents.awaitingMyAck > 0 ? "brand" : "neutral",
                  icon: <Inbox className="size-5.5" aria-hidden />,
                },
                {
                  label: DASHBOARD.statMyDrafts,
                  value: documents.myDrafts.toLocaleString("th-TH"),
                  tone: documents.myDrafts > 0 ? "brand" : "neutral",
                  icon: <FilePen className="size-5.5" aria-hidden />,
                },
                {
                  label: DASHBOARD.statMyReturned,
                  value: documents.myReturned.toLocaleString("th-TH"),
                  tone: documents.myReturned > 0 ? "danger" : "neutral",
                  icon: <RotateCcw className="size-5.5" aria-hidden />,
                },
              ]}
            />
          </section>

          <section>
            <h2 className="text-caption font-semibold text-text-subtle">
              {DASHBOARD.monthSection}
            </h2>

            <div className="mt-2.5 divide-y divide-border overflow-hidden rounded-xl border border-border">
              {thisMonth.map((row) => (
                <div
                  key={row.label}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5",
                    row.value > 0 ? "bg-brand-pale" : "bg-surface-sunken",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl bg-card",
                      row.value > 0 ? "text-primary" : "text-text-subtle",
                    )}
                  >
                    {row.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-label font-semibold text-text-medium">
                    {row.label}
                  </span>
                  <span className="tabular text-title font-bold text-text-strong">
                    {row.value.toLocaleString("th-TH")}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </Card>

      {awaitingAck.length > 0 ? (
        <Card className="mt-5 overflow-hidden lg:flex lg:min-h-0 lg:flex-[1_1_0] lg:flex-col">
          <CardHeader
            title={DASHBOARD.awaitingAckTitle}
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
                  className="flex items-start justify-between gap-4 px-5 py-3.5 hover:bg-surface-sunken"
                >
                  <div className="min-w-0">
                    <div className="truncate text-label font-semibold text-text-strong">
                      {row.subject}
                    </div>
                    <div className="tabular mt-0.5 text-micro text-text-subtle">
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

      <div className="mt-5 grid gap-5 lg:min-h-0 lg:flex-[2_1_0] lg:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden lg:flex lg:min-h-0 lg:flex-col">
          <CardHeader
            title={DASHBOARD.recentActivity}
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
                  className="flex items-start justify-between gap-4 border-b border-row-border px-5 py-3.5 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="text-label font-semibold text-text-strong">
                      {AUDIT_ACTION_LABELS[row.action as AuditAction] ?? row.action}
                    </div>
                    <div className="mt-0.5 truncate text-micro text-text-subtle">
                      {row.actor
                        ? `${row.actor.prefix ?? ""}${row.actor.firstName} ${row.actor.lastName}`.trim()
                        : "ระบบ"}
                    </div>
                  </div>
                  <div className="tabular shrink-0 text-micro text-text-subtle">
                    {formatThaiDateTime(row.at, "short")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden lg:flex lg:min-h-0 lg:flex-col">
          <CardHeader title={DASHBOARD.myAffiliations} />
          <ul className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {session.affiliations.map((affiliation) => (
              <li
                key={affiliation.orgUnitId}
                className="border-b border-row-border px-5 py-4 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-label font-semibold text-text-strong">
                      {affiliation.orgUnitName}
                    </div>
                    <div className="tabular mt-0.5 text-micro text-text-subtle">
                      {affiliation.orgUnitCode}
                    </div>
                  </div>
                  {affiliation.isPrimary ? (
                    <Badge tone="brand">{DASHBOARD.primaryBadge}</Badge>
                  ) : null}
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {affiliation.roleCodes.map((code) => (
                    <Badge key={code} tone="neutral" dot>
                      {ROLE_LABELS[code as RoleCode] ?? code}
                    </Badge>
                  ))}
                </div>

                {affiliation.positionTitle ? (
                  <div className="mt-2 text-micro text-text-subtle">
                    {affiliation.positionTitle}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
