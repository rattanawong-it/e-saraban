import { expect, test, type Page } from "@playwright/test"

import { HELP } from "@/constants/help"
import { NOTIFICATION_UI } from "@/constants/notification"
import {
  AUDIT,
  DASHBOARD,
  DOCUMENTS,
  NUMBERING,
  ORG_UNITS,
  REGISTER_REPORT,
  ROLES,
  SEARCH,
  SETTINGS,
  USERS,
} from "@/constants/ui"

// หน้าจอทุกหน้าต้องใช้งานได้จริงบนทุกความกว้าง (spec §10.2 · P5 "Responsive polish")
//
// ⚠️ สิ่งที่ชุดนี้จับคือ "หน้าล้นแนวนอน" ซึ่งเป็นอาการที่ผู้ใช้เจอแล้วเซ็งที่สุดบนมือถือ —
// ต้องเลื่อนซ้ายขวาเพื่ออ่านข้อความ และปุ่มสำคัญหลุดออกนอกจอโดยไม่มีอะไรบอก
//
// ตารางที่กว้างเกินจอเป็นเรื่องปกติและต้องมีอยู่ — แต่มันต้องเลื่อนใน**กรอบของตัวเอง**
// ไม่ใช่ดันทั้งหน้าให้เลื่อน · เคสนี้จึงวัดที่ documentElement ไม่ใช่ที่ตัวตาราง

const WIDTHS = [
  { name: "มือถือ", width: 390, height: 844 },
  { name: "แท็บเล็ตแนวตั้ง", width: 768, height: 1024 },
  { name: "แล็ปท็อปเล็ก", width: 1024, height: 768 },
  { name: "เดสก์ท็อป", width: 1440, height: 900 },
]

const PAGES = [
  { path: "/dashboard", heading: DASHBOARD.title },
  { path: "/inbox", heading: DOCUMENTS.inboxTitle },
  { path: "/outbox", heading: DOCUMENTS.outboxTitle },
  { path: "/drafts", heading: DOCUMENTS.draftsTitle },
  { path: "/registry/outgoing", heading: DOCUMENTS.queueTitle },
  { path: "/registry/sent", heading: DOCUMENTS.registrySentTitle },
  { path: "/registry/incoming", heading: DOCUMENTS.registryIncomingTitle },
  { path: "/search", heading: SEARCH.title },
  { path: "/reports/register", heading: REGISTER_REPORT.title },
  { path: "/notifications", heading: NOTIFICATION_UI.pageTitle },
  { path: "/help", heading: HELP.title },
  { path: "/documents/new", heading: DOCUMENTS.create },
  { path: "/admin/audit", heading: AUDIT.title },
]

/**
 * หน้าใต้ /admin ที่สารบรรณกลางเปิดไม่ได้ — ต้องใช้เซสชันของผู้ดูแลระบบ
 *
 * ⚠️ ปล่อยไม่ตรวจไม่ได้ เพราะเป็นหน้าที่มีตารางกว้างที่สุดในระบบ (เมทริกซ์สิทธิ์ ·
 * ผังหน่วยงาน · ตารางผู้ใช้) ซึ่งเป็นที่ที่ปัญหาการแสดงผลบนจอแคบซ่อนตัวอยู่มากที่สุด
 */
const ADMIN_PAGES = [
  { path: "/admin/users", heading: USERS.title },
  { path: "/admin/org-units", heading: ORG_UNITS.title },
  { path: "/admin/roles", heading: ROLES.title },
  { path: "/admin/numbering", heading: NUMBERING.title },
  { path: "/admin/settings", heading: SETTINGS.title },
]

/**
 * หา element ที่ยื่นเลยขอบขวาของหน้า เพื่อให้ข้อความตอนเทสต์แดงบอกได้ว่าต้องไปแก้ที่ไหน
 *
 * ⚠️ ต้องข้าม element ที่อยู่ในกรอบซึ่งเลื่อนแนวนอนได้อยู่แล้ว (ตาราง) — พวกนั้น
 * กว้างเกินจอโดยตั้งใจ ไม่ใช่ปัญหา · ตัวที่เป็นปัญหาคือตัวที่ไม่มีบรรพบุรุษไหน
 * รับหน้าที่เลื่อนให้เลย แล้วเลยไปดันทั้งหน้า
 */
async function findOverflowingElements(page: Page) {
  return page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth
    const inScrollableBox = (el: Element) => {
      let node: Element | null = el.parentElement
      while (node && node !== document.documentElement) {
        const overflowX = getComputedStyle(node).overflowX
        if (overflowX === "auto" || overflowX === "scroll" || overflowX === "hidden") return true
        node = node.parentElement
      }
      return false
    }

    const offenders: { tag: string; cls: string; right: number; text: string }[] = []

    for (const el of document.querySelectorAll("body *")) {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      if (rect.right <= docWidth + 1) continue
      if (inScrollableBox(el)) continue

      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || "").toString().slice(0, 70),
        right: Math.round(rect.right),
        text: (el.textContent || "").trim().slice(0, 30),
      })
    }

    return { docWidth, scrollWidth: document.documentElement.scrollWidth, offenders }
  })
}

function expectNoHorizontalOverflow(
  pages: { path: string; heading: string }[],
  size: (typeof WIDTHS)[number],
) {
  for (const { path, heading } of pages) {
    test(`${path} ไม่ล้นแนวนอนบน${size.name} (${size.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height })
      await page.goto(path)
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible()

      const result = await findOverflowingElements(page)

      const detail = result.offenders
        .slice(0, 3)
        .map((o) => `${o.tag}.${o.cls} (ขวาสุด ${o.right} / จอ ${result.docWidth}) "${o.text}"`)
        .join(" · ")

      expect(
        result.scrollWidth,
        `${path} ที่ ${size.width}px ล้นแนวนอน — ${detail || "ไม่พบตัวการที่ชัดเจน"}`,
      ).toBeLessThanOrEqual(result.docWidth)
    })
  }
}

for (const size of WIDTHS) {
  expectNoHorizontalOverflow(PAGES, size)
}

test.describe("หน้าผู้ดูแลระบบ", () => {
  test.use({ storageState: "tests/e2e/.auth/state-admin.json" })

  for (const size of WIDTHS) {
    expectNoHorizontalOverflow(ADMIN_PAGES, size)
  }
})
