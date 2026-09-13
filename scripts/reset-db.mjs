// Vacía las tablas de la rifa y reinicia los contadores (números desde 1 otra vez).
// Uso:  node scripts/reset-db.mjs --yes
//
// BORRA: vendors, transactions, raffle_numbers, customers.
// NO toca variables de entorno ni la clave admin.
import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString || !/^postgres(ql)?:\/\//.test(connectionString)) {
  console.error('DATABASE_URL inválida o ausente en .env');
  process.exit(1);
}

if (process.argv[2] !== '--yes') {
  console.error('Esto BORRA vendedores, transacciones, números de rifa y clientes.');
  console.error('Si estás seguro, repite con:');
  console.error('  node scripts/reset-db.mjs --yes');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

try {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "raffle_numbers", "transactions", "vendors", "customers" RESTART IDENTITY CASCADE'
  );
  console.log('✅ Base limpia. Vendedores, transacciones, números y clientes en 0.');
} catch (error) {
  console.error('Error al limpiar:', error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
