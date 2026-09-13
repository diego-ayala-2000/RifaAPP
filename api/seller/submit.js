import { readFile } from 'node:fs/promises';
import { put } from '@vercel/blob';
import { IncomingForm } from 'formidable';
import { createPurchase, getSellerSummary, getCustomerHistory } from '../../lib/db.js';
import { requireSeller } from '../../lib/sellerAuth.js';

const MAX_PROOF_SIZE = 4 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf'
]);

function fieldValue(fields, key) {
  const value = fields[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseForm(req) {
  const form = new IncomingForm({ maxFileSize: MAX_PROOF_SIZE, keepExtensions: true });

  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) return reject(error);
      resolve({ fields, files });
    });
  });
}

function respondError(res, error, fallback) {
  console.error(error);

  if (error.code === 1016) {
    return res.status(400).json({ success: false, error: 'El comprobante es muy pesado. Debe ser menor a 4MB.' });
  }

  const statusCode = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
  const errorMessage = statusCode < 500 ? error.message : fallback;

  return res.status(statusCode).json({ success: false, error: errorMessage });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // GET: valida el enlace y devuelve el nombre del vendedor + su historial de ventas.
  if (req.method === 'GET') {
    try {
      const seller = await requireSeller(req);
      const summary = await getSellerSummary(seller.name);
      return res.status(200).json({ success: true, ...summary });
    } catch (error) {
      return respondError(res, error, 'No se pudo cargar la información del vendedor.');
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const contentType = req.headers['content-type'] || '';

  if (!contentType.includes('multipart/form-data')) {
    return res.status(400).json({ success: false, error: 'Debes enviar el formulario con el comprobante adjunto.' });
  }

  try {
    const seller = await requireSeller(req);

    const { fields, files } = await parseForm(req);
    const proofFile = Array.isArray(files.proofFile) ? files.proofFile[0] : files.proofFile;

    if (!proofFile) {
      return res.status(400).json({ success: false, error: 'Debes adjuntar el comprobante de pago.' });
    }

    if (!ALLOWED_PROOF_TYPES.has(proofFile.mimetype)) {
      return res.status(400).json({ success: false, error: 'El comprobante debe ser una imagen o un PDF.' });
    }

    const fileBuffer = await readFile(proofFile.filepath);
    const blob = await put(`comprobantes/${Date.now()}-${proofFile.originalFilename || 'comprobante'}`, fileBuffer, {
      access: 'private',
      addRandomSuffix: true,
      contentType: proofFile.mimetype
    });

    const payload = {
      name: fieldValue(fields, 'name'),
      email: fieldValue(fields, 'email'),
      phone: fieldValue(fields, 'phone'),
      seller: seller.name, // se fuerza al vendedor del enlace, no al campo del formulario
      quantity: fieldValue(fields, 'quantity'),
      depositAmount: fieldValue(fields, 'depositAmount'),
      proofUrl: blob.url,
      proofName: proofFile.originalFilename || 'comprobante',
      proofType: proofFile.mimetype
    };

    const result = await createPurchase(payload);
    const [summary, history] = await Promise.all([
      getSellerSummary(seller.name),
      getCustomerHistory(payload.phone, result.transactionId)
    ]);

    return res.status(200).json({
      success: true,
      message: 'Venta registrada correctamente',
      data: result,
      summary,
      history
    });
  } catch (error) {
    return respondError(res, error, 'No se pudo registrar la venta. Intenta nuevamente.');
  }
}
