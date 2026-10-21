-- CreateTable
CREATE TABLE "printed_tickets" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "vendor_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "transaction_id" INTEGER,
    "raffle_number_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMPTZ(6),

    CONSTRAINT "printed_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "printed_tickets_code_key" ON "printed_tickets"("code");

-- CreateIndex
CREATE UNIQUE INDEX "printed_tickets_raffle_number_id_key" ON "printed_tickets"("raffle_number_id");

-- CreateIndex
CREATE INDEX "printed_tickets_vendor_id_idx" ON "printed_tickets"("vendor_id");

-- CreateIndex
CREATE INDEX "printed_tickets_transaction_id_idx" ON "printed_tickets"("transaction_id");

-- AddForeignKey
ALTER TABLE "printed_tickets" ADD CONSTRAINT "printed_tickets_vendor_id_fkey"
FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printed_tickets" ADD CONSTRAINT "printed_tickets_transaction_id_fkey"
FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printed_tickets" ADD CONSTRAINT "printed_tickets_raffle_number_id_fkey"
FOREIGN KEY ("raffle_number_id") REFERENCES "raffle_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
