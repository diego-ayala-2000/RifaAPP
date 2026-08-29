import { assertAdmin } from '../../lib/adminAuth.js';
import { confirmPurchase } from '../../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    assertAdmin(req);

    let payload;

    if (typeof req.body === 'string') {
      try {
        payload = req.body ? JSON.parse(req.body) : {};
      } catch (parseError) {
        return res.status(400).json({ success: false, error: 'El contenido enviado no es JSON válido.' });
      }
    } else {
      payload = req.body || {};
    }

    const result = await confirmPurchase(payload.transactionId);

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error(error);

    const statusCode = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    const errorMessage = statusCode < 500 ? error.message : 'No se pudo confirmar la compra.';

    return res.status(statusCode).json({ success: false, error: errorMessage });
  }
}
