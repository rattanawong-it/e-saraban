"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { Check, Loader2 } from "lucide-react"

import { COMMON, NUMBERING, SETTINGS } from "@/constants"
import { NUMBER_PATTERN_TOKENS, previewDocNumber, validateNumberPattern } from "@/lib/thai"
import { DIRECTION_LABELS } from "@/schemas/document.schema"
import { Button } from "@/components/ui/button"
import { Input, InputShell } from "@/components/ui/field"
import { Alert, Badge, Card, CardHeader } from "@/components/ui/primitives"
import {
  updateSequencePatternAction,
  updateTypePatternAction,
} from "@/server/actions/admin.actions"
import { IDLE_STATE, type ActionState } from "@/server/actions/types"
import type { NumberingConfig } from "@/server/services/numbering.service"

// ตั้งค่ารูปแบบเลขทะเบียน (spec §7.1)
//
// แต่ละแถวเป็นฟอร์มของตัวเองพร้อม useActionState ของตัวเอง — บันทึกทีละแถว
// ไม่ใช่ทั้งหน้าในครั้งเดียว เพราะผู้ใช้มักแก้ทีละอันและอยากรู้ผลของอันนั้นทันที
//
// ตัวอย่างเลขคำนวณฝั่ง client จากฟังก์ชันบริสุทธิ์ตัวเดียวกับที่ service ใช้ตอนออกเลขจริง
// (`previewDocNumber` / `validateNumberPattern`) จึงไม่มีทางที่ตัวอย่างกับของจริงจะคนละสูตร

