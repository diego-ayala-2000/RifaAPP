import { randomBytes } from 'node:crypto';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';

const PRICE_PER_TICKET = 2000;
const MAX_QUANTITY = 1000;
const MAX_PRINT_BATCH = 200;
const MAX_CODES_PER_SALE = 100;
// Sin 0/O, 1/I/L para que los códigos se puedan leer y tipear desde el papel.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

function generateSellerToken() {
  return randomBytes(12).toString('hex');
}

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

// Deja el teléfono en 9 dígitos: quita todo lo que no sea número y un prefijo 56 si sobra.
function normalizePhoneDigits(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.replace(/^56(?=\d{9}$)/, '');
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
  const phone = normalizePhoneDigits(payload.phone);
  const seller = requiredText(payload.seller, 'vendida por', 150);

  if (phone.length !== 9) {
    throw new InputError('El teléfono del comprador debe tener 9 dígitos (ej. 912345678).');
  }
  const quantity = Number(payload.quantity);
  const amount = Number(payload.depositAmount);
  const proofUrl = requiredText(payload.proofUrl, 'comprobante de pago', 2048);
  const proofName = requiredText(payload.proofName, 'nombre del comprobante', 255);
  const proofType = requiredText(payload.proofType, 'tipo del comprobante', 100);

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new InputError('Ingresa un correo electrónico válido.');
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new InputError(`La cantidad de rifas debe ser un número entre 1 y ${MAX_QUANTITY}.`);
  }

  if (!Number.isFinite(amount) || amount !== quantity * PRICE_PER_TICKET) {
    throw new InputError(`El monto debe ser $${(quantity * PRICE_PER_TICKET).toLocaleString('es-CL')}.`);
  }

  return { name, email, phone, seller, quantity, amount, proofUrl, proofName, proofType };
}

async function createPurchase(payload, client = getPrisma()) {
  const purchase = validatePurchase(payload);

  const transaction = await client.transaction.create({
    data: {
      customer: {
        // El teléfono es el identificador del cliente: si ya existe uno con ese
        // número, se reutiliza; si no, se crea.
        connectOrCreate: {
          where: { phone: purchase.phone },
          create: {
            name: purchase.name,
            email: purchase.email,
            phone: purchase.phone
          }
        }
      },
      vendor: {
        connectOrCreate: {
          where: { name: purchase.seller },
          create: { name: purchase.seller, token: generateSellerToken() }
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
        select: { id: true, number: true },
        orderBy: { number: 'asc' }
      }
    }
  });

  return {
    raffleNumberIds: transaction.raffleNumbers.map(({ id }) => id),
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

async function getDashboard() {
  const prisma = getPrisma();

  const [raffleNumbers, transactions, vendors, customers] = await Promise.all([
    prisma.raffleNumber.findMany({
      orderBy: { number: 'asc' },
      include: {
        transaction: {
          include: { customer: true, vendor: true }
        }
      }
    }),
    prisma.transaction.findMany({
      orderBy: { submittedAt: 'desc' },
      include: {
        customer: true,
        vendor: true,
        _count: { select: { raffleNumbers: true } }
      }
    }),
    prisma.vendor.findMany({
      orderBy: { name: 'asc' },
      include: {
        transactions: { select: { quantity: true, amount: true, status: true } }
      }
    }),
    prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        transactions: { select: { quantity: true, amount: true, status: true } }
      }
    })
  ]);

  const numbers = raffleNumbers.map((item) => ({
    number: item.number,
    status: item.status,
    soldAt: item.soldAt,
    transactionId: item.transactionId,
    transactionStatus: item.transaction?.status ?? null,
    customer: item.transaction?.customer?.name ?? '—',
    email: item.transaction?.customer?.email ?? '—',
    phone: item.transaction?.customer?.phone ?? '—',
    seller: item.transaction?.vendor?.name ?? '—',
    submittedAt: item.transaction?.submittedAt ?? null
  }));

  const transactionRows = transactions.map((item) => ({
    id: item.id,
    customer: item.customer?.name ?? '—',
    email: item.customer?.email ?? '—',
    phone: item.customer?.phone ?? '—',
    seller: item.vendor?.name ?? '—',
    quantity: item.quantity,
    numbersCount: item._count.raffleNumbers,
    amount: Number(item.amount),
    status: item.status,
    submittedAt: item.submittedAt,
    proofUrl: item.proofUrl
  }));

  const sumQuantity = (list) => list.reduce((total, tx) => total + tx.quantity, 0);
  const sumAmount = (list) => list.reduce((total, tx) => total + Number(tx.amount), 0);

  const vendorRows = vendors.map((vendor) => {
    const approved = vendor.transactions.filter((tx) => tx.status === 'approved');
    return {
      name: vendor.name,
      transactions: vendor.transactions.length,
      rifas: sumQuantity(vendor.transactions),
      rifasApproved: sumQuantity(approved),
      amount: sumAmount(vendor.transactions),
      amountApproved: sumAmount(approved)
    };
  });

  const customerRows = customers.map((customer) => {
    const approved = customer.transactions.filter((tx) => tx.status === 'approved');
    return {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      transactions: customer.transactions.length,
      rifas: sumQuantity(customer.transactions),
      amount: sumAmount(customer.transactions),
      amountApproved: sumAmount(approved)
    };
  });

  const seen = new Set();
  const duplicateNumbers = [];
  for (const item of numbers) {
    if (seen.has(item.number)) duplicateNumbers.push(item.number);
    else seen.add(item.number);
  }

  const approvedTransactions = transactionRows.filter((tx) => tx.status === 'approved');
  const pendingTransactions = transactionRows.filter((tx) => tx.status !== 'approved');

  const totals = {
    numbers: numbers.length,
    reserved: numbers.filter((item) => item.status === 'reserved').length,
    sold: numbers.filter((item) => item.status === 'sold').length,
    transactions: transactionRows.length,
    approvedTransactions: approvedTransactions.length,
    pendingTransactions: pendingTransactions.length,
    vendors: vendorRows.length,
    customers: customerRows.length,
    amountApproved: approvedTransactions.reduce((total, tx) => total + tx.amount, 0),
    amountPending: pendingTransactions.reduce((total, tx) => total + tx.amount, 0)
  };

  const checks = {
    duplicateNumbers,
    soldNotApproved: numbers
      .filter((item) => item.status === 'sold' && item.transactionStatus !== 'approved')
      .map((item) => item.number),
    approvedNotSold: numbers
      .filter((item) => item.status !== 'sold' && item.transactionStatus === 'approved')
      .map((item) => item.number)
  };

  return { totals, numbers, transactions: transactionRows, vendors: vendorRows, customers: customerRows, checks };
}

