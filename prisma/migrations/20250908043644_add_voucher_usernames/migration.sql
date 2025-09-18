/*
  Warnings:

  - The `feedback` column on the `Feedback` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `submittedBy` column on the `Feedback` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[messageId,chatId]` on the table `Feedback` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Feedback` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "chatId" BIGINT,
ADD COLUMN     "downvoterUsernames" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "messageId" BIGINT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "upvoterUsernames" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "feedback",
ADD COLUMN     "feedback" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "submittedBy",
ADD COLUMN     "submittedBy" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Vote" ADD COLUMN     "voucherUsernames" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_messageId_chatId_key" ON "Feedback"("messageId", "chatId");
