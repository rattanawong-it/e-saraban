import "server-only"

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, writeAudit } from "@/lib/audit"
import { PERMISSIONS } from "@/lib/authz"
import { prisma } from "@/lib/db"
import { getSystemSettings, SETTING_KEYS, settingsSchema } from "@/lib/settings"
import type { UpdateSettingsInput } from "@/schemas/setting.schema"

import type { ServiceContext } from "../context"
import { assertPermission } from "./errors"

// ค่าระบบ (หน้า /admin/settings)
//
// บันทึกทั้งหน้าในทรานแซกชันเดียว — ผู้ใช้กด "บันทึก" ครั้งเดียวแล้วต้องได้
// ผลลัพธ์เดียว ไม่ใช่บางกลุ่มบันทึกผ่าน บางกลุ่มไม่ผ่าน

export async function readSettings(ctx: ServiceContext) {
  assertPermission(ctx, PERMISSIONS.SETTING_MANAGE)
  return getSystemSettings(ctx.tenantId)
}

export async function updateSettings(ctx: ServiceContext, input: UpdateSettingsInput) {
  assertPermission(ctx, PERMISSIONS.SETTING_MANAGE)

  const before = await getSystemSettings(ctx.tenantId)

  const next = settingsSchema.parse({
    numbering: { yearMode: input.yearMode },
    file: { maxSizeMb: input.maxSizeMb, allowedMimeTypes: input.allowedMimeTypes },
    password: {
      minLength: input.minLength,
      mustChangeOnFirstLogin: input.mustChangeOnFirstLogin,
      checkCommonPasswordList: input.checkCommonPasswordList,
    },
    session: {
      idleMinutes: input.idleMinutes,
      absoluteHours: input.absoluteHours,
      lockoutThreshold: input.lockoutThreshold,
      lockoutBaseMinutes: input.lockoutBaseMinutes,
    },
  })

  await prisma.$transaction(async (tx) => {
    const groups = [
      [SETTING_KEYS.NUMBERING, next.numbering],
      [SETTING_KEYS.FILE, next.file],
      [SETTING_KEYS.PASSWORD, next.password],
      [SETTING_KEYS.SESSION, next.session],
    ] as const

    for (const [key, value] of groups) {
      await tx.systemSetting.upsert({
        where: { tenantId_key: { tenantId: ctx.tenantId, key } },
        update: { value: value as never, updatedById: ctx.userId },
        create: { tenantId: ctx.tenantId, key, value: value as never, updatedById: ctx.userId },
      })
    }

    await writeAudit(tx, {
      tenantId: ctx.tenantId,
      action: AUDIT_ACTIONS.SETTING_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.SETTING,
      actorUserId: ctx.userId,
      actorOrgUnitId: ctx.activeOrgUnitId,
      sessionId: ctx.sessionId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      // ปีที่ใช้รีเซ็ตเลขทะเบียนเปลี่ยน = เลขทะเบียนไม่ต่อเนื่อง (spec §15 ข้อ 5)
      severity: before.numbering.yearMode !== next.numbering.yearMode ? "CRITICAL" : "WARNING",
      metadata: {
        before: JSON.parse(JSON.stringify(before)),
        after: JSON.parse(JSON.stringify(next)),
      },
    })
  })

  return next
}
