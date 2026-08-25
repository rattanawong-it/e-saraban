import * as React from "react"

import { cn } from "@/lib/utils"

// ช่องกรอกข้อมูลตาม project-ui/Design System.dc.html §05
// ขอบ 1.5px + มุมโค้ง 10px + ไอคอนนำหน้าในกรอบเดียวกัน

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("mb-1.5 block text-[13px] font-semibold text-text-strong", className)}
      {...props}
    />
  )
}

/** กรอบรอบ input ที่รองรับไอคอนนำหน้า/ต่อท้าย — ใช้ร่วมกับ <Input> ข้างใน */
export function InputShell({
  className,
  invalid,
  children,
  ...props
}: React.ComponentProps<"div"> & { invalid?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border-[1.5px] bg-card px-3.5 py-[11px] transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20",
        invalid ? "border-danger" : "border-input",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "min-w-0 flex-1 border-none bg-transparent text-[14.5px] text-text-strong outline-none placeholder:text-text-subtle disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  )
}

/** select เปล่าสำหรับวางใน <InputShell> คู่กับไอคอน — คู่กับ <Input> */
export function SelectControl({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "min-w-0 flex-1 cursor-pointer appearance-none border-none bg-transparent text-[14.5px] text-text-strong outline-none",
        className,
      )}
      {...props}
    />
  )
}

/** input เดี่ยว ๆ ที่มีกรอบในตัว — ใช้เมื่อไม่ต้องการไอคอน */
export function TextInput({
  className,
  invalid,
  ...props
}: React.ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border-[1.5px] bg-card px-3.5 py-[11px] text-[14.5px] text-text-strong transition-colors outline-none placeholder:text-text-subtle focus:border-primary focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-70",
        invalid ? "border-danger" : "border-input",
        className,
      )}
      {...props}
    />
  )
}

export function Select({
  className,
  invalid,
  ...props
}: React.ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select
      className={cn(
        "w-full cursor-pointer appearance-none rounded-lg border-[1.5px] bg-card bg-[length:16px] bg-[right_0.85rem_center] bg-no-repeat px-3.5 py-[11px] pr-10 text-[14.5px] text-text-strong transition-colors outline-none focus:border-primary focus:ring-2 focus:ring-ring/20",
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%237C8877%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22m6 9 6 6 6-6%22/%3E%3C/svg%3E')]",
        invalid ? "border-danger" : "border-input",
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border-[1.5px] border-input bg-card px-3.5 py-3 text-[14.5px] text-text-strong transition-colors outline-none placeholder:text-text-subtle focus:border-primary focus:ring-2 focus:ring-ring/20",
        className,
      )}
      {...props}
    />
  )
}

/** ข้อความ error ใต้ช่องกรอก — รับ array มาจาก fieldErrors ของ ActionState */
export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null

  return (
    <p className="mt-1.5 text-xs text-danger-text" role="alert">
      {messages.join(" · ")}
    </p>
  )
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs leading-relaxed text-text-subtle">{children}</p>
}

/** กลุ่ม label + control + error — ลดโค้ดซ้ำในทุกฟอร์ม */
export function Field({
  label,
  htmlFor,
  errors,
  hint,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  errors?: string[]
  hint?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      <FieldError messages={errors} />
      {hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  )
}

export function Checkbox({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-[18px] shrink-0 cursor-pointer rounded-[5px] border-[1.5px] border-input accent-primary",
        className,
      )}
      {...props}
    />
  )
}
