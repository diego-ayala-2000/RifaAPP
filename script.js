const pricePerTicket = 2000;
const totalPrice = document.getElementById('totalPrice');
const ticketInputs = document.querySelectorAll('input[name="tickets"]');
const customQty = document.getElementById('customQty');
const copyTransferBtn = document.getElementById('copyTransferBtn');
const copyFeedback = document.getElementById('copyFeedback');
const transferAmount = document.getElementById('transferAmount');
const mpAmount = document.getElementById('mpAmount');

function getSelectedQuantity() {
  if (customQty && customQty.value !== '') {
    const custom = Math.floor(Number(customQty.value));
    if (Number.isFinite(custom) && custom >= 1) return custom;
  }
  const selected = document.querySelector('input[name="tickets"]:checked');
  return Number(selected?.value || 1);
}

function updateTotal() {
  const quantity = getSelectedQuantity();
  const total = quantity * pricePerTicket;
  const formatted = `$${total.toLocaleString('es-ES')}`;

  if (totalPrice) {
    totalPrice.textContent = formatted;
  }

  if (transferAmount) {
    transferAmount.textContent = formatted;
  }

  if (mpAmount) {
    mpAmount.textContent = formatted;
  }
}

ticketInputs.forEach((input) => {
  input.addEventListener('change', () => {
    if (customQty) customQty.value = '';
    updateTotal();
  });
});

if (customQty) {
  customQty.addEventListener('input', () => {
    ticketInputs.forEach((input) => { input.checked = false; });
    updateTotal();
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
