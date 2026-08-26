import type { Metadata } from "next"
import Link from "next/link"
import {
  Building2,
  FileClock,
  FilePen,
  Inbox,
  KeyRound,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react"

import {
  APP_NAME,
  COMMON,
  CONFIDENTIALITY_LEVELS,
  DASHBOARD,
  ROLE_LABELS,
  URGENCY_LEVELS,
} from "@/constants"
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/audit"
import { formatThaiDate, formatThaiDateTime } from "@/lib/thai"
import type { RoleCode } from "@/lib/authz"
import {
  Badge,
  Card,
  CardHeader,
  ConfidentialityBadge,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui/primitives"
import {
  getAwaitingAcknowledgement,
  getDashboardStats,
  getDocumentStats,
  getRecentActivity,
} from "@/server/services/dashboard.service"
import { requireSession } from "@/server/session"

export const metadata: Metadata = {
  title: `${DASHBOARD.title} · ${APP_NAME}`,
}

export default async function DashboardPage() {
  const session = await requireSession()
  const [stats, documents, awaitingAck, activity] = await Promise.all([
    getDashboardStats(session.ctx),
    getDocumentStats(session.ctx),
    getAwaitingAcknowledgement(session.ctx),
    getRecentActivity(session.ctx),
  ])

  const today = formatThaiDate(new Date(), "long")

  return (
    <>
      <PageHeader
        title={DASHBOARD.title}
        description={`${session.activeAffiliation?.orgUnitName ?? ""} · ${today}`}
      />

      {/* งานหนังสือขึ้นก่อน — คนเปิดหน้านี้มาดูว่า "วันนี้ต้องทำอะไร" ไม่ได้มาดูจำนวนผู้ใช้ */}
      <h2 className="mb-3 text-[13px] font-bold text-text-strong">{DASHBOARD.documentSection}</h2>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={DASHBOARD.statPendingNumber}
          value={documents.pendingNumber.toLocaleString("th-TH")}
          tone={documents.pendingNumber > 0 ? "warning" : "neutral"}
          icon={<FileClock className="size-[18px]" aria-hidden />}
        />
        <StatCard
          label={DASHBOARD.statAwaitingAck}
          value={documents.awaitingMyAck.toLocaleString("th-TH")}
          tone={documents.awaitingMyAck > 0 ? "brand" : "neutral"}
          icon={<Inbox className="size-[18px]" aria-hidden />}
        />
        <StatCard
          label={DASHBOARD.statMyDrafts}
          value={documents.myDrafts.toLocaleString("th-TH")}
          tone="neutral"
          icon={<FilePen className="size-[18px]" aria-hidden />}
        />
        <StatCard
          label={DASHBOARD.statMyReturned}
          value={documents.myReturned.toLocaleString("th-TH")}
          tone={documents.myReturned > 0 ? "danger" : "neutral"}
          icon={<RotateCcw className="size-[18px]" aria-hidden />}
        />
      </div>

      <Card className="mt-4 p-5">
        <div className="mb-3 text-[12.5px] font-semibold text-text-subtle">
          {DASHBOARD.monthSection}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <MonthCount label={DASHBOARD.monthInternal} value={documents.thisMonth.internal} />
          <MonthCount label={DASHBOARD.monthOutgoing} value={documents.thisMonth.outgoing} />
          <MonthCount label={DASHBOARD.monthIncoming} value={documents.thisMonth.incoming} />
        </div>
      </Card>

      <h2 className="mt-7 mb-3 text-[13px] font-bold text-text-strong">
        {DASHBOARD.identitySection}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={DASHBOARD.statOrgUnits}
          value={stats.orgUnitCount.toLocaleString("th-TH")}
          tone="brand"
          icon={<Building2 className="size-[18px]" aria-hidden />}
        />
        <StatCard
          label={DASHBOARD.statUsers}
          value={stats.activeUserCount.toLocaleString("th-TH")}
          tone="info"
          icon={<Users className="size-[18px]" aria-hidden />}
        />
        <StatCard
          label={DASHBOARD.statMyAffiliations}
          value={stats.myAffiliationCount.toLocaleString("th-TH")}
          tone="gold"
          icon={<UserCheck className="size-[18px]" aria-hidden />}
        />
        {stats.canReadAudit ? (
          <StatCard
            label={DASHBOARD.statDeniedToday}
            value={stats.deniedTodayCount.toLocaleString("th-TH")}
            hint={`${DASHBOARD.statAuditToday}: ${stats.auditTodayCount.toLocaleString("th-TH")}`}
            tone={stats.deniedTodayCount > 0 ? "danger" : "success"}
            icon={<ShieldAlert className="size-[18px]" aria-hidden />}
          />
        ) : (
          <StatCard
            label={DASHBOARD.statAuditToday}
            value="—"
            hint={ROLE_LABELS.USER}
            tone="neutral"
            icon={<ShieldCheck className="size-[18px]" aria-hidden />}
          />
        )}
      </div>

      {stats.canManageUsers &&
      (stats.pendingRegistrationCount > 0 ||
        stats.pendingResetCount > 0 ||
        stats.lockedUserCount > 0) ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <StatCard
            label={DASHBOARD.statPendingRegistrations}
            value={stats.pendingRegistrationCount.toLocaleString("th-TH")}
            tone={stats.pendingRegistrationCount > 0 ? "warning" : "neutral"}
            icon={<UserPlus className="size-[18px]" aria-hidden />}
          />
          <StatCard
            label={DASHBOARD.statPendingResets}
            value={stats.pendingResetCount.toLocaleString("th-TH")}
            tone={stats.pendingResetCount > 0 ? "warning" : "neutral"}
            icon={<KeyRound className="size-[18px]" aria-hidden />}
          />
          <StatCard
            label={DASHBOARD.statLockedUsers}
            value={stats.lockedUserCount.toLocaleString("th-TH")}
            tone={stats.lockedUserCount > 0 ? "danger" : "neutral"}
            icon={<ShieldAlert className="size-[18px]" aria-hidden />}
          />
        </div>
      ) : null}

      {awaitingAck.length > 0 ? (
        <Card className="mt-5 overflow-hidden">
          <CardHeader
            title={DASHBOARD.awaitingAckTitle}
            action={
              <Link
                href="/inbox"
                className="text-[12.5px] font-semibold text-primary hover:underline"
              >
                {COMMON.showAll} →
              </Link>
            }
          />

          <ul>
            {awaitingAck.map((row) => (
              <li key={row.recipientId} className="border-b border-row-border last:border-b-0">
                <Link
                  href={`/documents/${row.id}`}
                  className="flex items-start justify-between gap-4 px-5 py-3.5 hover:bg-surface-sunken"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-semibold text-text-strong">
                      {row.subject}
                    </div>
                    <div className="tabular mt-0.5 text-[11.5px] text-text-subtle">
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

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader
            title={DASHBOARD.recentActivity}
            action={
              stats.canReadAudit ? (
                <Link
                  href="/admin/audit"
                  className="text-[12.5px] font-semibold text-primary hover:underline"
                >
                  {COMMON.showAll} →
                </Link>
              ) : null
            }
          />

          {activity.length === 0 ? (
            <EmptyState title={DASHBOARD.recentActivityEmpty} />
          ) : (
            <ul>
              {activity.map((row) => (
                <li
                  key={row.id}
                  className="flex items-start justify-between gap-4 border-b border-row-border px-5 py-3.5 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-text-strong">
                      {AUDIT_ACTION_LABELS[row.action as AuditAction] ?? row.action}
                    </div>
                    <div className="mt-0.5 truncate text-[11.5px] text-text-subtle">
                      {row.actor
                        ? `${row.actor.prefix ?? ""}${row.actor.firstName} ${row.actor.lastName}`.trim()
                        : "ระบบ"}
                    </div>
                  </div>
                  <div className="tabular shrink-0 text-[11.5px] text-text-subtle">
                    {formatThaiDateTime(row.at, "short")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title={DASHBOARD.myAffiliations} />
          <ul>
            {session.affiliations.map((affiliation) => (
              <li
                key={affiliation.orgUnitId}
                className="border-b border-row-border px-5 py-4 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-text-strong">
                      {affiliation.orgUnitName}
                    </div>
                    <div className="tabular mt-0.5 text-[11.5px] text-text-subtle">
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
                  <div className="mt-2 text-[11.5px] text-text-subtle">
                    {affiliation.positionTitle}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}

/** ตัวเลขหนึ่งช่องในการ์ด "หนังสือเดือนนี้" — เล็กกว่า StatCard เพราะเป็นข้อมูลอ้างอิง ไม่ใช่งานค้าง */
function MonthCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border px-4 py-3">
      <div className="text-[11.5px] text-text-subtle">{label}</div>
      <div className="tabular mt-1 text-[22px] font-bold text-text-strong">
        {value.toLocaleString("th-TH")}
      </div>
    </div>
  )
}
