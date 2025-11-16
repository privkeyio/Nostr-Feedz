-- Create Favorite table to support feed item bookmarking
CREATE TABLE "Favorite" (
  "id" TEXT NOT NULL,
  "userPubkey" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Favorite_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "FeedItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Ensure a user can only favorite an item once
CREATE UNIQUE INDEX "Favorite_userPubkey_itemId_key" ON "Favorite"("userPubkey", "itemId");

-- Optimize favorite lookups
CREATE INDEX "Favorite_userPubkey_idx" ON "Favorite"("userPubkey");
CREATE INDEX "Favorite_userPubkey_createdAt_idx" ON "Favorite"("userPubkey", "createdAt");
