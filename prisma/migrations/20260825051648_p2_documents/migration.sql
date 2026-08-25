-- CreateEnum
CREATE TYPE "DocumentDirection" AS ENUM ('INTERNAL', 'OUTGOING', 'INCOMING');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'PENDING_NUMBER', 'RETURNED', 'REGISTERED', 'CIRCULATING', 'SENT', 'RECEIVED', 'FORWARDED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecipientKind" AS ENUM ('TO', 'CC', 'FYI');

-- CreateEnum
CREATE TYPE "RecipientStatus" AS ENUM ('PENDING', 'SENT', 'READ', 'ACKNOWLEDGED');

-- CreateEnum
CREATE TYPE "DocumentActionType" AS ENUM ('CREATED', 'UPDATED', 'SUBMITTED', 'RETURNED', 'NUMBER_ISSUED', 'CIRCULATED', 'ACKNOWLEDGED', 'MARKED_SENT', 'FORWARDED', 'CLOSED', 'CANCELLED', 'ATTACHMENT_ADDED', 'ATTACHMENT_REMOVED');

-- CreateEnum
CREATE TYPE "AclPrincipalType" AS ENUM ('USER', 'ORG_UNIT', 'ROLE');

-- CreateEnum
CREATE TYPE "AclPermission" AS ENUM ('VIEW', 'DOWNLOAD', 'EDIT', 'MANAGE');

