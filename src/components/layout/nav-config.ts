import {
  Building2,
  FileEdit,
  FileSearch,
  Hash,
  Home,
  Inbox,
  Send,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

import { NAV } from "@/constants"
import { PERMISSIONS, type Permission } from "@/lib/authz"

// ผังเมนูด้านซ้าย — ตาม project-ui/Dashboard.dc.html และ spec §10.1
//
// เมนูที่ผู้ใช้ไม่มีสิทธิ์จะถูก **ซ่อน ไม่ใช่ disable** (spec §10.2)
// แต่การซ่อนเป็นเรื่อง UX เท่านั้น — server ยังตรวจสิทธิ์ซ้ำทุกครั้ง

export interface NavItem {
  label: string
  href: string
  icon?: LucideIcon
  /** สิทธิ์ที่ต้องมีจึงจะเห็นเมนูนี้ — ไม่ระบุ = ทุกคนเห็น */
  permission?: Permission
  /** เฟสที่ฟีเจอร์นี้จะพร้อมใช้ — ระบุแล้วจะขึ้นป้ายบอกว่ายังไม่พร้อม */
  phase?: string
  children?: NavItem[]
}

export interface NavGroup {
  label: string | null
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: NAV.groupMain,
    items: [
      { label: NAV.dashboard, href: "/dashboard", icon: Home },
      { label: NAV.inbox, href: "/inbox", icon: Inbox, phase: "P2" },
      { label: NAV.outbox, href: "/outbox", icon: Send, phase: "P2" },
      { label: NAV.drafts, href: "/drafts", icon: FileEdit, phase: "P2" },
    ],
  },
  {
    label: NAV.groupRegistry,
    items: [
      {
        label: NAV.registry,
        href: "/registry",
        icon: Hash,
        phase: "P2",
        children: [
          { label: NAV.registryOutgoing, href: "/registry/outgoing", phase: "P2" },
          { label: NAV.registrySent, href: "/registry/sent", phase: "P2" },
          { label: NAV.registryIncoming, href: "/registry/incoming", phase: "P5" },
        ],
      },
      { label: NAV.search, href: "/search", icon: FileSearch, phase: "P4" },
      {
        label: NAV.reports,
        href: "/reports/register",
        icon: FileSearch,
        permission: PERMISSIONS.REPORT_VIEW,
        phase: "P4",
      },
    ],
  },
  {
    label: NAV.groupAdmin,
    items: [
      {
        label: NAV.orgStructure,
        href: "/admin/org-units",
        icon: Building2,
        children: [
          {
            label: NAV.orgUnits,
            href: "/admin/org-units",
            permission: PERMISSIONS.ORGUNIT_MANAGE,
          },
          { label: NAV.users, href: "/admin/users", permission: PERMISSIONS.USER_MANAGE },
          { label: NAV.roles, href: "/admin/roles", permission: PERMISSIONS.ROLE_MANAGE },
        ],
      },
      {
        label: NAV.systemSettings,
        href: "/admin/settings",
        icon: Settings,
        permission: PERMISSIONS.SETTING_MANAGE,
        children: [
          {
            label: NAV.numbering,
            href: "/admin/numbering",
            permission: PERMISSIONS.SETTING_MANAGE,
            phase: "P2",
          },
          {
            label: NAV.generalSettings,
            href: "/admin/settings",
            permission: PERMISSIONS.SETTING_MANAGE,
          },
        ],
      },
      {
        label: NAV.audit,
        href: "/admin/audit",
        icon: ShieldCheck,
        permission: PERMISSIONS.AUDIT_READ,
      },
    ],
  },
]

/**
 * กรองเมนูตามสิทธิ์ที่ผู้ใช้มีจริง
 *
 * หัวข้อที่มีเมนูย่อยจะหายไปเองเมื่อลูกทุกตัวถูกกรองออก —
 * ไม่งั้นจะเหลือหัวข้อว่าง ๆ ที่กดแล้วไม่มีอะไรให้ทำ
 */
export function filterNav(groups: NavGroup[], hasPermission: (p: Permission) => boolean) {
  return groups
    .map((group) => ({
      ...group,
      items: group.items
        .map((item) => ({
          ...item,
          children: item.children?.filter(
            (child) => !child.permission || hasPermission(child.permission),
          ),
        }))
        .filter((item) => {
          if (item.permission && !hasPermission(item.permission)) return false
          if (item.children && item.children.length === 0) return false
          return true
        }),
    }))
    .filter((group) => group.items.length > 0)
}
