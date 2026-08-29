import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';

const PRICE_PER_TICKET = 2500;
const ALLOWED_QUANTITIES = new Set([1, 2, 3, 5, 10]);

let prismaClient;

class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InputError';
    this.statusCode = 400;
  }
}

function getPrisma() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('La variable de entorno DATABASE_URL no está configurada.');
  }

  if (!/^postgres(?:ql)?:\/\//.test(connectionString)) {
    throw new Error('DATABASE_URL debe ser una conexión PostgreSQL directa de Neon.');
  }

  if (!prismaClient) {
    const adapter = new PrismaNeon({ connectionString });
    prismaClient = new PrismaClient({ adapter });
  }

  return prismaClient;
}

function requiredText(value, field, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';

  if (!text) {
    throw new InputError(`El campo ${field} es obligatorio.`);
  }

  if (text.length > maxLength) {
    throw new InputError(`El campo ${field} es demasiado largo.`);
  }

  return text;
}

function validatePurchase(payload) {
  const name = requiredText(payload.name, 'nombre', 150);
  const email = requiredText(payload.email, 'correo', 254).toLowerCase();
  const phone = requiredText(payload.phone, 'teléfono', 30);
  const seller = requiredText(payload.seller, 'vendida por', 150);
  const quantity = Number(payload.quantity);
  const amount = Number(payload.depositAmount);
  const proofUrl = requiredText(payload.proofUrl, 'comprobante de pago', 2048);
  const proofName = requiredText(payload.proofName, 'nombre del comprobante', 255);
  const proofType = requiredText(payload.proofType, 'tipo del comprobante', 100);

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new InputError('Ingresa un correo electrónico válido.');
  }

  if (!ALLOWED_QUANTITIES.has(quantity)) {
    throw new InputError('La cantidad de rifas seleccionada no es válida.');
  }

  if (!Number.isFinite(amount) || amount !== quantity * PRICE_PER_TICKET) {
    throw new InputError(`El monto debe ser $${(quantity * PRICE_PER_TICKET).toLocaleString('es-CL')}.`);
  }

  return { name, email, phone, seller, quantity, amount, proofUrl, proofName, proofType };
}

async function createPurchase(payload) {
  const purchase = validatePurchase(payload);
  const prisma = getPrisma();

  const transaction = await prisma.transaction.create({
    data: {
      customer: {
        create: {
          name: purchase.name,
          email: purchase.email,
          phone: purchase.phone
        }
      },
      vendor: {
        connectOrCreate: {
          where: { name: purchase.seller },
          create: { name: purchase.seller }
        }
      },
      quantity: purchase.quantity,
      amount: purchase.amount,
      status: 'pending',
      proofUrl: purchase.proofUrl,
      proofName: purchase.proofName,
      proofType: purchase.proofType,
      raffleNumbers: {
        create: Array.from({ length: purchase.quantity }, () => ({
          status: 'reserved'
        }))
      }
    },
    select: {
      id: true,
      customerId: true,
      vendorId: true,
      quantity: true,
      status: true,
      raffleNumbers: {
        select: { number: true },
        orderBy: { number: 'asc' }
      }
    }
  });

  return {
    customerId: transaction.customerId,
    vendorId: transaction.vendorId,
    transactionId: transaction.id,
    quantity: transaction.quantity,
    status: transaction.status,
    raffleNumbers: transaction.raffleNumbers.map(({ number }) => number)
  };
}

async function listPurchases(status) {
  const prisma = getPrisma();
  const where = status ? { status } : {};

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { submittedAt: 'desc' },
    include: {
      customer: true,
      vendor: true,
      raffleNumbers: {
        select: { number: true },
        orderBy: { number: 'asc' }
      }
    }
  });

  return transactions.map((transaction) => ({
    id: transaction.id,
    name: transaction.customer.name,
    email: transaction.customer.email,
    phone: transaction.customer.phone,
    seller: transaction.vendor?.name ?? '—',
    quantity: transaction.quantity,
    amount: Number(transaction.amount),
    status: transaction.status,
    submittedAt: transaction.submittedAt,
    proofUrl: transaction.proofUrl,
    raffleNumbers: transaction.raffleNumbers.map((raffleNumber) => raffleNumber.number)
  }));
}

async function confirmPurchase(transactionId) {
  const id = Number(transactionId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new InputError('Identificador de compra inválido.');
  }

  const prisma = getPrisma();
  const transaction = await prisma.transaction.findUnique({ where: { id } });

  if (!transaction) {
    throw new InputError('La compra no existe.');
  }

  if (transaction.status === 'approved') {
    throw new InputError('La compra ya estaba confirmada.');
  }

  await prisma.$transaction([
    prisma.transaction.update({
      where: { id },
      data: { status: 'approved' }
    }),
    prisma.raffleNumber.updateMany({
      where: { transactionId: id },
      data: { status: 'sold', soldAt: new Date() }
    })
  ]);

  return { id, status: 'approved' };
}

export {
  InputError,
  createPurchase,
  listPurchases,
  confirmPurchase
};
