-- AlterTable
ALTER TABLE "collaterals" ADD COLUMN     "appraisedValueAtLoanCreation" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "marketRateAtLoanCreation" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "purityRatioAtLoanCreation" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "purityUnit" TEXT NOT NULL DEFAULT 'PERCENTAGE';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
ADD COLUMN     "riskScore" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "market_rates" (
    "id" SERIAL NOT NULL,
    "asset" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "apiEndpoint" TEXT,
    "dailyChange" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weeklyChange" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL DEFAULT 'SYSTEM',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "market_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_rate_history" (
    "id" SERIAL NOT NULL,
    "asset" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_rate_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "market_rates_asset_key" ON "market_rates"("asset");
