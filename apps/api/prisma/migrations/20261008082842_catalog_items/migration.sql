/*
  Warnings:

  - The `embedding` column on the `KnowledgeChunk` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "CatalogType" AS ENUM ('SERVICE', 'PRODUCT');

-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "KnowledgeChunk" DROP COLUMN "embedding",
ADD COLUMN     "embedding" double precision[];

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "CatalogType" NOT NULL DEFAULT 'SERVICE',
    "price" DOUBLE PRECISION,
    "status" "CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogItem_companyId_type_idx" ON "CatalogItem"("companyId", "type");

-- CreateIndex
CREATE INDEX "CatalogItem_companyId_status_idx" ON "CatalogItem"("companyId", "status");

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
