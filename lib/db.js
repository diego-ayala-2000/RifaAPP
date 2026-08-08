const { sql } = require('@vercel/postgres');

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vendors (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
      quantity INTEGER NOT NULL,
      deposit_amount NUMERIC(12, 2) NOT NULL,
      proof_url TEXT,
      proof_name TEXT,
      proof_type TEXT,
      submitted_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS raffle_numbers (
      id SERIAL PRIMARY KEY,
      number INTEGER NOT NULL UNIQUE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'sold',
      sold_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
}

async function createPurchase(payload) {
  await ensureSchema();

  const customerResult = await sql`
    INSERT INTO customers (name, email, phone)
    VALUES (${payload.name || 'Comprador'}, ${payload.email || null}, ${payload.phone || null})
    RETURNING id;
  `;
  const customerId = customerResult.rows[0].id;

  const vendorName = payload.seller || 'No registrado';
  const vendorResult = await sql`
    INSERT INTO vendors (name)
    VALUES (${vendorName})
    ON CONFLICT (name) DO NOTHING
    RETURNING id;
  `;

  let vendorId = vendorResult.rows[0]?.id;
  if (!vendorId) {
    const existingVendor = await sql`
      SELECT id FROM vendors WHERE name = ${vendorName} LIMIT 1;
    `;
    vendorId = existingVendor.rows[0]?.id;
  }

  const transactionResult = await sql`
    INSERT INTO transactions (customer_id, vendor_id, quantity, deposit_amount, proof_url, proof_name, proof_type, submitted_at)
    VALUES (
      ${customerId},
      ${vendorId},
      ${Number(payload.quantity || 1)},
      ${Number(payload.depositAmount || 0)},
      ${payload.proofUrl || null},
      ${payload.proofName || null},
      ${payload.proofType || null},
      ${payload.submittedAt || new Date().toISOString()}
    )
    RETURNING id;
  `;

  const transactionId = transactionResult.rows[0].id;
  const quantity = Number(payload.quantity || 1);

  if (quantity > 0) {
    const maxNumberResult = await sql`
      SELECT COALESCE(MAX(number), 0) AS max_number FROM raffle_numbers;
    `;
    const maxNumber = Number(maxNumberResult.rows[0].max_number || 0);

    for (let index = 0; index < quantity; index += 1) {
      const ticketNumber = maxNumber + index + 1;
      await sql`
        INSERT INTO raffle_numbers (number, customer_id, status, sold_at)
        VALUES (${ticketNumber}, ${customerId}, 'sold', NOW());
      `;
    }
  }

  return {
    customerId,
    vendorId,
    transactionId,
    quantity
  };
}

module.exports = {
  ensureSchema,
  createPurchase
};
