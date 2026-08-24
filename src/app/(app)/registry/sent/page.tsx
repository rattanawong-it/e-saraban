import type { Metadata } from "next"

import { APP_NAME, NAV } from "@/constants"
import { ComingSoon } from "@/components/ui/coming-soon"

export const metadata: Metadata = {
  title: `${NAV.registrySent} · ${APP_NAME}`,
}

export default function Page() {
  return <ComingSoon title={NAV.registrySent} phase="P2" />
}