-- CreateEnum
CREATE TYPE "AclEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateTable
CREATE TABLE "document_types" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "direction" "DocumentDirection" NOT NULL,
    "defaultBookCode" TEXT NOT NULL DEFAULT 'MAIN',
    "numberPattern" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "docNo" TEXT,
    "seqValue" INTEGER,
    "bookCode" TEXT NOT NULL DEFAULT 'MAIN',
    "year" INTEGER,
    "documentTypeId" TEXT NOT NULL,
    "direction" "DocumentDirection" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "subject" TEXT NOT NULL,
    "summary" TEXT,
    "docDate" TIMESTAMPTZ(3),
    "receivedDate" TIMESTAMPTZ(3),
    "dueDate" TIMESTAMPTZ(3),
    "confidentialityLevel" INTEGER NOT NULL DEFAULT 0,
    "urgencyLevel" INTEGER NOT NULL DEFAULT 0,
    "ownerUnitId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdByUnitId" TEXT NOT NULL,
    "externalSenderName" TEXT,
    "externalRecipientName" TEXT,
    "refDocNo" TEXT,
    "parentDocumentId" TEXT,
    "searchVector" tsvector,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "number_sequences" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "direction" "DocumentDirection" NOT NULL,
    "bookCode" TEXT NOT NULL DEFAULT 'MAIN',
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "patternOverride" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "encAlgo" TEXT,
    "encryptedDek" TEXT,
    "iv" TEXT,
    "authTag" TEXT,
    "keyVersion" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_recipients" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "orgUnitId" TEXT,
    "userId" TEXT,
    "kind" "RecipientKind" NOT NULL DEFAULT 'TO',
    "status" "RecipientStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMPTZ(3),
    "readAt" TIMESTAMPTZ(3),
    "acknowledgedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_actions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorUnitId" TEXT,
    "actionType" "DocumentActionType" NOT NULL,
    "fromStatus" "DocumentStatus",
    "toStatus" "DocumentStatus",
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_acls" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "principalType" "AclPrincipalType" NOT NULL,
    "principalId" TEXT NOT NULL,
    "permission" "AclPermission" NOT NULL,
    "effect" "AclEffect" NOT NULL DEFAULT 'ALLOW',
    "grantedById" TEXT NOT NULL,
    "grantedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3),
    "reason" TEXT,

    CONSTRAINT "document_acls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_types_tenantId_direction_isActive_idx" ON "document_types"("tenantId", "direction", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "document_types_tenantId_code_key" ON "document_types"("tenantId", "code");

-- CreateIndex
CREATE INDEX "documents_tenantId_ownerUnitId_status_docDate_idx" ON "documents"("tenantId", "ownerUnitId", "status", "docDate" DESC);

-- CreateIndex
CREATE INDEX "documents_tenantId_status_createdAt_idx" ON "documents"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "documents_tenantId_docNo_idx" ON "documents"("tenantId", "docNo");

-- CreateIndex
CREATE INDEX "documents_documentTypeId_idx" ON "documents"("documentTypeId");

-- CreateIndex
CREATE INDEX "documents_parentDocumentId_idx" ON "documents"("parentDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_tenantId_ownerUnitId_direction_bookCode_year_seqV_key" ON "documents"("tenantId", "ownerUnitId", "direction", "bookCode", "year", "seqValue");

-- CreateIndex
CREATE UNIQUE INDEX "number_sequences_tenantId_orgUnitId_direction_bookCode_year_key" ON "number_sequences"("tenantId", "orgUnitId", "direction", "bookCode", "year");

-- CreateIndex
CREATE INDEX "attachments_documentId_version_idx" ON "attachments"("documentId", "version");

-- CreateIndex
CREATE INDEX "attachments_sha256_idx" ON "attachments"("sha256");

-- CreateIndex
CREATE INDEX "document_recipients_documentId_idx" ON "document_recipients"("documentId");

-- CreateIndex
CREATE INDEX "document_recipients_orgUnitId_status_idx" ON "document_recipients"("orgUnitId", "status");

-- CreateIndex
CREATE INDEX "document_recipients_userId_readAt_idx" ON "document_recipients"("userId", "readAt");

-- CreateIndex
CREATE INDEX "document_actions_documentId_createdAt_idx" ON "document_actions"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "document_acls_documentId_idx" ON "document_acls"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "document_acls_documentId_principalType_principalId_permissi_key" ON "document_acls"("documentId", "principalType", "principalId", "permission");

-- AddForeignKey
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_ownerUnitId_fkey" FOREIGN KEY ("ownerUnitId") REFERENCES "org_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_createdByUnitId_fkey" FOREIGN KEY ("createdByUnitId") REFERENCES "org_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_parentDocumentId_fkey" FOREIGN KEY ("parentDocumentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "org_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_recipients" ADD CONSTRAINT "document_recipients_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_recipients" ADD CONSTRAINT "document_recipients_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "org_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_recipients" ADD CONSTRAINT "document_recipients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_actions" ADD CONSTRAINT "document_actions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_actions" ADD CONSTRAINT "document_actions_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_actions" ADD CONSTRAINT "document_actions_actorUnitId_fkey" FOREIGN KEY ("actorUnitId") REFERENCES "org_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_acls" ADD CONSTRAINT "document_acls_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_acls" ADD CONSTRAINT "document_acls_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- ส่วนที่ Prisma สร้างเองไม่ได้ — เขียนต่อท้ายด้วยมือ (spec §9.2 · §9.3)
-- ---------------------------------------------------------------------------

-- ผู้รับต้องเป็นหน่วยงานหรือรายบุคคลอย่างใดอย่างหนึ่ง ไม่ใช่ทั้งคู่และไม่ใช่ไม่มีเลย
-- ถ้าปล่อยให้ว่างทั้งคู่ เอกสารจะเวียนไปหา "ไม่มีใคร" โดยที่ระบบไม่รู้ตัว
ALTER TABLE "document_recipients"
  ADD CONSTRAINT "document_recipients_principal_check"
  CHECK (("orgUnitId" IS NOT NULL) <> ("userId" IS NOT NULL));

-- เลขทะเบียนต้องมากันครบชุด: มีเลขแล้วต้องมีทั้ง docNo, seqValue และปี
-- ครึ่ง ๆ กลาง ๆ แปลว่าออกเลขค้างกลางทาง ซึ่งทะเบียนราชการรับไม่ได้ (§6.4)
ALTER TABLE "documents"
  ADD CONSTRAINT "documents_number_complete_check"
  CHECK (
    ("docNo" IS NULL AND "seqValue" IS NULL AND "year" IS NULL)
    OR ("docNo" IS NOT NULL AND "seqValue" IS NOT NULL AND "year" IS NOT NULL)
  );

-- ชั้นความลับและความเร่งด่วนอยู่ในช่วง 0–3 ตาม §8.1
ALTER TABLE "documents"
  ADD CONSTRAINT "documents_levels_check"
  CHECK (
    "confidentialityLevel" BETWEEN 0 AND 3
    AND "urgencyLevel" BETWEEN 0 AND 3
  );

-- ตัวนับเลขต้องไม่ติดลบ
ALTER TABLE "number_sequences"
  ADD CONSTRAINT "number_sequences_last_value_check"
  CHECK ("lastValue" >= 0);

-- ⚠️ ค้นหาภาษาไทย: ไม่มีเว้นวรรค tsvector จึงตัดคำไม่ได้
-- pg_trgm เป็นกลไกหลักตาม §9.2 · ต้องเป็น GIN + gin_trgm_ops ไม่ใช่ B-tree
CREATE INDEX "documents_subject_trgm_idx" ON "documents" USING GIN ("subject" gin_trgm_ops);
CREATE INDEX "documents_docNo_trgm_idx" ON "documents" USING GIN ("docNo" gin_trgm_ops);

-- tsvector ไว้ค้นเลขที่หนังสือและคำอังกฤษ — เสริมจาก trgm
CREATE INDEX "documents_searchVector_idx" ON "documents" USING GIN ("searchVector");

-- เติม searchVector ให้อัตโนมัติทุกครั้งที่เขียนแถว
-- ใช้ config 'simple' เพราะ dictionary ภาษาไทยไม่มีใน Postgres มาตรฐาน
-- ถ้าใช้ 'english' คำไทยจะถูก stem ผิดจนค้นไม่เจอ
CREATE OR REPLACE FUNCTION documents_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('simple', unaccent(coalesce(NEW."docNo", ''))), 'A') ||
    setweight(to_tsvector('simple', unaccent(coalesce(NEW."subject", ''))), 'B') ||
    setweight(to_tsvector('simple', unaccent(coalesce(NEW."summary", ''))), 'C') ||
    setweight(to_tsvector('simple', unaccent(coalesce(NEW."refDocNo", ''))), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "docNo", "subject", "summary", "refDocNo"
  ON "documents"
  FOR EACH ROW EXECUTE FUNCTION documents_search_vector_update();
