import { findSellerByToken } from './db.js';

class SellerAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SellerAuthError';
    this.statusCode = 401;
  }
}

// El token del vendedor llega por header (x-seller-token) o en la query del enlace (?t=...).
function getToken(req) {
  const header = req.headers['x-seller-token'] || req.headers['x-seller-key'];
  if (header) return String(header);

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    return url.searchParams.get('t') || url.searchParams.get('k') || '';
  } catch (error) {
    return '';
  }
}

// Devuelve el vendedor { id, name, token } asociado al token, o lanza 401.
async function requireSeller(req) {
  const seller = await findSellerByToken(getToken(req));

  if (!seller) {
    throw new SellerAuthError('Este enlace de vendedor no es válido.');
  }

  return seller;
}

export { SellerAuthError, requireSeller };
