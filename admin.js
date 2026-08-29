const STORAGE_KEY = 'rifaAdminPassword';

const adminBarForm = document.getElementById('adminBarForm');
const adminBarPassword = document.getElementById('adminBarPassword');
const adminBarError = document.getElementById('adminBarError');
const adminPanel = document.getElementById('adminPanel');

const tabButtons = document.querySelectorAll('.tab-btn');
const confirmView = document.getElementById('confirmView');
const dashboardView = document.getElementById('dashboardView');

const refreshBtn = document.getElementById('refreshBtn');
const refreshDashboardBtn = document.getElementById('refreshDashboardBtn');

const pendingTable = document.getElementById('pendingTable');
const pendingBody = document.getElementById('pendingBody');
const pendingCount = document.getElementById('pendingCount');
const pendingEmptyMessage = document.getElementById('pendingEmptyMessage');

const statTotalPurchases = document.getElementById('statTotalPurchases');
const statTotalCustomers = document.getElementById('statTotalCustomers');
const statConfirmedAmount = document.getElementById('statConfirmedAmount');
const statPendingAmount = document.getElementById('statPendingAmount');
const raffleNumbersBody = document.getElementById('raffleNumbersBody');
const raffleEmptyMessage = document.getElementById('raffleEmptyMessage');

let adminPassword = sessionStorage.getItem(STORAGE_KEY) || '';
let latestPurchases = [];

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

function formatAmount(amount) {
  return `$${Number(amount).toLocaleString('es-CL')}`;
}

function formatDate(value) {
  return new Date(value).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
}

async function fetchPurchases() {
  const response = await fetch('/api/admin/purchases', {
    headers: { 'x-admin-password': adminPassword }
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || 'No se pudo obtener la lista de compras.');
  }

  return result.data || [];
}

function renderConfirmView(purchases) {
  const pending = purchases.filter((purchase) => purchase.status !== 'approved');

  pendingCount.textContent = `(${pending.length})`;

  pendingBody.innerHTML = pending.map((purchase) => `
    <tr data-id="${purchase.id}">
      <td>
        <strong>${escapeHtml(purchase.name)}</strong><br />
        <span class="muted-text">${escapeHtml(purchase.email)} · ${escapeHtml(purchase.phone)}</span>
      </td>
      <td>${escapeHtml(purchase.seller)}</td>
      <td>${purchase.quantity}</td>
      <td>${formatAmount(purchase.amount)}</td>
      <td>${purchase.raffleNumbers.join(', ')}</td>
      <td>${formatDate(purchase.submittedAt)}</td>
      <td>${purchase.proofUrl ? `<button type="button" class="copy-btn view-proof-btn" data-url="${escapeHtml(purchase.proofUrl)}">Ver</button>` : '—'}</td>
      <td><button type="button" class="copy-btn confirm-btn" data-id="${purchase.id}">Confirmar</button></td>
    </tr>
  `).join('');

  pendingBody.querySelectorAll('.confirm-btn').forEach((btn) => {
    btn.addEventListener('click', () => handleConfirm(btn.dataset.id, btn));
  });

  pendingBody.querySelectorAll('.view-proof-btn').forEach((btn) => {
    btn.addEventListener('click', () => handleViewProof(btn.dataset.url, btn));
  });

  pendingEmptyMessage.hidden = pending.length !== 0;
}

function renderDashboardView(purchases) {
  const uniqueEmails = new Set(purchases.map((purchase) => purchase.email.toLowerCase()));
  const confirmedAmount = purchases
    .filter((purchase) => purchase.status === 'approved')
    .reduce((sum, purchase) => sum + purchase.amount, 0);
  const pendingAmount = purchases
    .filter((purchase) => purchase.status !== 'approved')
    .reduce((sum, purchase) => sum + purchase.amount, 0);

  statTotalPurchases.textContent = purchases.length;
  statTotalCustomers.textContent = uniqueEmails.size;
  statConfirmedAmount.textContent = formatAmount(confirmedAmount);
  statPendingAmount.textContent = formatAmount(pendingAmount);

  const numberRows = purchases
    .flatMap((purchase) => purchase.raffleNumbers.map((number) => ({
      number,
      name: purchase.name,
      status: purchase.status
    })))
    .sort((a, b) => a.number - b.number);

  raffleNumbersBody.innerHTML = numberRows.map((row) => `
    <tr>
      <td>${row.number}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${row.status === 'approved' ? 'Confirmado' : 'Pendiente'}</td>
    </tr>
  `).join('');

  raffleEmptyMessage.hidden = numberRows.length !== 0;
}

function renderAll(purchases) {
  latestPurchases = purchases;
  renderConfirmView(purchases);
  renderDashboardView(purchases);
}

async function tryLoad() {
  try {
    const purchases = await fetchPurchases();
    renderAll(purchases);
    return true;
  } catch (error) {
    adminBarError.textContent = error.message;
    return false;
  }
}

async function handleViewProof(url, button) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Cargando...';

  try {
    const response = await fetch(`/api/admin/proof?url=${encodeURIComponent(url)}`, {
      headers: { 'x-admin-password': adminPassword }
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'No se pudo obtener el comprobante.');
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, '_blank', 'noopener');
  } catch (error) {
    window.alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function handleConfirm(id, button) {
  button.disabled = true;
  button.textContent = 'Confirmando...';

  try {
    const response = await fetch('/api/admin/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': adminPassword
      },
      body: JSON.stringify({ transactionId: id })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || 'No se pudo confirmar la compra.');
    }

    await tryLoad();
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Confirmar';
    window.alert(error.message);
  }
}

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    const tab = btn.dataset.tab;
    confirmView.hidden = tab !== 'confirm';
    dashboardView.hidden = tab !== 'dashboard';
  });
});

refreshBtn.addEventListener('click', tryLoad);
refreshDashboardBtn.addEventListener('click', tryLoad);

adminBarForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const value = adminBarPassword.value.trim();
  if (!value) return;

  adminPassword = value;
  adminBarError.textContent = '';

  const ok = await tryLoad();

  if (ok) {
    sessionStorage.setItem(STORAGE_KEY, adminPassword);
    adminPanel.hidden = false;
    adminBarPassword.value = '';
  }
});

if (adminPassword) {
  tryLoad().then((ok) => {
    if (ok) {
      adminPanel.hidden = false;
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
      adminPassword = '';
    }
  });
}
