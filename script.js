const pricePerTicket = 2500;
const totalPrice = document.getElementById('totalPrice');
const ticketInputs = document.querySelectorAll('input[name="tickets"]');
const form = document.getElementById('purchaseForm');
const message = document.getElementById('message');
const depositInput = document.getElementById('depositAmount');
const depositHint = document.getElementById('depositHint');
const copyTransferBtn = document.getElementById('copyTransferBtn');
const copyFeedback = document.getElementById('copyFeedback');
const proofFileInput = document.getElementById('proofFile');
const MAX_PROOF_SIZE = 4 * 1024 * 1024;
const transferAmount = document.getElementById('transferAmount');
const mpAmount = document.getElementById('mpAmount');
const adminBarForm = document.getElementById('adminBarForm');
const adminBarPassword = document.getElementById('adminBarPassword');
const adminBarError = document.getElementById('adminBarError');

function setMessage(text, type = 'info') {
  if (!message) return;
  message.className = `message ${type}`;
  message.style.display = 'block';
  message.innerHTML = text;
}

function getSelectedQuantity() {
  const selected = document.querySelector('input[name="tickets"]:checked');
  return Number(selected?.value || 1);
}

function updateTotal() {
  const quantity = getSelectedQuantity();
  const total = quantity * pricePerTicket;

  if (totalPrice) {
    totalPrice.textContent = `$${total.toLocaleString('es-ES')}`;
  }

  if (transferAmount) {
    transferAmount.textContent = `$${total.toLocaleString('es-ES')}`;
  }

  if (mpAmount) {
    mpAmount.textContent = `$${total.toLocaleString('es-ES')}`;
  }

  if (depositInput && !depositInput.dataset.userEdited) {
    depositInput.value = total;
  }

  if (depositHint) {
    const currentValue = Number(depositInput?.value || 0);
    const isMatch = currentValue === total;

    depositHint.classList.toggle('is-valid', isMatch);
    depositHint.textContent = isMatch
      ? `Monto correcto: $${total.toLocaleString('es-ES')}. El pago coincide con tu selección.`
      : `Monto sugerido: $${total.toLocaleString('es-ES')}. Debe coincidir con el total elegido.`;
  }
}

ticketInputs.forEach((input) => {
  input.addEventListener('change', () => {
    depositInput.dataset.userEdited = 'false';
    updateTotal();
  });
});

if (depositInput) {
  depositInput.addEventListener('input', () => {
    depositInput.dataset.userEdited = 'true';
    const quantity = getSelectedQuantity();
    const total = quantity * pricePerTicket;
    const currentValue = Number(depositInput.value || 0);

    depositHint.classList.toggle('is-valid', currentValue === total);
    depositHint.textContent = currentValue === total
      ? `Monto correcto: $${total.toLocaleString('es-ES')}. El pago coincide con tu selección.`
      : `Monto ingresado: $${currentValue.toLocaleString('es-ES')}. Debe ser $${total.toLocaleString('es-ES')}.`;
  });
}

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const name = data.get('name')?.toString().trim() || 'Comprador';
    const seller = data.get('seller')?.toString().trim() || 'No registrado';
    const quantity = getSelectedQuantity();
    const amount = Number(data.get('depositAmount') || 0);
    const totalExpected = quantity * pricePerTicket;
    const proofFile = proofFileInput?.files?.[0];

    if (amount !== totalExpected) {
      setMessage(`El monto ingresado debe ser $${totalExpected.toLocaleString('es-ES')} para ${quantity} rifa(s).`, 'error');
      return;
    }

    if (!proofFile) {
      setMessage('Debes adjuntar el comprobante de pago.', 'error');
      return;
    }

    if (proofFile.size > MAX_PROOF_SIZE) {
      setMessage('El comprobante es muy pesado. Debe ser menor a 4MB.', 'error');
      return;
    }

    setMessage('Enviando tu compra...', 'info');

    try {
      const payload = new FormData();
      payload.set('name', name);
      payload.set('email', data.get('email')?.toString().trim() || '');
      payload.set('phone', data.get('phone')?.toString().trim() || '');
      payload.set('seller', seller);
      payload.set('quantity', String(quantity));
      payload.set('depositAmount', String(amount));
      payload.set('proofFile', proofFile);

      const response = await fetch('/api/submit-purchase', {
        method: 'POST',
        body: payload
      });

      let result = {};
      let responseText = '';

      try {
        responseText = await response.text();
        result = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        result = { error: responseText || `Respuesta inesperada del servidor (${response.status}).` };
      }

      if (!response.ok) {
        throw new Error(result.error || result.message || responseText || `No se pudo procesar la compra (${response.status}).`);
      }

      setMessage(
        `Gracias, ${name}. Tu compra de ${quantity} rifa(s) fue recibida correctamente. El pago de $${amount.toLocaleString('es-ES')} quedó registrado para revisión. Vendida por ${seller}.`,
        'success'
      );

      form.reset();
      depositInput.dataset.userEdited = 'false';
      updateTotal();
    } catch (error) {
      setMessage(`No se pudo enviar la compra. ${error.message}`, 'error');
    }
  });
}

if (copyTransferBtn) {
  copyTransferBtn.addEventListener('click', async () => {
    const fields = document.querySelectorAll('#transferencia [data-copy-field]');
    const lines = Array.from(fields).map((field) => field.textContent.trim());
    const text = lines.join('\n');

    try {
      await navigator.clipboard.writeText(text);
      copyFeedback.textContent = '¡Datos copiados!';
    } catch (error) {
      copyFeedback.textContent = 'No se pudo copiar. Copia los datos manualmente.';
    }

    setTimeout(() => {
      copyFeedback.textContent = '';
    }, 3000);
  });
}

if (adminBarForm) {
  adminBarForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const value = adminBarPassword.value.trim();
    if (!value) return;

    adminBarError.textContent = '';

    try {
      const response = await fetch('/api/admin/purchases', {
        headers: { 'x-admin-password': value }
      });

      if (!response.ok) {
        throw new Error();
      }

      sessionStorage.setItem('rifaAdminPassword', value);
      window.location.href = 'admin.html';
    } catch (error) {
      adminBarError.textContent = 'Contraseña incorrecta.';
    }
  });
}

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  document.querySelectorAll('.card').forEach((card) => {
    card.classList.add('reveal');
    revealObserver.observe(card);
  });
}

updateTotal();
