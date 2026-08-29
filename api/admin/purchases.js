import { assertAdmin } from '../../lib/adminAuth.js';
import { listPurchases } from '../../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    assertAdmin(req);

    const purchases = await listPurchases();

    return res.status(200).json({ success: true, data: purchases });
  } catch (error) {
    console.error(error);

    const statusCode = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    const errorMessage = statusCode < 500 ? error.message : 'No se pudo obtener la lista de compras.';

    return res.status(statusCode).json({ success: false, error: errorMessage });
  }
}