async function getSellerSummary(sellerName) {
  const prisma = getPrisma();

  const vendor = await prisma.vendor.findUnique({
    where: { name: sellerName },
    include: {
      transactions: {
        orderBy: { submittedAt: 'desc' },
        include: {
          customer: true,
          raffleNumbers: { select: { number: true }, orderBy: { number: 'asc' } }
        }
      }
    }
  });

  const transactions = (vendor?.transactions ?? []).map((item) => ({
    id: item.id,
    customer: item.customer?.name ?? '—',
    email: item.customer?.email ?? '—',
    phone: item.customer?.phone ?? '—',
    quantity: item.quantity,
    amount: Number(item.amount),
    status: item.status,
    submittedAt: item.submittedAt,
    proofUrl: item.proofUrl,
    raffleNumbers: item.raffleNumbers.map((raffleNumber) => raffleNumber.number)
  }));

  const approved = transactions.filter((tx) => tx.status === 'approved');

  const totals = {
    sales: transactions.length,
    pending: transactions.length - approved.length,
    rifas: transactions.reduce((total, tx) => total + tx.quantity, 0),
    rifasApproved: approved.reduce((total, tx) => total + tx.quantity, 0),
    amount: transactions.reduce((total, tx) => total + tx.amount, 0),
    amountApproved: approved.reduce((total, tx) => total + tx.amount, 0)
  };

  return { seller: sellerName, totals, transactions };
}

function mapSellerRow(vendor) {
  const approved = vendor.transactions.filter((tx) => tx.status === 'approved');
  return {
    id: vendor.id,
    name: vendor.name,
    token: vendor.token,
    createdAt: vendor.createdAt,
    sales: vendor.transactions.length,
    pending: vendor.transactions.length - approved.length,
    rifas: vendor.transactions.reduce((total, tx) => total + tx.quantity, 0),
    rifasApproved: approved.reduce((total, tx) => total + tx.quantity, 0),
    amount: vendor.transactions.reduce((total, tx) => total + Number(tx.amount), 0),
    amountApproved: approved.reduce((total, tx) => total + Number(tx.amount), 0)
  };
}

async function findSellerByToken(token) {
  if (!token || typeof token !== 'string') return null;

  const prisma = getPrisma();
  const vendor = await prisma.vendor.findUnique({ where: { token: token.trim() } });

  return vendor ? { id: vendor.id, name: vendor.name, token: vendor.token } : null;
}

async function getSellerById(id) {
  const numId = Number(id);

  if (!Number.isInteger(numId) || numId <= 0) return null;

  const prisma = getPrisma();
  const vendor = await prisma.vendor.findUnique({ where: { id: numId } });

  return vendor ? { id: vendor.id, name: vendor.name, token: vendor.token } : null;
}

