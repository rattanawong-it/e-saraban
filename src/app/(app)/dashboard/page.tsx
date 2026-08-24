import type { Metadata } from "next"
import Link from "next/link"
import {
  Building2,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react"

import { APP_NAME, COMMON, DASHBOARD, ROLE_LABELS } from "@/constants"
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/audit"
import { formatThaiDate, formatThaiDateTime } from "@/lib/thai"
import type { RoleCode } from "@/lib/authz"
import {
  Alert,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui/primitives"
import { getDashboardStats, getRecentActivity } from "@/server/services/dashboard.service"
import { requireSession } from "@/server/session"

export const metadata: Metadata = {
  title: `${DASHBOARD.title} · ${APP_NAME}`,
}

export default async function DashboardPage() {
  const session = await requireSession()
  const [stats, activity] = await Promise.all([
    getDashboardStats(session.ctx),
    getRecentActivity(session.ctx),
  ])

  const today = formatThaiDate(new Date(), "long")

  return (
    <>
      <PageHeader
        title={DASHBOARD.title}
        description={`${session.activeAffiliation?.orgUnitName ?? ""} · ${today}`}
      />

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

      <Alert tone="info" className="mt-5" title={DASHBOARD.phaseNoticeTitle}>
        {DASHBOARD.phaseNoticeBody}
      </Alert>

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
