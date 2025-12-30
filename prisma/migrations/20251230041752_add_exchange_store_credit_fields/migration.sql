-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN     "exchangeBonusApplied" DOUBLE PRECISION,
ADD COLUMN     "exchangeOrderId" TEXT,
ADD COLUMN     "exchangeType" TEXT,
ADD COLUMN     "exchangeValueUsed" DOUBLE PRECISION,
ADD COLUMN     "resolutionType" TEXT,
ADD COLUMN     "storeCreditCode" TEXT,
ADD COLUMN     "storeCreditIssued" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN     "exchangeEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "shopNowExchangeEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "storeCreditBonusPercent" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "storeCreditEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "storeCreditExpiryDays" INTEGER;
