import { requireSeller } from '../../lib/sellerAuth.js';
import { getSellerTicket } from '../../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const seller = await requireSeller(req);

    const id = typeof req.query.id === 'string' ? req.query.id : '';
    const ticket = await getSellerTicket(seller.name, id);

    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Esa venta no pertenece a tus ventas.' });
    }

    return res.status(200).json({ success: true, ...ticket });
  } catch (error) {
    console.error(error);

    const statusCode = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    const errorMessage = statusCode < 500 ? error.message : 'No se pudo generar el ticket.';

    return res.status(statusCode).json({ success: false, error: errorMessage });
  }
}
