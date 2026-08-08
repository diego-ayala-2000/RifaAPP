const pricePerTicket = 1000;
const totalPrice = document.getElementById('totalPrice');
const ticketInputs = document.querySelectorAll('input[name="tickets"]');
const form = document.getElementById('purchaseForm');
const message = document.getElementById('message');
const proofInput = form?.querySelector('input[name="proof"]');

function updateTotal() {
  const selected = document.querySelector('input[name="tickets"]:checked');
  const quantity = Number(selected?.value || 1);
  totalPrice.textContent = `$${(quantity * pricePerTicket).toLocaleString('es-ES')}`;
}

ticketInputs.forEach((input) => input.addEventListener('change', updateTotal));

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result.split(',')[1] || reader.result;
        resolve(base64);
      } else {
        reject(new Error('No se pudo leer el archivo.'));
      }
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const data = new FormData(form);
  const name = data.get('name')?.toString().trim() || 'Comprador';
  const seller = data.get('seller')?.toString().trim() || 'No registrado';
  const quantity = document.querySelector('input[name="tickets"]:checked')?.value || '1';
  const amount = data.get('depositAmount')?.toString() || '0';
  const proofFile = proofInput?.files?.[0];
  const proofBase64 = proofFile ? await readFileAsBase64(proofFile) : null;
  const payload = {
    name,
    email: data.get('email')?.toString().trim() || '',
    phone: data.get('phone')?.toString().trim() || '',
    seller,
    quantity: Number(quantity),
    depositAmount: Number(amount),
    proofBase64,
    proofName: proofFile?.name || null,
    proofType: proofFile?.type || null,
    submittedAt: new Date().toISOString()
  };

  message.style.display = 'block';
  message.innerHTML = 'Enviando tu compra...';

  try {
    const response = await fetch('/api/submit-purchase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'No se pudo procesar la compra.');
    }

    message.innerHTML = `Gracias, ${name}. Tu compra de ${quantity} rifa(s) fue recibida correctamente. El comprobante por $${Number(amount).toLocaleString('es-ES')} quedó registrado para revisión. Vendida por ${seller}.`;
    form.reset();
    updateTotal();
  } catch (error) {
    message.innerHTML = `No se pudo enviar la compra. ${error.message}`;
  }
});

updateTotal();
