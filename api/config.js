import { getRaffle } from '../lib/raffles.js';

// Datos públicos de la rifa de este despliegue (nombre, precio, premios, datos de pago).
export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
    return res.status(200).json(getRaffle());
  } catch (error) {
    console.error(error);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: 'No se pudo cargar la configuración de la rifa.' });
  }
}
