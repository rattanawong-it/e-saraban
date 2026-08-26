-- AlterEnum
ALTER TYPE "AclPermission" ADD VALUE 'REGISTER';

-- CreateTable
CREATE TABLE "confidential_registrars" (
    "id" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "confidential_registrars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "confidential_registrars_orgUnitId_idx" ON "confidential_registrars"("orgUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "confidential_registrars_orgUnitId_userId_key" ON "confidential_registrars"("orgUnitId", "userId");

-- AddForeignKey
ALTER TABLE "confidential_registrars" ADD CONSTRAINT "confidential_registrars_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "org_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confidential_registrars" ADD CONSTRAINT "confidential_registrars_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confidential_registrars" ADD CONSTRAINT "confidential_registrars_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
