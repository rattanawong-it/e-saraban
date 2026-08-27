"use client"

import { useState } from "react"
import { Search } from "lucide-react"

import { DOCUMENTS } from "@/constants"
import { cn } from "@/lib/utils"
import { Checkbox, Input, InputShell, Label } from "@/components/ui/field"

// เลือกหน่วยงานผู้รับจากผังจริง 372 หน่วย (spec §16)
//
// ⚠️ ของเดิมเป็น <select multiple> ที่ไล่ทั้ง 372 บรรทัด — ผู้ใช้ต้องเลื่อนหาเอง
// และ ctrl+click ให้ถูกตัว ซึ่งใช้งานจริงแทบไม่ได้ (§10.2 "ใช้งานง่าย")
//
// ที่นี่ใช้ช่องค้นหา + ช่องติ๊ก โดย **ยัง render ครบทุกหน่วยเสมอ** แล้วซ่อนตัวที่ไม่ตรงคำค้น
// ด้วย CSS ไม่ใช่ถอดออกจาก DOM — ถอดออกเมื่อไร ตัวที่ติ๊กไว้ก่อนหน้าจะหายไปจากฟอร์มทันที
//
// ทุกช่องใช้ชื่อเดียวกัน ฟอร์มจึงส่งเป็นหลายค่าในชื่อเดียว ตรงกับที่ action อ่านด้วย getAll()

export interface OrgUnitChoice {
  id: string
  code: string
  label: string
  level: number
}

export function OrgUnitPicker({
  units,
  name = "recipientOrgUnitId",
  label,
  required = false,
}: {
  units: OrgUnitChoice[]
  name?: string
  label: string
  required?: boolean
}) {
  const [query, setQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const needle = query.trim().toLowerCase()

  const matches = (unit: OrgUnitChoice) =>
    needle === "" ||
    unit.label.toLowerCase().includes(needle) ||
    unit.code.toLowerCase().includes(needle)

  const visibleCount = units.filter(matches).length

  const toggle = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    )

  return (
    <div>
      <Label htmlFor={`${name}-search`}>{label}</Label>

      <InputShell className="mb-2">
        <Search className="size-4 shrink-0 text-text-subtle" aria-hidden />
        <Input
          id={`${name}-search`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={DOCUMENTS.unitSearchPlaceholder}
          // กัน Enter ในช่องค้นหาไปสั่ง submit ฟอร์มทั้งใบ
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault()
          }}
        />
      </InputShell>

      <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
        {units.map((unit) => (
          <label
            key={unit.id}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-caption transition-colors hover:bg-muted",
              !matches(unit) && "hidden",
            )}
          >
            <Checkbox
              name={name}
              value={unit.id}
              checked={selectedIds.includes(unit.id)}
              onChange={() => toggle(unit.id)}
              required={required && selectedIds.length === 0}
            />
            <span className="tabular text-text-subtle">{unit.code}</span>
            <span className="min-w-0 flex-1 truncate text-text-medium">
              {`${"— ".repeat(Math.max(unit.level - 1, 0))}${unit.label}`}
            </span>
          </label>
        ))}

        {visibleCount === 0 ? (
          <p className="px-3 py-6 text-center text-caption text-text-subtle">
            {DOCUMENTS.unitSearchEmpty}
          </p>
        ) : null}
      </div>

      <p className="mt-1.5 text-micro text-text-subtle">
        {selectedIds.length > 0
          ? DOCUMENTS.unitSelectedCount(selectedIds.length)
          : DOCUMENTS.unitSelectedNone}
      </p>
    </div>
  )
}
