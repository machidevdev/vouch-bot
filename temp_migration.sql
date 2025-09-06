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
    "description" TEXT,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" SERIAL NOT NULL,
    "requiredUpvotes" INTEGER NOT NULL DEFAULT 15,
    "requiredDownvotes" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "targetUsername" TEXT NOT NULL,
    "feedback" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "submittedBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "upvoterUsernames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "downvoterUsernames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "messageId" BIGINT,
    "chatId" BIGINT,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vote_messageId_chatId_key" ON "Vote"("messageId", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_messageId_chatId_key" ON "Feedback"("messageId", "chatId");