async function listSellers() {
  const prisma = getPrisma();
  const vendors = await prisma.vendor.findMany({
    orderBy: { name: 'asc' },
    include: {
      transactions: { select: { quantity: true, amount: true, status: true } }
    }
  });

  return vendors.map(mapSellerRow);
}

async function createSeller(name) {
  const clean = typeof name === 'string' ? name.trim() : '';

  if (!clean) {
    throw new InputError('El nombre del vendedor es obligatorio.');
  }

  if (clean.length > 150) {
    throw new InputError('El nombre del vendedor es demasiado largo.');
  }

  const prisma = getPrisma();
  const existing = await prisma.vendor.findUnique({ where: { name: clean } });

  if (existing) {
    throw new InputError('Ya existe un vendedor con ese nombre.');
  }

  const vendor = await prisma.vendor.create({
    data: { name: clean, token: generateSellerToken() }
  });

  return { id: vendor.id, name: vendor.name, token: vendor.token };
}

async function regenerateSellerToken(vendorId) {
  const id = Number(vendorId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new InputError('Identificador de vendedor inválido.');
  }

  const prisma = getPrisma();

  try {
    const vendor = await prisma.vendor.update({
      where: { id },
      data: { token: generateSellerToken() }
    });

    return { id: vendor.id, name: vendor.name, token: vendor.token };
  } catch (error) {
    if (error.code === 'P2025') {
      throw new InputError('El vendedor no existe.');
    }
    throw error;
  }
}

async function sellerOwnsProof(sellerName, proofUrl) {
  if (!sellerName || !proofUrl) return false;

  const prisma = getPrisma();
  const match = await prisma.transaction.findFirst({
    where: { proofUrl, vendor: { name: sellerName } },
    select: { id: true }
  });

  return Boolean(match);
}

async function getCustomerHistory(phone, excludeTransactionId) {
  const clean = normalizePhoneDigits(phone);

  if (clean.length !== 9) {
    return { transactions: [], totalRifas: 0 };
  }

  const prisma = getPrisma();
  const exclude = Number(excludeTransactionId);

  const customer = await prisma.customer.findUnique({
    where: { phone: clean },
    include: {
      transactions: {
        include: {
          raffleNumbers: { select: { number: true }, orderBy: { number: 'asc' } }
        }
      }
    }
  });

  const transactions = (customer?.transactions ?? [])
    .filter((tx) => tx.id !== exclude)
    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
    .map((tx) => ({
      date: tx.submittedAt,
      quantity: tx.quantity,
      status: tx.status,
      numbers: tx.raffleNumbers.map((raffleNumber) => raffleNumber.number)
    }));

  const totalRifas = transactions.reduce((total, tx) => total + tx.quantity, 0);

  return { transactions, totalRifas };
}

// Datos para regenerar el ticket PDF de una venta ya registrada, verificando que
// pertenezca al vendedor del enlace.
async function getSellerTicket(sellerName, transactionId) {
  const id = Number(transactionId);
  if (!Number.isInteger(id)) return null;

  const prisma = getPrisma();
  const transaction = await prisma.transaction.findFirst({
    where: { id, vendor: { name: sellerName } },
    include: {
      customer: true,
      raffleNumbers: { select: { number: true }, orderBy: { number: 'asc' } },
      printedTickets: { select: { code: true }, orderBy: { code: 'asc' } }
    }
  });

  if (!transaction) return null;

  const history = await getCustomerHistory(transaction.customer.phone, transaction.id);

  return {
    transaction: {
      id: transaction.id,
      name: transaction.customer.name,
      email: transaction.customer.email,
      phone: transaction.customer.phone,
      seller: sellerName,
      quantity: transaction.quantity,
      amount: Number(transaction.amount),
      status: transaction.status,
      submittedAt: transaction.submittedAt,
      numbers: transaction.raffleNumbers.map((raffleNumber) => raffleNumber.number),
      codes: transaction.printedTickets.map((ticket) => ticket.code)
    },
    history
  };
}

