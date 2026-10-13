/*
  Warnings:

  - The `embedding` column on the `KnowledgeChunk` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "notificationsReadAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "KnowledgeChunk" DROP COLUMN "embedding",
ADD COLUMN     "embedding" double precision[];
