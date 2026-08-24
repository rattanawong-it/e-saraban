import "server-only"

import { ROLE_LABELS } from "@/constants"
import type { GrantedPermissions, Permission, PermissionScope, RoleCode } from "@/lib/authz"
import { prisma } from "@/lib/db"

// การประกอบ "ตัวตน + สิทธิ์" ของผู้ใช้หนึ่งคนใน context หน่วยงานหนึ่ง
//
// จุดสำคัญ: สิทธิ์ **ไม่ได้ hardcode** ในโค้ด — อ่านจากตาราง Role/RolePermission
// เสมอ เพราะ spec §4 ให้ผู้ดูแลระบบแก้บทบาทได้เองที่ /admin/roles

/** ลำดับความกว้างของ scope — ใช้เลือกอันที่กว้างที่สุดเมื่อผู้ใช้มีหลายบทบาท */
const SCOPE_RANK: Record<PermissionScope, number> = {
  OWN: 1,
  UNIT: 2,
  SUBTREE: 3,
  ORG: 4,
}

export interface ResolvedIdentity {
  user: {
    id: string
    tenantId: string
    username: string
    prefix: string | null
    firstName: string
    lastName: string
    email: string | null
    clearanceLevel: number
    isActive: boolean
    mustChangePassword: boolean
  }
  permissions: GrantedPermissions
  roleCodes: RoleCode[]
  orgUnitIds: string[]
  affiliations: {
    orgUnitId: string
    orgUnitName: string
    orgUnitShortName: string | null
    orgUnitCode: string
    orgUnitPath: string
    positionTitle: string | null
    isPrimary: boolean
    roleCodes: string[]
    roleLabels: string[]
  }[]
  activeOrgUnitPath: string | null
}

/**
 * โหลดตัวตนและสิทธิ์ของผู้ใช้ในหน่วยงานที่กำลังทำงานอยู่
 *
 * รวม 2 แหล่ง:
 *   - บทบาทที่ผูกกับหน่วยงานปัจจุบัน (`orgUnitId = activeOrgUnitId`)
 *   - บทบาทระดับทั้งองค์กร (`orgUnitId IS NULL`) เช่น SYSTEM_ADMIN
 *
 * บทบาทที่หมดอายุแล้ว (`expiresAt` ผ่านไปแล้ว) ถูกตัดออกที่ชั้นนี้ที่เดียว
 */
export async function resolveIdentity(
  userId: string,
  activeOrgUnitId: string | null,
): Promise<ResolvedIdentity | null> {
  const now = new Date()

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: {
      orgUnits: {
        include: { orgUnit: true },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      roles: {
        where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        include: { role: { include: { permissions: true } } },
      },
    },
  })

  if (!user) return null

  // สังกัดที่ยังไม่หมดอายุและหน่วยงานยังไม่ถูกเก็บถาวร
  const activeMemberships = user.orgUnits.filter(
    (membership) =>
      membership.orgUnit.isActive && (!membership.endDate || membership.endDate > now),
  )

  const roleCodesByUnit = new Map<string, string[]>()
  for (const userRole of user.roles) {
    if (!userRole.orgUnitId) continue
    const list = roleCodesByUnit.get(userRole.orgUnitId) ?? []
    list.push(userRole.role.code)
    roleCodesByUnit.set(userRole.orgUnitId, list)
  }

  const globalRoleCodes = user.roles.filter((r) => !r.orgUnitId).map((r) => r.role.code)

  const affiliations = activeMemberships.map((membership) => {
    const codes = [...(roleCodesByUnit.get(membership.orgUnitId) ?? []), ...globalRoleCodes]
    return {
      orgUnitId: membership.orgUnitId,
      orgUnitName: membership.orgUnit.nameTh,
      orgUnitShortName: membership.orgUnit.shortName,
      orgUnitCode: membership.orgUnit.code,
      orgUnitPath: membership.orgUnit.path,
      positionTitle: membership.positionTitle,
      isPrimary: membership.isPrimary,
      roleCodes: codes,
      roleLabels: codes.map((code) => roleLabel(code)),
    }
  })

  // รวมสิทธิ์จากบทบาทที่ใช้ได้ใน context นี้ — เลือก scope ที่กว้างที่สุดเมื่อซ้ำกัน
  const permissions: Record<string, PermissionScope> = {}
  const roleCodes: string[] = []

  for (const userRole of user.roles) {
    const appliesHere = userRole.orgUnitId === null || userRole.orgUnitId === activeOrgUnitId
    if (!appliesHere) continue

    roleCodes.push(userRole.role.code)

    for (const rolePermission of userRole.role.permissions) {
      const current = permissions[rolePermission.permissionCode]
      if (!current || SCOPE_RANK[rolePermission.scope] > SCOPE_RANK[current]) {
        permissions[rolePermission.permissionCode] = rolePermission.scope
      }
    }
  }

  const activeOrgUnitPath =
    affiliations.find((a) => a.orgUnitId === activeOrgUnitId)?.orgUnitPath ?? null

  return {
    user: {
      id: user.id,
      tenantId: user.tenantId,
      username: user.username,
      prefix: user.prefix,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      clearanceLevel: user.clearanceLevel,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
    },
    permissions: permissions as Partial<Record<Permission, PermissionScope>>,
    roleCodes: [...new Set(roleCodes)] as RoleCode[],
    orgUnitIds: activeMemberships.map((m) => m.orgUnitId),
    affiliations,
    activeOrgUnitPath,
  }
}

function roleLabel(code: string): string {
  return code in ROLE_LABELS ? ROLE_LABELS[code as RoleCode] : code
}
