-- Teléfono y RUT de los vendedores que se inscriben solos (inscripcion.html).
-- Son opcionales: los vendedores creados desde el panel admin quedan sin ellos.
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "rut" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vendors_phone_key" ON "vendors"("phone");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vendors_rut_key" ON "vendors"("rut");
