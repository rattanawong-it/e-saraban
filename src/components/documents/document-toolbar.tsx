import Link from "next/link"
import { Search } from "lucide-react"

import { DOCUMENTS } from "@/constants"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input, InputShell } from "@/components/ui/field"

// แถบค้นหา + ตัวกรอง + แบ่งหน้า ของหน้ารายการเอกสาร
//
// ทั้งหมดทำงานผ่าน query string ไม่ใช่ state ฝั่ง client — ผู้ใช้จึงบุ๊กมาร์กและกด back ได้
// และหน้ายังใช้งานได้เมื่อ JavaScript ยังโหลดไม่เสร็จ (form method=get ล้วน)

export interface FilterChip {
  key: string
  label: string
}

export function DocumentToolbar({
  basePath,
  q,
  chips,
  activeChip,
  chipParam = "status",
}: {
  basePath: string
  q: string
  chips?: FilterChip[]
  activeChip?: string
  chipParam?: string
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <form method="get" action={basePath} className="flex min-w-64 flex-1 items-center gap-2">
        {/* คงตัวกรองที่เลือกไว้ตอนกดค้นหา ไม่งั้นการค้นจะรีเซ็ต chip ทิ้ง */}
        {activeChip ? <input type="hidden" name={chipParam} value={activeChip} /> : null}

        <InputShell className="flex-1">
          <Search className="size-4 shrink-0 text-text-subtle" aria-hidden />
          <Input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={DOCUMENTS.searchPlaceholder}
            aria-label={DOCUMENTS.searchPlaceholder}
          />
        </InputShell>

        <Button type="submit" size="sm" variant="outline">
          {DOCUMENTS.search}
        </Button>

        {q || activeChip ? (
          <Button asChild size="sm" variant="ghost">
            <Link href={basePath}>{DOCUMENTS.clearFilter}</Link>
          </Button>
        ) : null}
      </form>

      {chips ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Link
              key={chip.key || "all"}
              href={buildHref(basePath, { [chipParam]: chip.key, q })}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                (activeChip ?? "") === chip.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-text-medium ring-1 ring-border ring-inset hover:bg-muted",
              )}
            >
              {chip.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function DocumentPager({
  basePath,
  page,
  pageSize,
  total,
  params,
}: {
  basePath: string
  page: number
  pageSize: number
  total: number
  params: Record<string, string | undefined>
}) {
  if (total === 0) return null

  const totalPages = Math.max(Math.ceil(total / pageSize), 1)
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="tabular text-[12.5px] text-text-subtle">
        {DOCUMENTS.pageInfo(from, to, total)}
      </p>

      <div className="flex gap-2">
        <Button asChild size="sm" variant="outline" disabled={page <= 1}>
          <Link href={buildHref(basePath, { ...params, page: String(page - 1) })}>
            {DOCUMENTS.prev}
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" disabled={page >= totalPages}>
          <Link href={buildHref(basePath, { ...params, page: String(page + 1) })}>
            {DOCUMENTS.next}
          </Link>
        </Button>
      </div>
    </div>
  )
}

/** ประกอบ query string โดยตัดค่าว่างทิ้ง — URL จะได้ไม่รกด้วย `?q=&status=` */
function buildHref(basePath: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }

  const query = search.toString()
  return query ? `${basePath}?${query}` : basePath
}
