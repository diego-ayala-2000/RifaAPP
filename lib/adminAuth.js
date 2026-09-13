class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = 401;
  }
}

// La clave puede llegar por header (x-admin-key) o en la query del enlace (?k=...).
function getProvidedKey(req) {
  const header = req.headers['x-admin-key'] || req.headers['x-admin-password'];
  if (header) return String(header);

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    return url.searchParams.get('k') || url.searchParams.get('key') || '';
  } catch (error) {
    return '';
  }
}

function assertAdmin(req) {
  const expected = process.env.ADMIN_ACCESS_KEY || process.env.ADMIN_PASSWORD;

  if (!expected) {
    throw new Error('ADMIN_ACCESS_KEY no está configurada en el servidor.');
  }

  const provided = getProvidedKey(req);

  if (!provided || provided !== expected) {
    throw new AuthError('Este enlace de administración no es válido.');
  }
}

export { AuthError, assertAdmin };
