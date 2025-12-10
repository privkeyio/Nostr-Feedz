-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "userPubkey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userPubkey" TEXT NOT NULL,
    "organizationMode" TEXT NOT NULL DEFAULT 'tags',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "categoryId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Category_userPubkey_name_key" ON "Category"("userPubkey", "name");

-- CreateIndex
CREATE INDEX "Category_userPubkey_idx" ON "Category"("userPubkey");

-- CreateIndex
CREATE INDEX "Category_userPubkey_sortOrder_idx" ON "Category"("userPubkey", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userPubkey_key" ON "UserPreference"("userPubkey");

-- CreateIndex
CREATE INDEX "UserPreference_userPubkey_idx" ON "UserPreference"("userPubkey");

-- CreateIndex
CREATE INDEX "Subscription_userPubkey_categoryId_idx" ON "Subscription"("userPubkey", "categoryId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
