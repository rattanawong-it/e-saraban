"use client"

import { useActionState, useEffect, useState } from "react"
import {
  Ban,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from "lucide-react"

import { CONFIDENTIALITY_LEVELS, COMMON, ROLE_LABELS, USERS } from "@/constants"
import type { RoleCode } from "@/lib/authz"
import { formatThaiDateTime } from "@/lib/thai"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox, Field, Select, TextInput } from "@/components/ui/field"
import {
  Alert,
  Badge,
  Card,
  CardHeader,
  ConfidentialityBadge,
  EmptyState,
} from "@/components/ui/primitives"
import {
  addAffiliationAction,
  createUserAction,
  removeAffiliationAction,
  resetPasswordAction,
  reviewRegistrationAction,
  setUserActiveAction,
  updateUserAction,
  type TemporaryPasswordData,
} from "@/server/actions/user.actions"
import { IDLE_STATE, type ActionState } from "@/server/actions/types"

// หน้าจัดการผู้ใช้ — ตาม project-ui/Admin Users.dc.html
// เพิ่มจากดีไซน์: คิวคำขอสมัครใช้งาน และคิวคำขอรีเซ็ตรหัสผ่าน
// ซึ่งจำเป็นเพราะ MVP ไม่มีอีเมล (D10) ผู้ดูแลต้องจัดการทั้งสองอย่างจากที่นี่

export interface UserRow {
  id: string
  username: string
  fullName: string
  initials: string
  email: string | null
  prefix: string | null
  firstName: string
  lastName: string
  clearanceLevel: number
  isActive: boolean
  isLocked: boolean
  mustChangePassword: boolean
  lastLoginAt: string | null
  hasPendingReset: boolean
  affiliations: {
    orgUnitId: string
    orgUnitName: string
    orgUnitShortName: string | null
    positionTitle: string | null
    isPrimary: boolean
    roleCodes: string[]
  }[]
}

export interface OrgUnitOption {
  id: string
  nameTh: string
  level: number
}

export interface RoleOption {
  code: string
  nameTh: string
}

export interface RegistrationRow {
  id: string
  fullName: string
  username: string
  email: string
  orgUnitName: string
  positionTitle: string | null
  note: string | null
  createdAt: string
}

export interface ResetRow {
  id: string
  email: string
  userId: string | null
  userFullName: string | null
  createdAt: string
}

const INITIAL_TEMP_STATE: ActionState<TemporaryPasswordData> = { status: "idle" }

