import type { Metadata } from "next"
import Link from "next/link"
import { Download } from "lucide-react"

import { APP_NAME, AUDIT } from "@/constants"
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  type AuditAction,
  type AuditEntityType,
} from "@/lib/audit"
import { PERMISSIONS } from "@/lib/authz"
import { formatThaiDateTime } from "@/lib/thai"
import { cn } from "@/lib/utils"
import { ChainVerifyButton } from "@/components/admin/audit-client"
import { Button } from "@/components/ui/button"
import { Alert, Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives"
import { listAuditLogs, type AuditFilter } from "@/server/services/audit.service"
import { requirePermission } from "@/server/session"

export const metadata: Metadata = {
  title: `${AUDIT.title} · ${APP_NAME}`,
}

// ตัวกรองสำเร็จรูป — ตรงกับ chip ใน project-ui/Admin Audit.dc.html
const FILTER_CHIPS = [
  { key: "", label: AUDIT.filterAll },
  { key: "denied", label: AUDIT.filterDenied },
  { key: "critical", label: AUDIT.filterCritical },
  { key: "login", label: AUDIT.filterLogin },
  { key: "admin", label: AUDIT.filterAdmin },
] as const

function buildFilter(chip: string, page: number): AuditFilter {
  const base: AuditFilter = { page, pageSize: 50 }

  switch (chip) {
    case "denied":
      return { ...base, result: "DENY" }
    case "critical":
      return { ...base, severity: "CRITICAL" }
    case "login":
      return { ...base, entityType: "Session" }
    case "admin":
      return { ...base, entityType: "Role" }
    default:
      return base
  }
}

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const session = await requirePermission(PERMISSIONS.AUDIT_READ)
  const params = await searchParams

  const chip = typeof params.filter === "string" ? params.filter : ""
  const page = Number(typeof params.page === "string" ? params.page : 1) || 1

  const result = await listAuditLogs(session.ctx, buildFilter(chip, page))
  const totalPages = Math.max(Math.ceil(result.total / result.pageSize), 1)

  return (
    <>
      <PageHeader
        title={AUDIT.title}
        description={AUDIT.description}
        action={
          <div className="flex flex-wrap items-start gap-2.5">
            <ChainVerifyButton />
            <Button asChild variant="outline" size="sm">
              <a href={`/admin/audit/export?filter=${chip}`}>
                <Download className="size-4" aria-hidden />
                {AUDIT.exportCsv}
              </a>
            </Button>
          </div>
        }
      />

      <Alert tone="info" className="mb-4">
        {AUDIT.appendOnlyNotice}
      </Alert>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTER_CHIPS.map((item) => (
          <Link
            key={item.key || "all"}
            href={item.key ? `/admin/audit?filter=${item.key}` : "/admin/audit"}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
              chip === item.key
                ? "bg-primary text-primary-foreground"
                : "bg-card text-text-medium ring-1 ring-border ring-inset hover:bg-muted",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[62rem] border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-sunken">
                {[
                  AUDIT.colTime,
                  AUDIT.colActor,
                  AUDIT.colAction,
                  AUDIT.colEntity,
                  AUDIT.colResult,
                  AUDIT.colIp,
                ].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="px-5 py-3 text-left text-[11px] font-bold tracking-wide text-text-subtle uppercase"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id} className="border-b border-row-border last:border-b-0">
                  <td className="tabular px-5 py-3 text-[12px] whitespace-nowrap text-text-medium">
                    {formatThaiDateTime(row.at, "short")}
                  </td>
                  <td className="px-5 py-3 text-[12.5px]">
                    <div className="font-semibold text-text-strong">
                      {row.actorName ?? AUDIT.system}
                    </div>
                    <div className="tabular text-[11px] text-text-subtle">
                      {[row.actorUsername, row.actorOrgUnitName].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[12.5px] text-text-strong">
                    {AUDIT_ACTION_LABELS[row.action as AuditAction] ?? row.action}
                    <div className="tabular text-[10.5px] text-text-subtle">{row.action}</div>
                  </td>
                  <td className="px-5 py-3 text-[12px] text-text-medium">
                    {AUDIT_ENTITY_LABELS[row.entityType as AuditEntityType] ?? row.entityType}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={row.result === "DENY" ? "danger" : severityTone(row.severity)} dot>
                      {row.result === "DENY" ? "DENY" : "ALLOW"}
                    </Badge>
                  </td>
                  <td className="tabular px-5 py-3 text-[11.5px] whitespace-nowrap text-text-subtle">
                    {row.ip ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {result.rows.length === 0 ? <EmptyState title={AUDIT.empty} /> : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3.5">
          <div className="tabular text-[12px] text-text-subtle">{AUDIT.total(result.total)}</div>

          <div className="flex items-center gap-2.5">
            <PageLink chip={chip} page={page - 1} disabled={page <= 1} label={AUDIT.previous} />
            <span className="tabular text-[12px] text-text-medium">
              {AUDIT.page} {page} {AUDIT.of} {totalPages}
            </span>
            <PageLink
              chip={chip}
              page={page + 1}
              disabled={page >= totalPages}
              label={AUDIT.next}
            />
          </div>
        </div>
      </Card>
    </>
  )
}

function severityTone(severity: string) {
  if (severity === "CRITICAL") return "danger" as const
  if (severity === "WARNING") return "warning" as const
  if (severity === "NOTICE") return "info" as const
  return "success" as const
}

function PageLink({
  chip,
  page,
  disabled,
  label,
}: {
  chip: string
  page: number
  disabled: boolean
  label: string
}) {
  if (disabled) {
    return (
      <span className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-text-subtle opacity-50">
        {label}
      </span>
    )
  }

  const query = new URLSearchParams()
  if (chip) query.set("filter", chip)
  query.set("page", String(page))

  return (
    <Link
      href={`/admin/audit?${query.toString()}`}
      className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-primary hover:bg-secondary"
    >
      {label}
    </Link>
  )
}
