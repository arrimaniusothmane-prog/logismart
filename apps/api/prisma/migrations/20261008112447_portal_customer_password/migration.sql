/*
  Warnings:

  - The `embedding` column on the `KnowledgeChunk` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "passwordHash" TEXT;

-- AlterTable
ALTER TABLE "KnowledgeChunk" DROP COLUMN "embedding",
ADD COLUMN     "embedding" double precision[];

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");