export function UsersClient({
  users,
  orgUnits,
  roles,
  registrations,
  resets,
  query,
  showInactive,
}: {
  users: UserRow[]
  orgUnits: OrgUnitOption[]
  roles: RoleOption[]
  registrations: RegistrationRow[]
  resets: ResetRow[]
  query: string
  showInactive: boolean
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // ผู้ใช้ที่เลือกไว้หายจากรายการ (เปลี่ยนคำค้น/ถูกกรองออก) → ตกกลับไปที่คนแรก
  const selected = users.find((user) => user.id === selectedId) ?? users[0] ?? null

  return (
    <div className="flex flex-col gap-5">
      {registrations.length > 0 || resets.length > 0 ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <RegistrationQueue registrations={registrations} roles={roles} />
          <ResetQueue resets={resets} />
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr] xl:items-start">
        <Card className="overflow-hidden">
          <CardHeader
            title={USERS.listTitle}
            description={`${users.length.toLocaleString("th-TH")} บัญชี`}
            action={
              <Button size="sm" onClick={() => setCreating((value) => !value)}>
                <UserPlus className="size-4" aria-hidden />
                {USERS.addUser}
              </Button>
            }
          />

          <form
            method="get"
            className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-sunken px-5 py-3"
          >
            <div className="flex min-w-52 flex-1 items-center gap-2.5">
              <Search className="size-4 shrink-0 text-text-subtle" aria-hidden />
              <input
                name="q"
                defaultValue={query}
                placeholder={USERS.searchPlaceholder}
                className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-text-strong outline-none placeholder:text-text-subtle"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-text-medium">
              <Checkbox name="inactive" value="1" defaultChecked={showInactive} />
              {USERS.showInactive}
            </label>
            <Button type="submit" size="xs" variant="outline">
              {COMMON.search}
            </Button>
          </form>

          {creating ? (
            <div className="border-b border-border bg-surface-sunken p-5">
              <CreateUserForm orgUnits={orgUnits} roles={roles} onDone={() => setCreating(false)} />
            </div>
          ) : null}

          {users.length === 0 ? (
            <EmptyState title={USERS.emptyList} />
          ) : (
            <ul>
              {users.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(user.id)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3.5 border-b border-row-border px-5 py-3.5 text-left transition-colors last:border-b-0",
                      user.id === selectedId ? "bg-secondary" : "hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold",
                        user.isActive ? "bg-brand-pale text-primary" : "bg-muted text-text-subtle",
                      )}
                    >
                      {user.initials}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-text-strong">
                        {user.fullName}
                      </span>
                      <span className="tabular block truncate text-[11.5px] text-text-subtle">
                        {user.username}
                        {user.affiliations[0] ? ` · ${user.affiliations[0].orgUnitName}` : ""}
                      </span>
                    </span>

                    <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      {user.hasPendingReset ? (
                        <Badge tone="warning">{USERS.pendingReset}</Badge>
                      ) : null}
                      {user.isLocked ? <Badge tone="danger">{COMMON.locked}</Badge> : null}
                      {!user.isActive ? <Badge tone="neutral">{COMMON.inactive}</Badge> : null}
                      {user.affiliations.length > 1 ? (
                        <Badge tone="info">{`${user.affiliations.length} สังกัด`}</Badge>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {selected ? (
          <UserDetail user={selected} orgUnits={orgUnits} roles={roles} />
        ) : (
          <Card>
            <EmptyState title={USERS.selectPrompt} />
          </Card>
        )}
      </div>
    </div>
  )
}

function UserDetail({
  user,
  orgUnits,
  roles,
}: {
  user: UserRow
  orgUnits: OrgUnitOption[]
  roles: RoleOption[]
}) {
  const [state, formAction, pending] = useActionState(updateUserAction, IDLE_STATE)
  const [addingAffiliation, setAddingAffiliation] = useState(false)

  const clearance = CONFIDENTIALITY_LEVELS.find((item) => item.level === user.clearanceLevel)

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3.5 border-b border-border px-5 py-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-pale text-[15px] font-bold text-primary">
            {user.initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold text-text-strong">{user.fullName}</div>
            <div className="tabular truncate text-xs text-text-subtle">{user.username}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border px-5 py-3">
          {user.isActive ? (
            <Badge tone="success" dot>
              {COMMON.active}
            </Badge>
          ) : (
            <Badge tone="neutral" dot>
              {COMMON.inactive}
            </Badge>
          )}
          <ConfidentialityBadge
            level={user.clearanceLevel}
            label={`${USERS.clearance}: ${clearance?.label ?? user.clearanceLevel}`}
          />
          {user.mustChangePassword ? (
            <Badge tone="warning">{USERS.mustChangePassword}</Badge>
          ) : null}
        </div>

        <form action={formAction} className="flex flex-col gap-4 p-5" key={user.id}>
          <input type="hidden" name="id" value={user.id} />

          {state.status === "error" ? <Alert tone="danger" title={state.message} /> : null}
          {state.status === "success" ? <Alert tone="success" title={state.message} /> : null}

          <div className="grid grid-cols-[6.5rem_1fr] gap-3">
            <Field label="คำนำหน้า" htmlFor="prefix">
              <TextInput id="prefix" name="prefix" defaultValue={user.prefix ?? ""} />
            </Field>
            <Field label="ชื่อ" htmlFor="firstName" errors={state.fieldErrors?.firstName}>
              <TextInput id="firstName" name="firstName" defaultValue={user.firstName} required />
            </Field>
          </div>

          <Field label="นามสกุล" htmlFor="lastName" errors={state.fieldErrors?.lastName}>
            <TextInput id="lastName" name="lastName" defaultValue={user.lastName} required />
          </Field>

          <Field label="อีเมล" htmlFor="email" errors={state.fieldErrors?.email}>
            <TextInput id="email" name="email" type="email" defaultValue={user.email ?? ""} />
          </Field>

          <Field
            label={USERS.clearance}
            htmlFor="clearanceLevel"
            errors={state.fieldErrors?.clearanceLevel}
            hint="ผู้ใช้เข้าถึงเอกสารได้ไม่เกินชั้นความลับนี้ และยังต้องมี ACL ระบุตัวบุคคลสำหรับเอกสารลับขึ้นไป (spec §8.1)"
          >
            <Select
              id="clearanceLevel"
              name="clearanceLevel"
              defaultValue={String(user.clearanceLevel)}
            >
              {CONFIDENTIALITY_LEVELS.map((level) => (
                <option key={level.level} value={level.level}>
                  {`${level.level} — ${level.label}`}
                </option>
              ))}
            </Select>
          </Field>

          <div className="tabular text-[11.5px] text-text-subtle">
            {USERS.lastLogin}:{" "}
            {user.lastLoginAt ? formatThaiDateTime(user.lastLoginAt) : USERS.neverLoggedIn}
          </div>

          <Button type="submit" disabled={pending} block>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            {COMMON.saveChanges}
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title={USERS.affiliations}
          action={
            <Button size="xs" variant="ghost" onClick={() => setAddingAffiliation((v) => !v)}>
              <Plus className="size-3.5" aria-hidden />
              {USERS.addAffiliation}
            </Button>
          }
        />

        <ul>
          {user.affiliations.map((affiliation) => (
            <li
              key={affiliation.orgUnitId}
              className="flex items-start gap-3 border-b border-row-border px-5 py-3.5 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-text-strong">
                    {affiliation.orgUnitName}
                  </span>
                  {affiliation.isPrimary ? <Badge tone="brand">{USERS.primary}</Badge> : null}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {affiliation.roleCodes.map((code) => (
                    <Badge key={code} tone="neutral">
                      {ROLE_LABELS[code as RoleCode] ?? code}
                    </Badge>
                  ))}
                </div>
                {affiliation.positionTitle ? (
                  <div className="mt-1 text-[11.5px] text-text-subtle">
                    {affiliation.positionTitle}
                  </div>
                ) : null}
              </div>

              {user.affiliations.length > 1 ? (
                <RemoveAffiliationButton userId={user.id} orgUnitId={affiliation.orgUnitId} />
              ) : null}
            </li>
          ))}
        </ul>

        {addingAffiliation ? (
          <div className="border-t border-border bg-surface-sunken p-5">
            <AddAffiliationForm
              userId={user.id}
              orgUnits={orgUnits.filter(
                (unit) => !user.affiliations.some((a) => a.orgUnitId === unit.id),
              )}
              roles={roles}
              onDone={() => setAddingAffiliation(false)}
            />
          </div>
        ) : null}
      </Card>

      <AccountActions user={user} />
    </div>
  )
}

function RemoveAffiliationButton({ userId, orgUnitId }: { userId: string; orgUnitId: string }) {
  const [state, formAction, pending] = useActionState(removeAffiliationAction, IDLE_STATE)

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="orgUnitId" value={orgUnitId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={USERS.removeAffiliation}
        title={state.status === "error" ? state.message : USERS.removeAffiliation}
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-text-subtle transition-colors hover:bg-danger-bg hover:text-danger"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Trash2 className="size-4" aria-hidden />
        )}
      </button>
    </form>
  )
}

function AddAffiliationForm({
  userId,
  orgUnits,
  roles,
  onDone,
}: {
  userId: string
  orgUnits: OrgUnitOption[]
  roles: RoleOption[]
  onDone: () => void
}) {
  const [state, formAction, pending] = useActionState(addAffiliationAction, IDLE_STATE)

  useEffect(() => {
    if (state.status === "success") onDone()
  }, [state.status, onDone])

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="userId" value={userId} />

      {state.status === "error" ? <Alert tone="danger" title={state.message} /> : null}

      <Field label="หน่วยงาน" htmlFor="aff-orgUnitId" errors={state.fieldErrors?.orgUnitId}>
        <Select id="aff-orgUnitId" name="orgUnitId" defaultValue="" required>
          <option value="" disabled>
            เลือกหน่วยงาน...
          </option>
          {orgUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {`${"— ".repeat(unit.level)}${unit.nameTh}`}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={USERS.role} htmlFor="aff-roleCode" errors={state.fieldErrors?.roleCode}>
        <Select id="aff-roleCode" name="roleCode" defaultValue="USER">
          {roles.map((role) => (
            <option key={role.code} value={role.code}>
              {role.nameTh}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="ตำแหน่ง" htmlFor="aff-positionTitle">
        <TextInput id="aff-positionTitle" name="positionTitle" />
      </Field>

      <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-text-medium">
        <Checkbox name="isPrimary" />
        ตั้งเป็นสังกัดหลัก
      </label>

      <div className="flex gap-2.5">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
          {USERS.addAffiliation}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          {COMMON.cancel}
        </Button>
      </div>
    </form>
  )
}

function AccountActions({ user }: { user: UserRow }) {
  const [resetState, resetAction, resetPending] = useActionState(
    resetPasswordAction,
    INITIAL_TEMP_STATE,
  )
  const [activeState, activeAction, activePending] = useActionState(setUserActiveAction, IDLE_STATE)

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 p-5">
        {resetState.status === "error" ? <Alert tone="danger" title={resetState.message} /> : null}
        {activeState.status === "error" ? (
          <Alert tone="danger" title={activeState.message} />
        ) : null}

        {resetState.status === "success" && resetState.data ? (
          <TemporaryPasswordPanel data={resetState.data} />
        ) : null}

        <div className="flex flex-wrap gap-2.5">
          <form action={resetAction} className="flex-1">
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="username" value={user.username} />
            <Button type="submit" variant="outline" size="sm" block disabled={resetPending}>
              {resetPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <KeyRound className="size-4" aria-hidden />
              )}
              {USERS.resetPassword}
            </Button>
          </form>

          <form action={activeAction} className="flex-1">
            <input type="hidden" name="userId" value={user.id} />
            {user.isActive ? null : <input type="hidden" name="isActive" value="1" />}
            <Button
              type="submit"
              variant={user.isActive ? "destructive" : "outline"}
              size="sm"
              block
              disabled={activePending}
            >
              {activePending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : user.isActive ? (
                <Ban className="size-4" aria-hidden />
              ) : (
                <ShieldCheck className="size-4" aria-hidden />
              )}
              {user.isActive ? USERS.suspend : USERS.activate}
            </Button>
          </form>
        </div>
      </div>
    </Card>
  )
}

/** แสดงรหัสผ่านชั่วคราวครั้งเดียว — MVP ไม่มีอีเมล ผู้ดูแลต้องคัดลอกไปแจ้งเอง (D10) */
function TemporaryPasswordPanel({ data }: { data: TemporaryPasswordData }) {
  const [copied, setCopied] = useState(false)

  return (
    <Alert tone="warning" title={USERS.temporaryPasswordTitle}>
      <p className="mt-1 leading-relaxed">{USERS.temporaryPasswordBody}</p>
      <div className="mt-3 flex items-center gap-2.5">
        <code className="tabular flex-1 rounded-lg bg-card px-3 py-2 text-[15px] font-bold tracking-wider text-text-strong">
          {data.temporaryPassword}
        </code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(data.temporaryPassword).then(() => setCopied(true))
          }}
        >
          {copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          {copied ? COMMON.copied : COMMON.copy}
        </Button>
      </div>
    </Alert>
  )
}

function CreateUserForm({
  orgUnits,
  roles,
  onDone,
}: {
  orgUnits: OrgUnitOption[]
  roles: RoleOption[]
  onDone: () => void
}) {
  const [state, formAction, pending] = useActionState(createUserAction, INITIAL_TEMP_STATE)

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-bold text-text-strong">{USERS.createTitle}</div>
        <button
          type="button"
          onClick={onDone}
          aria-label={COMMON.close}
          className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-text-subtle hover:bg-muted"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {state.status === "error" ? <Alert tone="danger" title={state.message} /> : null}
      {state.status === "success" && state.data ? (
        <TemporaryPasswordPanel data={state.data} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="คำนำหน้า" htmlFor="new-prefix">
          <TextInput id="new-prefix" name="prefix" placeholder="นาย" />
        </Field>
        <Field label="ชื่อ" htmlFor="new-firstName" errors={state.fieldErrors?.firstName}>
          <TextInput id="new-firstName" name="firstName" required />
        </Field>
        <Field label="นามสกุล" htmlFor="new-lastName" errors={state.fieldErrors?.lastName}>
          <TextInput id="new-lastName" name="lastName" required />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ชื่อผู้ใช้" htmlFor="new-username" errors={state.fieldErrors?.username}>
          <TextInput id="new-username" name="username" className="tabular" required />
        </Field>
        <Field label="อีเมล" htmlFor="new-email" errors={state.fieldErrors?.email}>
          <TextInput id="new-email" name="email" type="email" />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="หน่วยงานที่สังกัด"
          htmlFor="new-orgUnitId"
          errors={state.fieldErrors?.orgUnitId}
        >
          <Select id="new-orgUnitId" name="orgUnitId" defaultValue="" required>
            <option value="" disabled>
              เลือกหน่วยงาน...
            </option>
            {orgUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {`${"— ".repeat(unit.level)}${unit.nameTh}`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={USERS.role} htmlFor="new-roleCode" errors={state.fieldErrors?.roleCode}>
          <Select id="new-roleCode" name="roleCode" defaultValue="USER">
            {roles.map((role) => (
              <option key={role.code} value={role.code}>
                {role.nameTh}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ตำแหน่ง" htmlFor="new-positionTitle">
          <TextInput id="new-positionTitle" name="positionTitle" />
        </Field>
        <Field label={USERS.clearance} htmlFor="new-clearanceLevel">
          <Select id="new-clearanceLevel" name="clearanceLevel" defaultValue="0">
            {CONFIDENTIALITY_LEVELS.map((level) => (
              <option key={level.level} value={level.level}>
                {`${level.level} — ${level.label}`}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <UserPlus className="size-4" aria-hidden />
        )}
        {USERS.addUser}
      </Button>
    </form>
  )
}

function RegistrationQueue({
  registrations,
  roles,
}: {
  registrations: RegistrationRow[]
  roles: RoleOption[]
}) {
  const [state, formAction, pending] = useActionState(reviewRegistrationAction, IDLE_STATE)

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={USERS.registrationQueue}
        description={`${registrations.length.toLocaleString("th-TH")} คำขอ`}
      />

      {state.status === "error" ? (
        <div className="p-5 pb-0">
          <Alert tone="danger" title={state.message} />
        </div>
      ) : null}

      {registrations.length === 0 ? (
        <EmptyState title={USERS.registrationEmpty} />
      ) : (
        <ul>
          {registrations.map((request) => (
            <li key={request.id} className="border-b border-row-border p-5 last:border-b-0">
              <div className="text-[13.5px] font-semibold text-text-strong">{request.fullName}</div>
              <div className="tabular mt-0.5 text-[11.5px] text-text-subtle">
                {request.username} · {request.email}
              </div>
              <div className="mt-1 text-[12px] text-text-medium">
                {[request.orgUnitName, request.positionTitle].filter(Boolean).join(" · ")}
              </div>
              {request.note ? (
                <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-[11.5px] leading-relaxed text-text-medium">
                  {request.note}
                </p>
              ) : null}
              <div className="tabular mt-2 text-[11px] text-text-subtle">
                {USERS.requestedAt} {formatThaiDateTime(request.createdAt)}
              </div>

              <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2.5">
                <input type="hidden" name="requestId" value={request.id} />
                <div className="min-w-40 flex-1">
                  <Field label={USERS.role} htmlFor={`role-${request.id}`}>
                    <Select id={`role-${request.id}`} name="roleCode" defaultValue="USER">
                      {roles.map((role) => (
                        <option key={role.code} value={role.code}>
                          {role.nameTh}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Button type="submit" name="decision" value="approve" size="sm" disabled={pending}>
                  <Check className="size-4" aria-hidden />
                  {USERS.approve}
                </Button>
                <Button
                  type="submit"
                  name="decision"
                  value="reject"
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                >
                  <X className="size-4" aria-hidden />
                  {USERS.reject}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function ResetQueue({ resets }: { resets: ResetRow[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={USERS.resetQueue}
        description={`${resets.length.toLocaleString("th-TH")} คำขอ`}
      />

      {resets.length === 0 ? (
        <EmptyState title={USERS.resetQueueEmpty} />
      ) : (
        <ul>
          {resets.map((reset) => (
            <li
              key={reset.id}
              className="flex items-start justify-between gap-3 border-b border-row-border px-5 py-3.5 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-text-strong">
                  {reset.userFullName ?? reset.email}
                </div>
                <div className="tabular truncate text-[11.5px] text-text-subtle">{reset.email}</div>
              </div>
              <div className="tabular shrink-0 text-[11px] text-text-subtle">
                {formatThaiDateTime(reset.createdAt, "short")}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-border px-5 py-3">
        <p className="text-[11px] leading-relaxed text-text-subtle">
          {USERS.temporaryPasswordBody}
        </p>
      </div>
    </Card>
  )
}