export function NumberingClient({ config }: { config: NumberingConfig }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr] lg:items-start">
        <Card className="overflow-hidden">
          <CardHeader title={NUMBERING.inheritTitle} description={NUMBERING.inheritBody} />

          <div className="flex flex-col gap-3 p-5">
            <Row label={NUMBERING.defaultPattern}>
              <code className="tabular rounded-md bg-surface-sunken px-2 py-1 text-[12.5px]">
                {config.defaultPattern}
              </code>
            </Row>

            <Row label={NUMBERING.currentYear}>
              <span className="tabular text-[13px] font-bold text-text-strong">
                {`พ.ศ. ${config.year}`}
              </span>
            </Row>

            <Row label={NUMBERING.yearModeLabel}>
              <span className="text-[12.5px] text-text-medium">
                {config.yearMode === "FISCAL"
                  ? NUMBERING.yearModeFiscal
                  : NUMBERING.yearModeCalendar}
              </span>
            </Row>

            <Link
              href="/admin/settings"
              className="text-[12px] font-semibold text-primary hover:underline"
            >
              {`${NUMBERING.changeAtSettings} · ${SETTINGS.title}`}
            </Link>

            <Alert tone="warning">{NUMBERING.irreversible}</Alert>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title={NUMBERING.tokensTitle} />

          <ul className="grid gap-2 p-5 sm:grid-cols-2">
            {NUMBER_PATTERN_TOKENS.map((item) => (
              <li key={item.token} className="flex items-baseline gap-2">
                <code className="tabular rounded-md bg-surface-sunken px-1.5 py-0.5 text-[12px] text-primary">
                  {item.token}
                </code>
                <span className="min-w-0 flex-1 truncate text-[12px] text-text-medium">
                  {item.label}
                </span>
                <span className="tabular text-[11.5px] text-text-subtle">{item.example}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title={NUMBERING.typesTitle} description={NUMBERING.typesDescription} />

        <ul className="flex flex-col">
          {config.documentTypes.map((type) => (
            <li key={type.id} className="border-b border-row-border p-5 last:border-b-0">
              <PatternRow
                action={updateTypePatternAction}
                idName="documentTypeId"
                idValue={type.id}
                patternName="numberPattern"
                initialPattern={type.numberPattern}
                fallbackPattern={config.defaultPattern}
                title={type.nameTh}
                subtitle={`${type.code} · ${DIRECTION_LABELS[type.direction]} · ${NUMBERING.colBook} ${type.defaultBookCode}`}
                badge={type.isActive ? null : NUMBERING.inactiveType}
              />
            </li>
          ))}
        </ul>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title={`${NUMBERING.sequencesTitle} (พ.ศ. ${config.year})`}
          description={NUMBERING.sequencesDescription}
        />

        {config.sequences.length === 0 ? (
          <p className="px-5 py-8 text-center text-[12.5px] text-text-subtle">
            {NUMBERING.sequencesEmpty}
          </p>
        ) : (
          <ul className="flex flex-col">
            {config.sequences.map((sequence) => (
              <li key={sequence.id} className="border-b border-row-border p-5 last:border-b-0">
                <PatternRow
                  action={updateSequencePatternAction}
                  idName="sequenceId"
                  idValue={sequence.id}
                  patternName="patternOverride"
                  initialPattern={sequence.patternOverride}
                  fallbackPattern={null}
                  title={`${sequence.orgUnitCode} · ${sequence.orgUnitName}`}
                  subtitle={`${DIRECTION_LABELS[sequence.direction]} · ${NUMBERING.colBook} ${sequence.bookCode} · ${NUMBERING.colLastValue} ${sequence.lastValue.toLocaleString("th-TH")}`}
                  badge={null}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12.5px] text-text-subtle">{label}</span>
      {children}
    </div>
  )
}

function PatternRow({
  action,
  idName,
  idValue,
  patternName,
  initialPattern,
  fallbackPattern,
  title,
  subtitle,
  badge,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  idName: string
  idValue: string
  patternName: string
  initialPattern: string | null
  /** รูปแบบที่จะถูกใช้แทนเมื่อช่องนี้ว่าง — `null` = ตกทอดจากประเภทหนังสือซึ่งขึ้นกับเอกสาร */
  fallbackPattern: string | null
  title: string
  subtitle: string
  badge: string | null
}) {
  const [state, formAction, pending] = useActionState(action, IDLE_STATE)
  const [pattern, setPattern] = useState(initialPattern ?? "")

  const trimmed = pattern.trim()
  const issues = trimmed ? validateNumberPattern(trimmed) : []
  const effective = trimmed || fallbackPattern

  return (
    <form action={formAction} className="flex flex-col gap-2.5">
      <input type="hidden" name={idName} value={idValue} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-bold text-text-strong">{title}</span>
            {badge ? <Badge tone="neutral">{badge}</Badge> : null}
          </div>
          <div className="tabular text-[11.5px] text-text-subtle">{subtitle}</div>
        </div>

        {state.status !== "idle" && state.message ? (
          <span
            className={
              state.status === "error"
                ? "text-[12px] font-semibold text-danger-text"
                : "text-[12px] font-semibold text-success-text"
            }
          >
            {state.message}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <InputShell className="min-w-56 flex-1">
          {/* ทะเบียนรายหน่วยงานตกทอดจากประเภทหนังสือ ซึ่งขึ้นกับเอกสารแต่ละฉบับ
              จึงบอกเป็นข้อความ ไม่ใช่โชว์ค่าปริยายของระบบซึ่งอาจไม่ใช่ค่าที่จะได้จริง */}
          <Input
            name={patternName}
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
            placeholder={fallbackPattern ?? NUMBERING.inheritFromType}
            className="tabular"
            aria-label={`${NUMBERING.colPattern} ${title}`}
          />
        </InputShell>

        <Button type="submit" size="sm" variant="outline" disabled={pending || issues.length > 0}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Check className="size-4" aria-hidden />
          )}
          {COMMON.save}
        </Button>
      </div>

      <p className="text-[11.5px] text-text-subtle">
        {issues.length > 0 ? (
          <span className="text-danger-text">
            {`${NUMBERING.invalidPattern} — ${issues.map((issue) => issue.message).join(" · ")}`}
          </span>
        ) : effective ? (
          <>
            {`${NUMBERING.colPreview}: `}
            <span className="tabular font-bold text-text-strong">{safePreview(effective)}</span>
            {trimmed ? "" : ` · ${NUMBERING.usingDefault}`}
          </>
        ) : (
          NUMBERING.usingDefault
        )}
      </p>
    </form>
  )
}

/** ตัวอย่างต้องไม่ทำให้หน้าพัง — pattern ที่ยังพิมพ์ไม่จบมี token ครึ่ง ๆ กลาง ๆ ได้ */
function safePreview(pattern: string): string {
  try {
    return previewDocNumber(pattern)
  } catch {
    return COMMON.none
  }
}
