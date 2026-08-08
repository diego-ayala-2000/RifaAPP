const { put } = require('@vercel/blob');
const { createPurchase } = require('../lib/db');

async function uploadProof(payload) {
  if (!payload?.proofBase64) {
    return null;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('Falta BLOB_READ_WRITE_TOKEN en las variables de entorno de Vercel.');
  }

  const originalName = payload.proofName || 'deposit-proof';
  const extension = originalName.includes('.') ? originalName.split('.').pop() : 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const contentType = payload.proofType || 'application/octet-stream';

  const blob = await put(`proofs/${fileName}`, Buffer.from(payload.proofBase64, 'base64'), {
    access: 'public',
    contentType
  });

  return blob.url;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const payload = req.body || {};
    const proofUrl = await uploadProof(payload);
    const result = await createPurchase({
      ...payload,
      proofUrl
    });

    return res.status(200).json({
      success: true,
      message: 'Compra recibida correctamente y guardada',
      data: result
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      error: error.message || 'No se pudo guardar la compra'
    });
  }
};
