-- Deduplicar clientes por teléfono antes de imponer unicidad.
-- Para cada teléfono se conserva el cliente de menor id y se repuntan sus transacciones.

UPDATE "transactions" AS t
SET "customer_id" = keep.keep_id
FROM (
  SELECT "phone", MIN("id") AS keep_id
  FROM "customers"
  GROUP BY "phone"
) AS keep
JOIN "customers" AS dup ON dup."phone" = keep."phone"
WHERE t."customer_id" = dup."id"
  AND dup."id" <> keep.keep_id;

DELETE FROM "customers" AS dup
USING (
  SELECT "phone", MIN("id") AS keep_id
  FROM "customers"
  GROUP BY "phone"
) AS keep
WHERE dup."phone" = keep."phone"
  AND dup."id" <> keep.keep_id;

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");
