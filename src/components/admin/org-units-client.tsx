"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import {
  Archive,
  ArchiveRestore,
  Building2,
  ChevronRight,
  CornerUpRight,
  Loader2,
  Plus,
  Save,
  Users,
} from "lucide-react"

import { COMMON, ORG_UNITS } from "@/constants"
import { ORG_UNIT_TYPE_LABELS, type OrgUnitTypeValue } from "@/schemas/org-unit.schema"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox, Field, Select, TextInput } from "@/components/ui/field"
import { Alert, Badge, Card, CardHeader, EmptyState } from "@/components/ui/primitives"
import {
  createOrgUnitAction,
  moveOrgUnitAction,
  setOrgUnitActiveAction,
  updateOrgUnitAction,
} from "@/server/actions/org-unit.actions"
import { IDLE_STATE } from "@/server/actions/types"

// หน้าจัดการโครงสร้างหน่วยงาน — ตาม project-ui/Admin Org Units.dc.html
//
// ดีไซน์ต้นแบบเขียนว่า "ลากเพื่อย้ายหน่วยงาน" แต่ที่นี่ใช้ **เลือกหน่วยงานแม่ใหม่
// จาก dropdown** แทน drag-and-drop โดยตั้งใจ:
//   - การย้ายหน่วยงานเขียน path ใหม่ทั้ง subtree และกระทบสิทธิ์ SUBTREE ทันที
//     การลากพลาดหนึ่งครั้งจึงเสียหายกว่าที่ความสะดวกจะคุ้ม
//   - drag-and-drop บนต้นไม้ยังใช้กับคีย์บอร์ดและ screen reader ได้ยาก
//     ซึ่งขัดกับ WCAG 2.1 AA ที่ spec §12 กำหนด

export interface OrgUnitNodeView {
  id: string
  parentId: string | null
  path: string
  code: string
  nameTh: string
  shortName: string | null
  type: OrgUnitTypeValue
  level: number
  sortOrder: number
  isActive: boolean
  headName: string | null
  headUserId: string | null
  memberCount: number
  childCount: number
  children: OrgUnitNodeView[]
}

export interface OrgUnitFlat {
  id: string
  nameTh: string
  level: number
  path: string
}

export interface UserOption {
  id: string
  fullName: string
}

const TYPE_OPTIONS = Object.entries(ORG_UNIT_TYPE_LABELS) as [OrgUnitTypeValue, string][]

export function OrgUnitsClient({
  tree,
  flat,
  users,
  showArchived,
}: {
  tree: OrgUnitNodeView[]
  flat: OrgUnitFlat[]
  users: UserOption[]
  showArchived: boolean
}) {
  const allNodes = useMemo(() => flattenTree(tree), [tree])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // หน่วยงานที่เลือกไว้หายไปจากผัง (ถูกกรองออก/เก็บถาวร) → ตกกลับไปที่ตัวแรก
  // คำนวณตอน render แทนการ setState ใน effect เพื่อไม่ให้เกิด render ซ้อน
  const selected = allNodes.find((node) => node.id === selectedId) ?? allNodes[0] ?? null

  return (
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr] xl:items-start">
      <Card className="overflow-hidden">
        <CardHeader
          title={ORG_UNITS.treeTitle}
          description={`${allNodes.length.toLocaleString("th-TH")} หน่วยงาน`}
          action={
            <div className="flex items-center gap-3">
              <ArchivedToggle checked={showArchived} />
              <Button size="sm" onClick={() => setCreating((value) => !value)}>
                <Plus className="size-4" aria-hidden />
                {ORG_UNITS.addUnit}
              </Button>
            </div>
          }
        />

        {creating ? (
          <div className="border-b border-border bg-surface-sunken p-5">
            <CreateOrgUnitForm
              flat={flat}
              users={users}
              defaultParentId={selected?.id ?? null}
              onDone={() => setCreating(false)}
            />
          </div>
        ) : null}

        <div className="p-2.5">
          {tree.length === 0 ? (
            <EmptyState
              title={ORG_UNITS.selectPrompt}
              icon={<Building2 className="size-8" aria-hidden />}
            />
          ) : (
            tree.map((node) => (
              <TreeRow key={node.id} node={node} selectedId={selectedId} onSelect={setSelectedId} />
            ))
          )}
        </div>
      </Card>

      {selected ? (
        <OrgUnitDetail unit={selected} flat={flat} users={users} />
      ) : (
        <Card>
          <EmptyState
            title={ORG_UNITS.selectPrompt}
            icon={<Building2 className="size-8" aria-hidden />}
          />
        </Card>
      )}
    </div>
  )
}

function ArchivedToggle({ checked }: { checked: boolean }) {
  return (
    <form method="get" className="flex items-center gap-2">
      <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-text-medium">
        <Checkbox
          name="archived"
          value="1"
          defaultChecked={checked}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        />
        {ORG_UNITS.showArchived}
      </label>
    </form>
  )
}

