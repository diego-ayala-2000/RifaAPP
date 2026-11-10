import { registerSeller, recoverSellerLink } from '../../lib/db.js';
import { getRaffle } from '../../lib/raffles.js';

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

// Inscripción de vendedores y recuperación de su enlace (inscripcion.html):
//   POST { action: 'signup', name, phone, rut }  → crea el vendedor y devuelve su token
//   POST { action: 'recover', phone, rut }       → devuelve el token si los datos coinciden
// Solo funciona en las rifas con sellerSignup activo.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    if (!getRaffle().sellerSignup) {
      return res.status(404).json({ success: false, error: 'La inscripción de vendedores no está habilitada en esta rifa.' });
    }

    const body = readBody(req);

    if (body.action === 'signup') {
      const data = await registerSeller(body);
      return res.status(data.alreadyRegistered ? 200 : 201).json({ success: true, data });
    }

    if (body.action === 'recover') {
      const data = await recoverSellerLink(body);
      return res.status(200).json({ success: true, data });
    }

    return res.status(400).json({ success: false, error: 'Acción no válida.' });
  } catch (error) {
    console.error(error);

    const statusCode = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    const errorMessage = statusCode < 500 ? error.message : 'No se pudo procesar la solicitud. Intenta nuevamente.';

    return res.status(statusCode).json({ success: false, error: errorMessage });
  }
}
