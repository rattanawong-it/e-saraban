import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// ปุ่มตาม project-ui/Design System.dc.html §04
// ขนาดใหญ่กว่าค่าปริยายของ shadcn เพราะกลุ่มผู้ใช้เป็นเจ้าหน้าที่ธุรการ
// ที่ทำงานกับหน้าจอทั้งวัน — เป้ากดใหญ่ขึ้นลดการกดพลาด (spec §10.2 "ใช้งานง่าย")

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-transparent font-sans font-semibold whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-brand-light",
        outline: "border-border bg-card text-primary hover:bg-secondary",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "text-text-medium hover:bg-secondary hover:text-secondary-foreground",
        destructive: "bg-danger-bg text-danger-text hover:bg-danger-bg/70",
        danger: "bg-danger text-white hover:bg-danger/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 text-section",
        sm: "h-9 px-3.5 text-label",
        xs: "h-8 rounded-md px-2.5 text-caption",
        lg: "h-12 px-6 text-body",
        icon: "size-10 rounded-lg px-0",
        "icon-sm": "size-8 rounded-md px-0",
      },
      block: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Button({
  className,
  variant = "default",
  size = "default",
  block,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, block, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
