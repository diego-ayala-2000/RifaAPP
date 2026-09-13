import { assertAdmin } from '../../lib/adminAuth.js';
import { getDashboard } from '../../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    assertAdmin(req);

    const data = await getDashboard();

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error(error);

    const statusCode = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    const errorMessage = statusCode < 500 ? error.message : 'No se pudo obtener el panel.';

    return res.status(statusCode).json({ success: false, error: errorMessage });
  }
}
