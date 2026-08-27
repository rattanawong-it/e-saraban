"use client"

import { useActionState, useState } from "react"
import { Loader2, Save } from "lucide-react"

import { ROLES } from "@/constants"
import { PERMISSION_SCOPES, SCOPE_LABELS, type PermissionScope } from "@/lib/authz"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox, Select } from "@/components/ui/field"
import { Alert, Badge, Card, CardHeader } from "@/components/ui/primitives"
import { updateRolePermissionsAction } from "@/server/actions/admin.actions"
import { IDLE_STATE } from "@/server/actions/types"

// หน้าบทบาทและสิทธิ์ — ตาม project-ui/Admin Roles.dc.html
//
// ต่างจากดีไซน์ต้นแบบตรงที่ **แก้ไขได้จริง** ไม่ใช่แค่แสดงผล:
// spec §4 ระบุว่าตารางใน §4.2 เป็นค่าตั้งต้น ผู้ดูแลระบบแก้เองได้ที่หน้านี้
// จึงมี checkbox เปิด/ปิดสิทธิ์ และ dropdown เลือกขอบเขตของแต่ละสิทธิ์

export interface RoleView {
  id: string
  code: string
  nameTh: string
  description: string | null
  isSystem: boolean
  userCount: number
  permissions: Record<string, PermissionScope>
}

export interface PermissionView {
  code: string
  group: string
  nameTh: string
  description: string | null
}

export function RolesClient({
  roles,
  permissions,
}: {
  roles: RoleView[]
  permissions: PermissionView[]
}) {
  const [selectedId, setSelectedId] = useState(roles[0]?.id ?? "")
  const selected = roles.find((role) => role.id === selectedId) ?? roles[0]

  const groups = permissions.reduce<Record<string, PermissionView[]>>((acc, permission) => {
    const list = acc[permission.group] ?? []
    list.push(permission)
    acc[permission.group] = list
    return acc
  }, {})

  return (
    <div className="grid gap-5 xl:grid-cols-[19rem_1fr] xl:items-start">
      <div className="flex flex-col gap-2.5">
        {roles.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => setSelectedId(role.id)}
            className={cn(
              "cursor-pointer rounded-2xl border p-4 text-left transition-colors",
              role.id === selected?.id
                ? "border-primary bg-secondary"
                : "border-border bg-card hover:bg-muted",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-section font-bold text-text-strong">{role.nameTh}</span>
              {role.isSystem ? <Badge tone="neutral">{ROLES.systemRole}</Badge> : null}
            </div>
            <div className="tabular mt-1 text-micro text-text-subtle">{role.code}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone="brand">
                {`${Object.keys(role.permissions).length.toLocaleString("th-TH")} สิทธิ์`}
              </Badge>
              <span className="text-micro text-text-subtle">{ROLES.userCount(role.userCount)}</span>
            </div>
          </button>
        ))}
      </div>

      {selected ? <PermissionMatrix key={selected.id} role={selected} groups={groups} /> : null}
    </div>
  )
}

function PermissionMatrix({
  role,
  groups,
}: {
  role: RoleView
  groups: Record<string, PermissionView[]>
}) {
  const [state, formAction, pending] = useActionState(updateRolePermissionsAction, IDLE_STATE)

  return (
    <Card className="overflow-hidden">
      <CardHeader title={role.nameTh} description={role.description ?? undefined} />

      <form action={formAction}>
        <input type="hidden" name="roleId" value={role.id} />

        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-sunken px-5 py-3">
          <span className="text-micro font-bold text-text-subtle">{ROLES.scopeLegend}</span>
          {PERMISSION_SCOPES.map((scope) => (
            <Badge key={scope} tone="neutral">
              {SCOPE_LABELS[scope]}
            </Badge>
          ))}
        </div>

        {state.status === "error" ? (
          <div className="p-5 pb-0">
            <Alert tone="danger" title={state.message} />
          </div>
        ) : null}
        {state.status === "success" ? (
          <div className="p-5 pb-0">
            <Alert tone="success" title={state.message} />
          </div>
        ) : null}

        {role.code === "SYSTEM_ADMIN" ? (
          <div className="p-5 pb-0">
            <Alert tone="info" title={ROLES.adminNotice} />
          </div>
        ) : null}

        <div className="flex flex-col gap-5 p-5">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <div className="mb-2 text-micro font-bold tracking-wide text-text-subtle uppercase">
                {group}
              </div>

              <div className="overflow-hidden rounded-xl border border-border">
                {items.map((permission) => {
                  const scope = role.permissions[permission.code]
                  const enabled = Boolean(scope)

                  return (
                    <PermissionRow
                      key={permission.code}
                      permission={permission}
                      enabled={enabled}
                      scope={scope ?? "UNIT"}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-sunken px-5 py-4">
          <p className="max-w-lg text-micro leading-relaxed text-text-subtle">
            {ROLES.changeWarning}
          </p>
          <Button type="submit" disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            {ROLES.save}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function PermissionRow({
  permission,
  enabled,
  scope,
}: {
  permission: PermissionView
  enabled: boolean
  scope: PermissionScope
}) {
  const [checked, setChecked] = useState(enabled)

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 border-b border-row-border px-4 py-3 last:border-b-0",
        checked ? "bg-card" : "bg-surface-sunken",
      )}
    >
      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
        <Checkbox
          name={`perm:${permission.code}`}
          checked={checked}
          onChange={(event) => setChecked(event.currentTarget.checked)}
          className="mt-0.5"
        />
        <span className="min-w-0">
          <span
            className={cn(
              "block text-label font-semibold",
              checked ? "text-text-strong" : "text-text-subtle",
            )}
          >
            {permission.nameTh}
          </span>
          <span className="tabular block truncate text-micro text-text-subtle">
            {permission.code}
          </span>
          {permission.description ? (
            <span className="mt-0.5 block text-micro leading-relaxed text-text-subtle">
              {permission.description}
            </span>
          ) : null}
        </span>
      </label>

      <div className="w-40 shrink-0">
        <Select
          name={`scope:${permission.code}`}
          defaultValue={scope}
          disabled={!checked}
          aria-label={`${ROLES.scopeLegend} ${permission.nameTh}`}
          className="py-2 text-caption"
        >
          {PERMISSION_SCOPES.map((value) => (
            <option key={value} value={value}>
              {SCOPE_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}
