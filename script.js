let pricePerTicket = 0;
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

const PRIZE_MEDALS = [
  { medal: '🥇', className: 'prize-card-gold' },
  { medal: '🥈', className: 'prize-card-silver' },
  { medal: '🥉', className: 'prize-card-bronze' }
];

function prizeRank(position) {
  if (position === 1) return '1er premio';
  if (position === 2) return '2do premio';
  if (position === 3) return '3er premio';
  return `${position}° premio`;
}

function renderPrizes(prizes, ranked) {
  const grid = document.getElementById('prizeGrid');
  if (!grid) return;

  grid.innerHTML = '';
  prizes.forEach((prize, index) => {
    const style = (ranked && PRIZE_MEDALS[index]) || { medal: '🎁', className: '' };
    const card = document.createElement('div');
    card.className = `prize-card ${style.className}`.trim();

    const medal = document.createElement('span');
    medal.className = 'prize-medal';
    medal.textContent = style.medal;

    const rank = document.createElement('span');
    rank.className = 'prize-rank';
    rank.textContent = prizeRank(index + 1);

    const name = document.createElement('p');
    name.className = 'prize-name';
    name.textContent = prize;

    if (ranked) card.append(medal, rank, name);
    else card.append(medal, name);
    grid.append(card);
  });
}

// Numera las opciones de pago visibles ("Opción 1 · ...") solo si hay más de una.
function labelPaymentOptions() {
  const options = Array.from(document.querySelectorAll('#pago .payment-option')).filter((option) => !option.hidden);
  const numbered = options.length > 1;

  options.forEach((option, index) => {
    const label = option.querySelector('.option-label');
    if (!label) return;
    const base = label.dataset.base || label.textContent;
    label.dataset.base = base;
    label.textContent = numbered ? `Opción ${index + 1} · ${base}` : base;
  });

  document.querySelectorAll('.payment-choice').forEach((el) => {
    el.textContent = numbered ? ` (opción 1 o ${options.length})` : '';
  });

  const pending = document.getElementById('paymentPending');
  if (pending) pending.hidden = options.length > 0;
}

function applyRaffle(raffle) {
  pricePerTicket = raffle.price;
  renderPrizes(raffle.prizes || [], raffle.prizesRanked !== false);
  labelPaymentOptions();

  const commonFundLink = document.getElementById('commonFundLink');
  if (commonFundLink && raffle.commonFundWhatsapp) {
    commonFundLink.href = `https://wa.me/${raffle.commonFundWhatsapp}?text=${encodeURIComponent('Hola, mi nombre es: ')}`;
  }

  const singlePath = document.getElementById('singlePath');
  if (singlePath) singlePath.hidden = Boolean(raffle.commonFundWhatsapp);

  const contactLink = document.getElementById('contactLink');
  if (contactLink && raffle.contactEmail) {
    contactLink.href = `mailto:${raffle.contactEmail}`;
  }

  updateTotal();
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

window.raffleReady.then(applyRaffle);
