-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'READY', 'SENDING', 'SENT', 'COMPLETED', 'PAUSED');

-- CreateTable
CREATE TABLE "WellsOnyxCampaign" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "practiceGroupId" TEXT NOT NULL,
    "practiceGroupName" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "prospectCount" INTEGER NOT NULL DEFAULT 0,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "approvedCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "practiceGroupData" JSONB,
    "prospectsData" JSONB,
    "messagesData" JSONB,
    "instantlyApiKey" TEXT,
    "instantlyCampaignId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WellsOnyxCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WellsOnyxCampaign_campaignId_key" ON "WellsOnyxCampaign"("campaignId");

-- CreateIndex
CREATE INDEX "WellsOnyxCampaign_userId_idx" ON "WellsOnyxCampaign"("userId");

-- CreateIndex
CREATE INDEX "WellsOnyxCampaign_campaignId_idx" ON "WellsOnyxCampaign"("campaignId");

-- CreateIndex
CREATE INDEX "WellsOnyxCampaign_status_idx" ON "WellsOnyxCampaign"("status");

-- CreateIndex
CREATE INDEX "WellsOnyxCampaign_createdAt_idx" ON "WellsOnyxCampaign"("createdAt");
