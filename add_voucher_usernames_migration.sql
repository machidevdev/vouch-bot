-- This migration adds the voucherUsernames field to track all users who vouched
-- Run this with: npx prisma db push (for development) or create a proper migration

-- Add the new voucherUsernames column
ALTER TABLE "Vote" ADD COLUMN "voucherUsernames" TEXT[] DEFAULT '{}';

-- Populate existing records with createdBy as the initial voucher
UPDATE "Vote" SET "voucherUsernames" = ARRAY[createdBy] WHERE "voucherUsernames" = '{}';
