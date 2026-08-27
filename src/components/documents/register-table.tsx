import Link from "next/link"

import { CONFIDENTIALITY_LEVELS, REGISTER_REPORT } from "@/constants"
import { formatThaiDate } from "@/lib/thai"
import { Badge, Card, ConfidentialityBadge, EmptyState } from "@/components/ui/primitives"
import type { RegisterRow } from "@/server/services/report.service"

// ตารางทะเบียนหนังสือ — คอลัมน์ตามแบบของระเบียบสำนักนายกรัฐมนตรีว่าด้วยงานสารบรรณ
//
// เรียงคอลัมน์เหมือนไฟล์ Excel และ PDF เป๊ะ (นิยามอยู่ที่ src/lib/reports/register-format.ts)
// เพื่อให้คนที่กดดาวน์โหลดได้ไฟล์หน้าตาเดียวกับที่เพิ่งเห็นบนจอ

export function RegisterTable({ rows }: { rows: RegisterRow[] }) {
  if (rows.length === 0) {
    return (
      <Card className="p-5">
        <EmptyState title={REGISTER_REPORT.empty} />
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      {/* ตารางกว้างกว่าจอมือถือเสมอ — ให้เลื่อนในกล่องของตัวเอง ไม่ใช่ทั้งหน้า */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-label">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-left">
              <Th className="w-[92px] text-center">{REGISTER_REPORT.columns.seq}</Th>
              <Th className="w-[150px]">{REGISTER_REPORT.columns.docNo}</Th>
              <Th className="w-[104px] text-center">{REGISTER_REPORT.columns.docDate}</Th>
              <Th className="w-[150px]">{REGISTER_REPORT.columns.from}</Th>
              <Th className="w-[150px]">{REGISTER_REPORT.columns.to}</Th>
              <Th>{REGISTER_REPORT.columns.subject}</Th>
              <Th className="w-[124px]">{REGISTER_REPORT.columns.action}</Th>
              <Th className="w-[150px]">{REGISTER_REPORT.columns.note}</Th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/70 align-top last:border-0">
                <Td className="tabular text-center font-semibold text-text-strong">
                  {row.seq ?? "-"}
                </Td>
                <Td className="tabular">
                  <Link
                    href={`/documents/${row.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {row.docNo}
                  </Link>
                </Td>
                <Td className="tabular text-center">
                  {row.docDate ? formatThaiDate(row.docDate, "short") : "-"}
                </Td>
                <Td>{row.from}</Td>
                <Td>{row.to}</Td>
                <Td>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-text-strong">{row.subject}</span>
                    {row.confidentialityLevel > 0 ? (
                      <ConfidentialityBadge
                        level={row.confidentialityLevel}
                        label={levelLabel(row.confidentialityLevel)}
                      />
                    ) : null}
                  </span>
                </Td>
                <Td>{row.action}</Td>
                <Td className="text-text-medium">
                  {row.note ? (
                    <span className="flex items-center gap-1.5">
                      <Badge tone="neutral">{REGISTER_REPORT.cancelledTag}</Badge>
                      <span className="text-micro">{row.note}</span>
                    </span>
                  ) : (
                    ""
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function levelLabel(level: number): string {
  return CONFIDENTIALITY_LEVELS.find((item) => item.level === level)?.label ?? String(level)
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`px-3 py-2.5 text-micro font-semibold text-text-medium ${className ?? ""}`}
    >
      {children}
    </th>
  )
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 ${className ?? ""}`}>{children}</td>
}
