const signupDisabled = document.getElementById('signupDisabled');
const signupPanel = document.getElementById('signupPanel');
const tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
const signupForm = document.getElementById('signupForm');
const recoverForm = document.getElementById('recoverForm');
const message = document.getElementById('message');

const resultPanel = document.getElementById('resultPanel');
const resultTitle = document.getElementById('resultTitle');
const resultText = document.getElementById('resultText');
const sellerLinkEl = document.getElementById('sellerLink');
const openLink = document.getElementById('openLink');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const copyFeedback = document.getElementById('copyFeedback');

function setMessage(text, type = 'info') {
  message.className = `message ${type}`;
  message.style.display = 'block';
  message.textContent = text;
}

function clearMessage() {
  message.style.display = 'none';
  message.textContent = '';
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').replace(/^56(?=\d{9}$)/, '');
}

function sellerUrl(token) {
  return `${location.origin}/vendedor.html?t=${encodeURIComponent(token)}`;
}

function showResult({ name, token, alreadyRegistered }, mode) {
  const url = sellerUrl(token);

  if (mode === 'signup' && !alreadyRegistered) {
    resultTitle.textContent = '✅ ¡Listo, ya estás inscrito!';
    resultText.textContent = `${name}, este es tu enlace personal para registrar ventas:`;
  } else {
    resultTitle.textContent = '✅ Este es tu enlace';
    resultText.textContent = alreadyRegistered
      ? `${name}, ya estabas inscrito con estos datos. Tu enlace personal es:`
      : `${name}, tu enlace personal para registrar ventas es:`;
  }

  sellerLinkEl.textContent = url;
  openLink.href = url;
  resultPanel.hidden = false;
  resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function submit(form, mode) {
  const data = new FormData(form);
  const phone = normalizePhone(data.get('phone'));
  const rut = String(data.get('rut') || '').trim();
  const name = String(data.get('name') || '').trim();

  if (phone.length !== 9) {
    setMessage('El teléfono debe tener 9 dígitos (ej. 912345678).', 'error');
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  resultPanel.hidden = true;
  setMessage(mode === 'signup' ? 'Inscribiendo...' : 'Buscando tu enlace...', 'info');

  try {
    const response = await fetch('/api/seller/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: mode, name, phone, rut })
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || 'No se pudo procesar la solicitud. Intenta nuevamente.');
    }

    clearMessage();
    showResult(result.data, mode);
  } catch (error) {
    setMessage(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

signupForm.addEventListener('submit', (event) => {
  event.preventDefault();
  submit(signupForm, 'signup');
});

recoverForm.addEventListener('submit', (event) => {
  event.preventDefault();
  submit(recoverForm, 'recover');
});

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    signupForm.hidden = btn.dataset.tab !== 'signup';
    recoverForm.hidden = btn.dataset.tab !== 'recover';
    resultPanel.hidden = true;
    clearMessage();
  });
});

copyLinkBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(sellerLinkEl.textContent);
    copyFeedback.textContent = '¡Enlace copiado!';
  } catch (error) {
    copyFeedback.textContent = 'No se pudo copiar. Cópialo manualmente.';
  }
  setTimeout(() => {
    copyFeedback.textContent = '';
  }, 3000);
});

window.raffleReady.then((raffle) => {
  signupPanel.hidden = !raffle.sellerSignup;
  document.getElementById('howToSell').hidden = !raffle.sellerSignup;
  signupDisabled.hidden = Boolean(raffle.sellerSignup);
});
