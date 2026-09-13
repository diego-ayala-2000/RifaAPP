-- AlterTable: agregar token a vendors (idempotente)
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "token" TEXT;

-- Backfill: token aleatorio para vendedores existentes (no requiere extensiones)
UPDATE "vendors"
SET "token" = md5(random()::text || clock_timestamp()::text || "id"::text)
WHERE "token" IS NULL;

-- Enforce NOT NULL + unicidad
ALTER TABLE "vendors" ALTER COLUMN "token" SET NOT NULL;
DROP INDEX IF EXISTS "vendors_token_key";
CREATE UNIQUE INDEX "vendors_token_key" ON "vendors"("token");
