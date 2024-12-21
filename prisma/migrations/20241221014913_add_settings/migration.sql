-- CreateTable
CREATE TABLE "Settings" (
    "id" SERIAL NOT NULL,
    "requiredUpvotes" INTEGER NOT NULL DEFAULT 15,
    "requiredDownvotes" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);
