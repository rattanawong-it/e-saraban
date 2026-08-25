"use client"

import { useActionState, useState } from "react"
import { KeyRound, Loader2, Search, ShieldOff, UserPlus } from "lucide-react"

import { ACL } from "@/constants"
import { formatThaiDate, formatThaiDateTime } from "@/lib/thai"
import { Button } from "@/components/ui/button"
import { Field, Select, TextInput, Textarea } from "@/components/ui/field"
import { Alert, Card, CardHeader, EmptyState } from "@/components/ui/primitives"
import { grantAclAction, revokeAclAction, searchGranteesAction } from "@/server/actions/acl.actions"
import { IDLE_STATE, type ActionState } from "@/server/actions/types"
import type { DocumentAclRow, GranteeCandidate } from "@/server/services/acl.service"

// แผงสิทธิ์เฉพาะรายของหน้ารายละเอียด (spec §9.1)
//
// ⚠️ แผงนี้ "บอกทาง" เท่านั้น — ทุกปุ่มยิงไป service ที่เรียก can() ซ้ำเสมอ (spec §10.2)
// การซ่อนปุ่มถอนสิทธิ์ของเจ้าของเรื่องจึงเป็นแค่การไม่ให้ผู้ใช้เสียเวลากด ไม่ใช่ด่านกันจริง
//
// ค้นหาคนด้วย Server Action ไม่ใช่การส่งรายชื่อทั้งองค์กรลงมาให้เบราว์เซอร์กรอง
// เพราะรายชื่อผู้ใช้ทั้งองค์กรคือข้อมูลที่ไม่ควรอยู่ในหน้าเอกสารตั้งแต่แรก

const SEARCH_IDLE: ActionState<GranteeCandidate[]> = { status: "idle" }

