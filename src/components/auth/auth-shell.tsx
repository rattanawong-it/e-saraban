import Image from "next/image"
import type { LucideIcon } from "lucide-react"

import { BRAND } from "@/constants"

// แผงแบรนด์และแผงฟอร์มของหน้า (auth) — ถอดจาก project-ui/Login.dc.html
// ไล่เฉดเขียวจากสีแบรนด์ #3F6133 พร้อมวงกลมโปร่งแสงสองวงเป็นพื้นหลัง

export interface AuthFeature {
  icon: LucideIcon
  label: string
}

export function AuthBrandPanel({
  title,
  subtitle,
  features,
}: {
  title: string
  subtitle: string
  features?: readonly AuthFeature[]
}) {
  return (
    <div className="relative flex flex-col justify-between overflow-hidden bg-[linear-gradient(160deg,#527A45_0%,#3F6133_55%,#243A1E_100%)] px-7 py-8 text-white lg:w-[44%] lg:min-w-[420px] lg:px-13 lg:py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-white/[0.06]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-20 size-64 rounded-full bg-[rgba(184,134,46,0.16)]"
      />

      <div className="relative z-10">
        <div className="mb-8 flex items-center gap-3.5 lg:mb-16">
          <div className="flex h-12 items-center justify-center rounded-2xl bg-white/95 px-3">
            <Image
              src="/brand/krirk-logo.png"
              alt={BRAND.logoAlt}
              width={120}
              height={32}
              className="h-8 w-auto"
              priority
            />
          </div>
          <div>
            <div className="text-[15px] font-bold tracking-wide">{BRAND.name}</div>
            <div className="text-xs text-white/65">{BRAND.tagline}</div>
          </div>
        </div>

        <h1 className="mb-4 max-w-md text-2xl leading-snug font-bold lg:text-[32px]">{title}</h1>
        <p className="max-w-sm text-[15px] leading-relaxed text-white/75 lg:mb-10">{subtitle}</p>

        {features ? (
          <ul className="hidden flex-col gap-5 lg:flex">
            {features.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-start gap-3.5">
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15"
                >
                  <Icon className="size-5" strokeWidth={1.7} />
                </span>
                <span className="pt-1.5 text-[13.5px] leading-relaxed text-white/90">{label}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="relative z-10 mt-8 hidden text-xs text-white/50 lg:block">
        {BRAND.copyright}
      </div>
    </div>
  )
}

export function AuthFormPanel({
  children,
  wide = false,
}: {
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-10 lg:px-8 lg:py-12">
      <div className={wide ? "w-full max-w-[27rem]" : "w-full max-w-[24.5rem]"}>{children}</div>
    </div>
  )
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-7">
      <h2 className="text-2xl font-bold text-text-strong">{title}</h2>
      {subtitle ? (
        <p className="mt-2 text-sm leading-relaxed text-text-subtle">{subtitle}</p>
      ) : null}
    </div>
  )
}
