-- CreateTable
CREATE TABLE "transaction_type_master" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL DEFAULT 'SYSTEM',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "transaction_type_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_transactions" (
    "id" SERIAL NOT NULL,
    "loanId" INTEGER NOT NULL,
    "transactionTypeId" INTEGER NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DOUBLE PRECISION NOT NULL,
    "principalImpact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interestImpact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "penaltyImpact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feeImpact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "runningPrincipal" DOUBLE PRECISION NOT NULL,
    "runningInterest" DOUBLE PRECISION NOT NULL,
    "runningTotal" DOUBLE PRECISION NOT NULL,
    "referenceId" INTEGER,
    "referenceType" TEXT,
    "description" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'SYSTEM',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "loan_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transaction_type_master_name_key" ON "transaction_type_master"("name");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_type_master_code_key" ON "transaction_type_master"("code");

-- CreateIndex
CREATE INDEX "loan_transactions_loanId_transactionDate_idx" ON "loan_transactions"("loanId", "transactionDate");

-- CreateIndex
CREATE INDEX "loan_transactions_transactionTypeId_idx" ON "loan_transactions"("transactionTypeId");

-- CreateIndex
CREATE INDEX "loan_transactions_transactionDate_idx" ON "loan_transactions"("transactionDate");

-- AddForeignKey
ALTER TABLE "loan_transactions" ADD CONSTRAINT "loan_transactions_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_transactions" ADD CONSTRAINT "loan_transactions_transactionTypeId_fkey" FOREIGN KEY ("transactionTypeId") REFERENCES "transaction_type_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
