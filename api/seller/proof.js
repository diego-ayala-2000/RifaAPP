import { get } from '@vercel/blob';
import { requireSeller } from '../../lib/sellerAuth.js';
import { sellerOwnsProof } from '../../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const seller = await requireSeller(req);

    const url = typeof req.query.url === 'string' ? req.query.url : '';

    if (!url) {
      return res.status(400).json({ success: false, error: 'Falta el parámetro url.' });
    }

    const owns = await sellerOwnsProof(seller.name, url);

    if (!owns) {
      return res.status(403).json({ success: false, error: 'Ese comprobante no pertenece a tus ventas.' });
    }

    const result = await get(url, { access: 'private' });

    if (!result || !result.stream) {
      return res.status(404).json({ success: false, error: 'Comprobante no encontrado.' });
    }

    const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());

    res.setHeader('Content-Type', result.blob.contentType || 'application/octet-stream');
    return res.status(200).send(buffer);
  } catch (error) {
    console.error(error);

    const statusCode = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    const errorMessage = statusCode < 500 ? error.message : 'No se pudo obtener el comprobante.';

    return res.status(statusCode).json({ success: false, error: errorMessage });
  }
}