function generateTicketCode() {
  const bytes = randomBytes(CODE_LENGTH);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

// Acepta "ab3-k9x", "AB3K9X", etc. y lo deja como se guarda: 6 caracteres en mayúscula.
function normalizeTicketCode(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Crea un lote de códigos disponibles para que el vendedor los imprima.
async function createPrintedTickets(vendorId, quantityValue) {
  const quantity = Number(quantityValue);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PRINT_BATCH) {
    throw new InputError(`Puedes imprimir entre 1 y ${MAX_PRINT_BATCH} tickets por vez.`);
  }

  const prisma = getPrisma();
  const createdAt = new Date();
  const codes = new Set();

  // Los choques de códigos son muy improbables; si ocurren, se generan otros.
  for (let attempt = 0; attempt < 5 && codes.size < quantity; attempt += 1) {
    const candidates = new Set();
    while (candidates.size < quantity - codes.size) {
      const code = generateTicketCode();
      if (!codes.has(code)) candidates.add(code);
    }

    await prisma.printedTicket.createMany({
      data: [...candidates].map((code) => ({ code, vendorId, createdAt })),
      skipDuplicates: true
    });

    const saved = await prisma.printedTicket.findMany({
      where: { code: { in: [...candidates] }, vendorId, createdAt },
      select: { code: true }
    });
    saved.forEach(({ code }) => codes.add(code));
  }

  if (codes.size < quantity) {
    throw new Error('No se pudieron generar todos los códigos.');
  }

  return { codes: [...codes].sort(), createdAt };
}

async function listPrintedTickets(vendorId) {
  const prisma = getPrisma();
  const tickets = await prisma.printedTicket.findMany({
    where: { vendorId },
    orderBy: [{ createdAt: 'desc' }, { code: 'asc' }],
    include: {
      transaction: { include: { customer: true } },
      raffleNumber: { select: { number: true } }
    }
  });

  const rows = tickets.map((ticket) => ({
    code: ticket.code,
    status: ticket.status,
    createdAt: ticket.createdAt,
    usedAt: ticket.usedAt,
    transactionId: ticket.transactionId,
    customer: ticket.transaction?.customer?.name ?? null,
    raffleNumber: ticket.raffleNumber?.number ?? null
  }));

  const available = rows.filter((row) => row.status === 'available').length;

  return { totals: { printed: rows.length, available, used: rows.length - available }, tickets: rows };
}

// Registra la venta de tickets impresos: valida que los códigos sean del vendedor y
// estén disponibles, crea la transacción normal (cliente, números de rifa) y deja cada
// código ligado a su número. Todo ocurre en una sola transacción de base de datos.
async function registerPrintedSale(seller, codesValue, payload) {
  const rawCodes = Array.isArray(codesValue) ? codesValue : String(codesValue ?? '').split(/[\s,;]+/);
  const codes = [...new Set(rawCodes.map(normalizeTicketCode).filter(Boolean))];

  if (codes.length === 0) {
    throw new InputError('Ingresa al menos un código de ticket.');
  }

  if (codes.length > MAX_CODES_PER_SALE) {
    throw new InputError(`Puedes registrar hasta ${MAX_CODES_PER_SALE} tickets por venta.`);
  }

  const invalid = codes.filter((code) => code.length !== CODE_LENGTH);
  if (invalid.length) {
    throw new InputError(`Código inválido: ${invalid.join(', ')}. Los códigos tienen ${CODE_LENGTH} caracteres.`);
  }

  const prisma = getPrisma();
  const found = await prisma.printedTicket.findMany({ where: { code: { in: codes } } });
  const byCode = new Map(found.map((ticket) => [ticket.code, ticket]));

  const missing = codes.filter((code) => !byCode.has(code));
  if (missing.length) {
    throw new InputError(`Estos códigos no existen: ${missing.join(', ')}.`);
  }

  const foreign = codes.filter((code) => byCode.get(code).vendorId !== seller.id);
  if (foreign.length) {
    throw new InputError(`Estos códigos fueron impresos por otro vendedor: ${foreign.join(', ')}.`);
  }

  const used = codes.filter((code) => byCode.get(code).status !== 'available');
  if (used.length) {
    throw new InputError(`Estos códigos ya fueron registrados: ${used.join(', ')}.`);
  }

  const usedAt = new Date();

  return prisma.$transaction(async (tx) => {
    // El filtro por estado evita que dos registros simultáneos usen el mismo código.
    const claimed = await tx.printedTicket.updateMany({
      where: { code: { in: codes }, vendorId: seller.id, status: 'available' },
      data: { status: 'used', usedAt }
    });

    if (claimed.count !== codes.length) {
      throw new InputError('Alguno de los códigos acaba de ser registrado. Revisa la lista e intenta de nuevo.');
    }

    const result = await createPurchase(
      { ...payload, seller: seller.name, quantity: codes.length, depositAmount: codes.length * PRICE_PER_TICKET },
      tx
    );

    for (let i = 0; i < codes.length; i += 1) {
      await tx.printedTicket.update({
        where: { code: codes[i] },
        data: { transactionId: result.transactionId, raffleNumberId: result.raffleNumberIds[i] }
      });
    }

    return { ...result, codes };
  }, { timeout: 20000 });
}

export {
  InputError,
  createPurchase,
  createPrintedTickets,
  listPrintedTickets,
  registerPrintedSale,
  listPurchases,
  confirmPurchase,
  getDashboard,
  getSellerSummary,
  getCustomerHistory,
  getSellerTicket,
  sellerOwnsProof,
  findSellerByToken,
  getSellerById,
  listSellers,
  createSeller,
  regenerateSellerToken
};