function flattenTree(nodes: OrgUnitNodeView[]): OrgUnitNodeView[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)])
}

function TreeRow({
  node,
  selectedId,
  onSelect,
}: {
  node: OrgUnitNodeView
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(node.level < 2)
  const hasChildren = node.children.length > 0
  const selected = node.id === selectedId

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2 py-2 transition-colors",
          selected ? "bg-secondary" : "hover:bg-muted",
        )}
        style={{ paddingLeft: `${node.level * 18 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label={node.nameTh}
            className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-text-subtle hover:bg-border"
          >
            <ChevronRight
              className={cn("size-4 transition-transform", expanded && "rotate-90")}
              aria-hidden
            />
          </button>
        ) : (
          <span className="size-5 shrink-0" />
        )}

        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
        >
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block truncate text-[13.5px] font-semibold",
                node.isActive ? "text-text-strong" : "text-text-subtle line-through",
              )}
            >
              {node.nameTh}
            </span>
            <span className="tabular block truncate text-[11px] text-text-subtle">
              {node.code} · {ORG_UNIT_TYPE_LABELS[node.type]}
            </span>
          </span>

          {node.memberCount > 0 ? (
            <span className="tabular flex shrink-0 items-center gap-1 text-[11px] text-text-subtle">
              <Users className="size-3.5" aria-hidden />
              {node.memberCount}
            </span>
          ) : null}

          {!node.isActive ? <Badge tone="neutral">{COMMON.archived}</Badge> : null}
        </button>
      </div>

      {expanded && hasChildren ? (
        <div>
          {node.children.map((child) => (
            <TreeRow key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function OrgUnitDetail({
  unit,
  flat,
  users,
}: {
  unit: OrgUnitNodeView
  flat: OrgUnitFlat[]
  users: UserOption[]
}) {
  const [state, formAction, pending] = useActionState(updateOrgUnitAction, IDLE_STATE)

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden">
        <CardHeader
          title={ORG_UNITS.detailTitle}
          action={
            unit.isActive ? (
              <Badge tone="success" dot>
                {COMMON.active}
              </Badge>
            ) : (
              <Badge tone="neutral" dot>
                {COMMON.archived}
              </Badge>
            )
          }
        />

        <form action={formAction} className="flex flex-col gap-4 p-5" key={unit.id}>
          <input type="hidden" name="id" value={unit.id} />
          <input type="hidden" name="parentId" value={unit.parentId ?? ""} />

          {state.status === "error" ? <Alert tone="danger" title={state.message} /> : null}
          {state.status === "success" ? <Alert tone="success" title={state.message} /> : null}

          <Field label={ORG_UNITS.nameTh} htmlFor="nameTh" errors={state.fieldErrors?.nameTh}>
            <TextInput id="nameTh" name="nameTh" defaultValue={unit.nameTh} required />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label={ORG_UNITS.shortName}
              htmlFor="shortName"
              errors={state.fieldErrors?.shortName}
            >
              <TextInput
                id="shortName"
                name="shortName"
                defaultValue={unit.shortName ?? ""}
                className="tabular"
              />
            </Field>
            <Field label={ORG_UNITS.code} htmlFor="code" errors={state.fieldErrors?.code}>
              <TextInput
                id="code"
                name="code"
                defaultValue={unit.code}
                className="tabular"
                required
              />
            </Field>
          </div>

          <Field label={ORG_UNITS.type} htmlFor="type" errors={state.fieldErrors?.type}>
            <Select id="type" name="type" defaultValue={unit.type}>
              {TYPE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={ORG_UNITS.head} htmlFor="headUserId">
            <Select id="headUserId" name="headUserId" defaultValue={unit.headUserId ?? ""}>
              <option value="">{ORG_UNITS.headNone}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={ORG_UNITS.sortOrder}
            htmlFor="sortOrder"
            errors={state.fieldErrors?.sortOrder}
          >
            <TextInput
              id="sortOrder"
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={unit.sortOrder}
              className="tabular"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-secondary p-3.5">
              <div className="tabular text-xl font-bold text-primary">{unit.memberCount}</div>
              <div className="text-[11px] text-text-medium">{ORG_UNITS.memberCount}</div>
            </div>
            <div className="rounded-xl bg-muted p-3.5">
              <div className="tabular text-xl font-bold text-text-strong">{unit.childCount}</div>
              <div className="text-[11px] text-text-medium">{ORG_UNITS.childCount}</div>
            </div>
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

      <MoveCard unit={unit} flat={flat} />
      <ArchiveCard unit={unit} />
    </div>
  )
}

function MoveCard({ unit, flat }: { unit: OrgUnitNodeView; flat: OrgUnitFlat[] }) {
  const [state, formAction, pending] = useActionState(moveOrgUnitAction, IDLE_STATE)

  // ห้ามย้ายไปอยู่ใต้ตัวเองหรือใต้ลูกของตัวเอง — กรองออกตั้งแต่ในรายการ
  const options = flat.filter((item) => !item.path.startsWith(unit.path))

  return (
    <Card className="overflow-hidden">
      <CardHeader title={ORG_UNITS.move} />
      <form action={formAction} className="flex flex-col gap-3 p-5" key={unit.id}>
        <input type="hidden" name="id" value={unit.id} />

        {state.status === "error" ? <Alert tone="danger" title={state.message} /> : null}
        {state.status === "success" ? <Alert tone="success" title={state.message} /> : null}

        <Field label={ORG_UNITS.moveTo} htmlFor="newParentId">
          <Select id="newParentId" name="newParentId" defaultValue={unit.parentId ?? ""}>
            <option value="">{ORG_UNITS.rootOption}</option>
            {options.map((item) => (
              <option key={item.id} value={item.id}>
                {`${"— ".repeat(item.level)}${item.nameTh}`}
              </option>
            ))}
          </Select>
        </Field>

        <Button type="submit" variant="outline" disabled={pending} block>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <CornerUpRight className="size-4" aria-hidden />
          )}
          {ORG_UNITS.move}
        </Button>
      </form>
    </Card>
  )
}

function ArchiveCard({ unit }: { unit: OrgUnitNodeView }) {
  const [state, formAction, pending] = useActionState(setOrgUnitActiveAction, IDLE_STATE)

  return (
    <Card className="overflow-hidden">
      <form action={formAction} className="flex flex-col gap-3 p-5" key={unit.id}>
        <input type="hidden" name="id" value={unit.id} />
        {/* ค่า checkbox ที่ไม่ติ๊กจะไม่ถูกส่ง — ส่งค่าเป็น hidden แทนเพื่อให้ชัดเจน */}
        {unit.isActive ? null : <input type="hidden" name="isActive" value="1" />}

        {state.status === "error" ? <Alert tone="danger" title={state.message} /> : null}
        {state.status === "success" ? <Alert tone="success" title={state.message} /> : null}

        <Button
          type="submit"
          variant={unit.isActive ? "destructive" : "outline"}
          disabled={pending}
          block
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : unit.isActive ? (
            <Archive className="size-4" aria-hidden />
          ) : (
            <ArchiveRestore className="size-4" aria-hidden />
          )}
          {unit.isActive ? ORG_UNITS.archive : ORG_UNITS.restore}
        </Button>

        <p className="text-[11px] leading-relaxed text-text-subtle">{ORG_UNITS.archiveNotice}</p>
      </form>
    </Card>
  )
}

function CreateOrgUnitForm({
  flat,
  users,
  defaultParentId,
  onDone,
}: {
  flat: OrgUnitFlat[]
  users: UserOption[]
  defaultParentId: string | null
  onDone: () => void
}) {
  const [state, formAction, pending] = useActionState(createOrgUnitAction, IDLE_STATE)

  useEffect(() => {
    if (state.status === "success") onDone()
  }, [state.status, onDone])

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <div className="text-[14px] font-bold text-text-strong">{ORG_UNITS.createTitle}</div>

      {state.status === "error" ? <Alert tone="danger" title={state.message} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={ORG_UNITS.nameTh} htmlFor="new-nameTh" errors={state.fieldErrors?.nameTh}>
          <TextInput id="new-nameTh" name="nameTh" required />
        </Field>
        <Field
          label={ORG_UNITS.code}
          htmlFor="new-code"
          errors={state.fieldErrors?.code}
          hint={ORG_UNITS.codeHint}
        >
          <TextInput id="new-code" name="code" className="tabular" required />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={ORG_UNITS.shortName} htmlFor="new-shortName">
          <TextInput id="new-shortName" name="shortName" className="tabular" />
        </Field>
        <Field label={ORG_UNITS.type} htmlFor="new-type" errors={state.fieldErrors?.type}>
          <Select id="new-type" name="type" defaultValue="SECTION">
            {TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={ORG_UNITS.sortOrder} htmlFor="new-sortOrder">
          <TextInput
            id="new-sortOrder"
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={0}
            className="tabular"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={ORG_UNITS.parent} htmlFor="new-parentId">
          <Select id="new-parentId" name="parentId" defaultValue={defaultParentId ?? ""}>
            <option value="">{ORG_UNITS.rootOption}</option>
            {flat.map((item) => (
              <option key={item.id} value={item.id}>
                {`${"— ".repeat(item.level)}${item.nameTh}`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={ORG_UNITS.head} htmlFor="new-headUserId">
          <Select id="new-headUserId" name="headUserId" defaultValue="">
            <option value="">{ORG_UNITS.headNone}</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex gap-2.5">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
          {ORG_UNITS.addUnit}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {COMMON.cancel}
        </Button>
      </div>
    </form>
  )
}
