class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = 401;
  }
}

function assertAdmin(req) {
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    throw new Error('ADMIN_PASSWORD no está configurada en el servidor.');
  }

  const provided = req.headers['x-admin-password'];

  if (!provided || provided !== expected) {
    throw new AuthError('Contraseña de administrador incorrecta.');
  }
}

export { AuthError, assertAdmin };
