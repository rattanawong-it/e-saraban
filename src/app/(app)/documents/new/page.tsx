import type { Metadata } from "next"

import { APP_NAME, COMMON, DOCUMENTS } from "@/constants"
import { prisma } from "@/lib/db"
import { DocumentForm } from "@/components/documents/document-form"
import { Alert, PageHeader } from "@/components/ui/primitives"
import { listOrgUnitsFlat } from "@/server/services/org-unit.service"
import { requireSession } from "@/server/session"

export const metadata: Metadata = {
  title: `${DOCUMENTS.create} · ${APP_NAME}`,
}

export default async function NewDocumentPage() {
  const session = await requireSession()

  const [documentTypes, orgUnits] = await Promise.all([
    prisma.documentType.findMany({
      where: {
        tenantId: session.ctx.tenantId,
        isActive: true,
        // หนังสือรับลงทะเบียนที่หน้าทะเบียนรับ ไม่ใช่ที่นี่ (spec §6.3)
        direction: { in: ["INTERNAL", "OUTGOING"] },
      },
      orderBy: { sortOrder: "asc" },
      select: { id: true, nameTh: true, direction: true },
    }),
    listOrgUnitsFlat(session.ctx.tenantId),
  ])

  const activeUnit = session.affiliations.find(
    (item) => item.orgUnitId === session.ctx.activeOrgUnitId,
  )

  return (
    <>
      <PageHeader title={DOCUMENTS.create} description={DOCUMENTS.createDescription} />

      {documentTypes.length === 0 ? (
        <Alert tone="warning" title={DOCUMENTS.noDocumentType}>
          {DOCUMENTS.noDocumentTypeHint}
        </Alert>
      ) : (
        <DocumentForm
          mode="create"
          documentTypes={documentTypes}
          orgUnits={orgUnits.map((unit) => ({
            id: unit.id,
            code: unit.code,
            label: unit.nameTh,
            level: unit.level,
          }))}
          ownerUnitName={activeUnit?.orgUnitName ?? COMMON.none}
        />
      )}
    </>
  )
}
