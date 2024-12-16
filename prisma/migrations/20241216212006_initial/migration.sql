-- CreateTable
CREATE TABLE "Vote" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "upvoterUsernames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "downvoterUsernames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "twitterUsername" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "messageId" BIGINT NOT NULL,
    "chatId" BIGINT NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vote_messageId_chatId_key" ON "Vote"("messageId", "chatId");