export function AclPanel({
  documentId,
  rows,
  canGrant,
  confidentialityLevel,
}: {
  documentId: string
  rows: DocumentAclRow[]
  canGrant: boolean
  confidentialityLevel: number
}) {
  const [searchState, searchAction, searching] = useActionState(searchGranteesAction, SEARCH_IDLE)
  const [grantState, grantAction, granting] = useActionState(grantAclAction, IDLE_STATE)
  const [revokeState, revokeAction, revoking] = useActionState(revokeAclAction, IDLE_STATE)
  const [selected, setSelected] = useState<GranteeCandidate | null>(null)

  const notice = grantState.status !== "idle" ? grantState : revokeState

  // ให้สิทธิ์สำเร็จแล้วต้องปิดฟอร์ม ไม่งั้นผู้ใช้เห็นฟอร์มค้างพร้อมชื่อเดิม
  // แล้วเข้าใจว่ายังไม่ได้บันทึก จึงกดซ้ำอีกครั้ง
  //
  // ปรับ state ระหว่าง render ตามแบบที่ React แนะนำ ไม่ใช่ใน useEffect
  // (effect ที่ setState ทำให้ render ซ้อนกันโดยไม่จำเป็น)
  const [seenGrantState, setSeenGrantState] = useState(grantState)

  if (seenGrantState !== grantState) {
    setSeenGrantState(grantState)
    if (grantState.status === "success") setSelected(null)
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader title={ACL.title} description={ACL.description} />

      <div className="flex flex-col gap-3 p-5">
        {notice.status !== "idle" && notice.message ? (
          <Alert tone={notice.status === "error" ? "danger" : "success"} title={notice.message} />
        ) : null}

        {rows.length === 0 ? (
          <EmptyState title={ACL.empty} icon={<KeyRound className="size-6" />} />
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[13px] font-semibold text-text-strong">
                      {row.userName}
                    </span>
                    <span className="tabular text-[11px] text-text-subtle">({row.username})</span>
                    <PermissionTag permission={row.permission} effect={row.effect} />
                    {row.isOwner ? <Tag tone="muted">{ACL.ownerTag}</Tag> : null}
                    {row.isAutomatic ? <Tag tone="muted">{ACL.automaticTag}</Tag> : null}
                  </div>

                  <div className="tabular mt-0.5 text-[11px] text-text-subtle">
                    {ACL.grantedBy(row.grantedByName, formatThaiDateTime(row.grantedAt, "short"))}
                    {row.expiresAt ? ` · ${ACL.expiresOn(formatThaiDate(row.expiresAt))}` : ""}
                  </div>

                  {row.reason && !row.isAutomatic ? (
                    <div className="mt-0.5 text-[11px] text-text-subtle">
                      {ACL.reasonLabel}: {row.reason}
                    </div>
                  ) : null}
                </div>

                {canGrant && !row.isOwner ? (
                  <form action={revokeAction}>
                    <input type="hidden" name="aclId" value={row.id} />
                    <input type="hidden" name="documentId" value={documentId} />
                    <Button
                      type="submit"
                      size="icon-sm"
                      variant="ghost"
                      disabled={revoking}
                      title={ACL.revoke}
                    >
                      <ShieldOff className="size-4 text-danger-text" aria-hidden />
                      <span className="sr-only">{ACL.revoke}</span>
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canGrant ? (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <form action={searchAction} className="flex items-end gap-2">
              <input type="hidden" name="documentId" value={documentId} />

              <Field label={ACL.searchLabel} htmlFor="acl-search" className="flex-1">
                <TextInput
                  id="acl-search"
                  name="query"
                  placeholder={ACL.searchPlaceholder}
                  autoComplete="off"
                />
              </Field>

              <Button type="submit" variant="secondary" disabled={searching}>
                {searching ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Search className="size-4" aria-hidden />
                )}
                {ACL.searchButton}
              </Button>
            </form>

            {searchState.status === "error" && searchState.message ? (
              <Alert tone="warning" title={searchState.message} />
            ) : null}

            {searchState.data && searchState.data.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {searchState.data.map((candidate) => (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(candidate)}
                      disabled={!candidate.hasClearance}
                      className={
                        "w-full rounded-lg border px-3 py-2 text-left transition-colors " +
                        (selected?.id === candidate.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-surface-sunken") +
                        (candidate.hasClearance ? "" : " cursor-not-allowed opacity-60")
                      }
                    >
                      <div className="text-[13px] font-semibold text-text-strong">
                        {candidate.fullName}
                        <span className="tabular ml-1.5 text-[11px] font-normal text-text-subtle">
                          ({candidate.username})
                        </span>
                      </div>
                      <div className="tabular text-[11px] text-text-subtle">
                        {candidate.orgUnitName ?? ACL.noOrgUnit}
                        {` · ${ACL.clearanceOf(candidate.clearanceLevel)}`}
                        {candidate.hasClearance
                          ? ""
                          : ` · ${ACL.clearanceTooLow(confidentialityLevel)}`}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {selected ? (
              <form action={grantAction} className="flex flex-col gap-3">
                <input type="hidden" name="documentId" value={documentId} />
                <input type="hidden" name="userId" value={selected.id} />

                <Alert tone="info" title={ACL.granteeSelected(selected.fullName)} />

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label={ACL.permissionLabel}
                    htmlFor="acl-permission"
                    errors={grantState.fieldErrors?.permission}
                  >
                    <Select id="acl-permission" name="permission" defaultValue="DOWNLOAD">
                      <option value="VIEW">{ACL.permissionOptions.VIEW}</option>
                      <option value="DOWNLOAD">{ACL.permissionOptions.DOWNLOAD}</option>
                      <option value="EDIT">{ACL.permissionOptions.EDIT}</option>
                      <option value="MANAGE">{ACL.permissionOptions.MANAGE}</option>
                    </Select>
                  </Field>

                  <Field
                    label={ACL.effectLabel}
                    htmlFor="acl-effect"
                    errors={grantState.fieldErrors?.effect}
                  >
                    <Select id="acl-effect" name="effect" defaultValue="ALLOW">
                      <option value="ALLOW">{ACL.effectOptions.ALLOW}</option>
                      <option value="DENY">{ACL.effectOptions.DENY}</option>
                    </Select>
                  </Field>
                </div>

                <Field
                  label={ACL.expiresLabel}
                  htmlFor="acl-expires"
                  errors={grantState.fieldErrors?.expiresAt}
                  hint={ACL.expiresHint}
                >
                  <TextInput id="acl-expires" name="expiresAt" type="date" />
                </Field>

                <Field
                  label={ACL.reasonLabel}
                  htmlFor="acl-reason"
                  errors={grantState.fieldErrors?.reason}
                  hint={ACL.reasonHint}
                >
                  <Textarea id="acl-reason" name="reason" rows={2} required />
                </Field>

                <div className="flex gap-2">
                  <Button type="submit" disabled={granting}>
                    {granting ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <UserPlus className="size-4" aria-hidden />
                    )}
                    {ACL.grant}
                  </Button>

                  <Button type="button" variant="ghost" onClick={() => setSelected(null)}>
                    {ACL.cancel}
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  )
}

function PermissionTag({ permission, effect }: { permission: string; effect: string }) {
  const label = ACL.permissionShort[permission as keyof typeof ACL.permissionShort] ?? permission

  return (
    <Tag tone={effect === "DENY" ? "danger" : "primary"}>
      {effect === "DENY" ? `${ACL.denyPrefix}${label}` : label}
    </Tag>
  )
}

function Tag({
  tone,
  children,
}: {
  tone: "primary" | "danger" | "muted"
  children: React.ReactNode
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    danger: "bg-danger/10 text-danger-text",
    muted: "bg-surface-sunken text-text-subtle",
  }

  return (
    <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  )
}
