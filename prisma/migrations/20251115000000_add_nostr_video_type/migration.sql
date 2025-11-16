-- AlterEnum: Add NOSTR_VIDEO to FeedType enum and remove VIDEO
-- First, add the new NOSTR_VIDEO value
ALTER TYPE "FeedType" ADD VALUE IF NOT EXISTS 'NOSTR_VIDEO';

-- Note: Cannot directly remove 'VIDEO' enum value in PostgreSQL
-- If you need to remove it, you would need to:
-- 1. Create a new enum type
-- 2. Alter all columns using the old enum to use the new one
-- 3. Drop the old enum type
-- For now, we'll leave VIDEO in the enum but it won't be used
