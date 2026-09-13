import { assertAdmin } from '../../lib/adminAuth.js';
import { listSellers, createSeller, regenerateSellerToken } from '../../lib/db.js';

function readBody(req) {
  if (typeof req.body === 'string') {
    try {
      return req.body ? JSON.parse(req.body) : {};
    } catch (error) {
      const parseError = new Error('El contenido enviado no es JSON válido.');
      parseError.statusCode = 400;
      throw parseError;
    }
  }
  return req.body || {};
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    assertAdmin(req);

    if (req.method === 'GET') {
      const data = await listSellers();
      return res.status(200).json({ success: true, data });
    }

    if (req.method === 'POST') {
      const body = readBody(req);
      const data = await createSeller(body.name);
      return res.status(201).json({ success: true, data });
    }

    if (req.method === 'PATCH') {
      const body = readBody(req);
      const data = await regenerateSellerToken(body.id);
      return res.status(200).json({ success: true, data });
    }

    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error(error);

    const statusCode = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    const errorMessage = statusCode < 500 ? error.message : 'No se pudo procesar la solicitud de vendedores.';

    return res.status(statusCode).json({ success: false, error: errorMessage });
  }
}
