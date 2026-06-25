-- Allow reusing a customer's mobile number after the original record is soft-deleted.
-- Keep uniqueness enforced for active customers only.
DROP INDEX IF EXISTS "customers_mobile_key";

CREATE UNIQUE INDEX "customers_mobile_active_key"
ON "customers"("mobile")
WHERE "is_deleted" = false;
