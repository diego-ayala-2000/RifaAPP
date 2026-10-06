// El enlace de administración lleva la clave en la URL: admin.html?k=...
const ADMIN_KEY =
  new URLSearchParams(location.search).get('k') ||
  new URLSearchParams(location.search).get('key') ||
  '';

const PRICE_PER_TICKET = 2000;
const RAFFLE_NAME = 'Rifa JMJ Corea 2027 · Parroquia San Pedro de Las Condes';

const accessDenied = document.getElementById('accessDenied');
const adminPanel = document.getElementById('adminPanel');

const tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
const confirmView = document.getElementById('confirmView');
const dashboardView = document.getElementById('dashboardView');
const registerView = document.getElementById('registerView');

const subtabButtons = document.querySelectorAll('.tab-btn[data-subtab]');
const subViews = {
  numbers: document.getElementById('numbersView'),
  transactions: document.getElementById('transactionsView'),
  vendors: document.getElementById('vendorsView'),
  customers: document.getElementById('customersView')
};

const refreshBtn = document.getElementById('refreshBtn');
const refreshDashboardBtn = document.getElementById('refreshDashboardBtn');

const pendingBody = document.getElementById('pendingBody');
const pendingCount = document.getElementById('pendingCount');
const pendingEmptyMessage = document.getElementById('pendingEmptyMessage');

const statNumbers = document.getElementById('statNumbers');
const statReserved = document.getElementById('statReserved');
const statSold = document.getElementById('statSold');
const statTransactions = document.getElementById('statTransactions');
const statPending = document.getElementById('statPending');
const statCustomers = document.getElementById('statCustomers');
const statVendors = document.getElementById('statVendors');
const statConfirmedAmount = document.getElementById('statConfirmedAmount');
const statPendingAmount = document.getElementById('statPendingAmount');

const integrityAlerts = document.getElementById('integrityAlerts');

const numbersBody = document.getElementById('numbersBody');
const numbersCount = document.getElementById('numbersCount');
const numbersEmptyMessage = document.getElementById('numbersEmptyMessage');
const numbersFilter = document.getElementById('numbersFilter');
const downloadNumbersBtn = document.getElementById('downloadNumbersBtn');

const transactionsBody = document.getElementById('transactionsBody');
const transactionsCount = document.getElementById('transactionsCount');
const vendorsBody = document.getElementById('vendorsBody');
const vendorsCount = document.getElementById('vendorsCount');
const vendorsEmptyMessage = document.getElementById('vendorsEmptyMessage');
const refreshSellersBtn = document.getElementById('refreshSellersBtn');
const createSellerForm = document.getElementById('createSellerForm');
const newSellerName = document.getElementById('newSellerName');
const createSellerMsg = document.getElementById('createSellerMsg');
const customersBody = document.getElementById('customersBody');
const customersCount = document.getElementById('customersCount');

const salesChart = document.getElementById('salesChart');
const salesChartEmpty = document.getElementById('salesChartEmpty');
const rankingAllBody = document.getElementById('rankingAllBody');
const rankingAllEmpty = document.getElementById('rankingAllEmpty');
const rankingWeekBody = document.getElementById('rankingWeekBody');
const rankingWeekEmpty = document.getElementById('rankingWeekEmpty');

const regForm = document.getElementById('regForm');
const regSeller = document.getElementById('regSeller');
const regName = document.getElementById('regName');
const regEmail = document.getElementById('regEmail');
const regPhone = document.getElementById('regPhone');
const regTicketInputs = document.querySelectorAll('input[name="regTickets"]');
const regCustomQty = document.getElementById('regCustomQty');
const regTotalPrice = document.getElementById('regTotalPrice');
const regDepositAmount = document.getElementById('regDepositAmount');
const regDepositHint = document.getElementById('regDepositHint');
const regProofFile = document.getElementById('regProofFile');
const regMessage = document.getElementById('regMessage');
const regResultPanel = document.getElementById('regResultPanel');
const regAssignedNumbers = document.getElementById('regAssignedNumbers');
const regWaMessage = document.getElementById('regWaMessage');
const regWaLink = document.getElementById('regWaLink');
const regCopyMessageBtn = document.getElementById('regCopyMessageBtn');
const regCopyFeedback = document.getElementById('regCopyFeedback');
const regNewSaleBtn = document.getElementById('regNewSaleBtn');

let latestPurchases = [];
let latestDashboard = null;

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

function formatAmount(amount) {
  return `$${Number(amount || 0).toLocaleString('es-CL')}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
}

function statusPill(status) {
  const isApproved = status === 'approved' || status === 'sold';
  const label = status === 'sold'
    ? 'Vendido'
    : status === 'reserved'
      ? 'Reservado'
      : status === 'approved'
        ? 'Confirmado'
        : 'Pendiente';
  return `<span class="pill ${isApproved ? 'pill-ok' : 'pill-wait'}">${label}</span>`;
}

function showAccessDenied() {
  if (adminPanel) adminPanel.hidden = true;
  if (accessDenied) accessDenied.hidden = false;
}

function showPanel() {
  if (accessDenied) accessDenied.hidden = true;
  if (adminPanel) adminPanel.hidden = false;
}

async function apiGet(path) {
  const response = await fetch(path, { headers: { 'x-admin-key': ADMIN_KEY } });

  if (response.status === 401) {
    showAccessDenied();
    throw new Error('unauthorized');
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || 'No se pudo obtener la información.');
  }

  return result.data;
}

// ---------- Confirmar compras ----------

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
      <td>${purchase.proofUrl ? `<button type="button" class="copy-btn view-proof-btn" data-url="${escapeHtml(purchase.proofUrl)}">Ver foto</button>` : '—'}</td>
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

async function handleViewProof(url, button) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Cargando...';

  try {
    const response = await fetch(`/api/admin/proof?url=${encodeURIComponent(url)}`, {
      headers: { 'x-admin-key': ADMIN_KEY }
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
  if (button) {
    button.disabled = true;
    button.textContent = 'Confirmando...';
  }

  try {
    const response = await fetch('/api/admin/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': ADMIN_KEY
      },
      body: JSON.stringify({ transactionId: id })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || 'No se pudo confirmar la compra.');
    }

    await loadAll();
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = 'Confirmar';
    }
    window.alert(error.message);
  }
}

// ---------- Dashboards ----------

function renderIntegrityAlerts(checks) {
  const issues = [];

  if (checks.duplicateNumbers.length) {
    issues.push(`Números duplicados: ${checks.duplicateNumbers.join(', ')}`);
  }
  if (checks.soldNotApproved.length) {
    issues.push(`Números marcados como vendidos con transacción sin confirmar: ${checks.soldNotApproved.join(', ')}`);
  }
  if (checks.approvedNotSold.length) {
    issues.push(`Transacción confirmada con números aún reservados: ${checks.approvedNotSold.join(', ')}`);
  }

  if (!issues.length) {
    integrityAlerts.hidden = true;
    integrityAlerts.innerHTML = '';
    return;
  }

  integrityAlerts.hidden = false;
  integrityAlerts.innerHTML = `
    <strong>⚠️ Revisar</strong>
    <ul>${issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join('')}</ul>
  `;
}

function renderNumbers(numbers) {
  const term = (numbersFilter.value || '').trim().toLowerCase();
  const filtered = term
    ? numbers.filter((row) =>
        String(row.number).includes(term) ||
        row.customer.toLowerCase().includes(term) ||
        row.seller.toLowerCase().includes(term))
    : numbers;

  numbersCount.textContent = term ? `(${filtered.length} de ${numbers.length})` : `(${numbers.length})`;

  numbersBody.innerHTML = filtered.map((row) => `
    <tr>
      <td><strong>${row.number}</strong></td>
      <td>${escapeHtml(row.customer)}<br /><span class="muted-text">${escapeHtml(row.email)}</span></td>
      <td>${escapeHtml(row.seller)}</td>
      <td>${statusPill(row.status)}</td>
      <td>#${row.transactionId}</td>
      <td>${row.soldAt ? formatDate(row.soldAt) : '—'}</td>
    </tr>
  `).join('');

  numbersEmptyMessage.hidden = filtered.length !== 0;
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadNumbersCsv() {
  const rows = latestDashboard?.numbers || [];

  if (!rows.length) {
    window.alert('No hay números asignados para exportar.');
    return;
  }

  const header = [
    'Número', 'Estado', 'Comprador', 'Correo', 'Teléfono',
    'Vendedor', 'Transacción', 'Estado transacción', 'Fecha registro', 'Fecha confirmación'
  ];

  const body = rows.map((row) => [
    row.number,
    row.status === 'sold' ? 'Vendido' : 'Reservado',
    row.customer,
    row.email,
    row.phone,
    row.seller,
    row.transactionId,
    row.transactionStatus === 'approved' ? 'Confirmada' : 'Pendiente',
    row.submittedAt ? new Date(row.submittedAt).toLocaleString('es-CL') : '',
    row.soldAt ? new Date(row.soldAt).toLocaleString('es-CL') : ''
  ].map(csvCell).join(';'));

  const csv = '﻿' + [header.join(';'), ...body].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `asignacion-numeros-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderTransactions(rows) {
  transactionsCount.textContent = `(${rows.length})`;
  transactionsBody.innerHTML = rows.map((row) => `
    <tr>
      <td>#${row.id}</td>
      <td>${escapeHtml(row.customer)}<br /><span class="muted-text">${escapeHtml(row.email)} · ${escapeHtml(row.phone)}</span></td>
      <td>${escapeHtml(row.seller)}</td>
      <td>${row.quantity}</td>
      <td>${row.numbersCount}</td>
      <td>${formatAmount(row.amount)}</td>
      <td>${statusPill(row.status)}</td>
      <td>${formatDate(row.submittedAt)}</td>
      <td>${row.proofUrl ? `<button type="button" class="copy-btn view-proof-btn" data-url="${escapeHtml(row.proofUrl)}">Ver foto</button>` : '—'}</td>
    </tr>
  `).join('');

  transactionsBody.querySelectorAll('.view-proof-btn').forEach((btn) => {
    btn.addEventListener('click', () => handleViewProof(btn.dataset.url, btn));
  });
}

function sellerLink(token) {
  return `${location.origin}/vendedor.html?t=${encodeURIComponent(token)}`;
}

function renderSellers(rows) {
  vendorsCount.textContent = `(${rows.length})`;

  vendorsBody.innerHTML = rows.map((row) => {
    const link = sellerLink(row.token);
    return `
    <tr>
      <td><strong>${escapeHtml(row.name)}</strong></td>
      <td>
        <div class="link-cell">
          <code class="seller-link">${escapeHtml(link)}</code>
          <button type="button" class="copy-btn mini copy-link-btn" data-link="${escapeHtml(link)}">Copiar</button>
        </div>
      </td>
      <td>${row.sales}${row.pending ? ` <span class="muted-text">(${row.pending} pend.)</span>` : ''}</td>
      <td>${row.rifas}${row.rifasApproved !== row.rifas ? ` <span class="muted-text">(${row.rifasApproved} conf.)</span>` : ''}</td>
      <td>${formatAmount(row.amount)}</td>
      <td>${formatAmount(row.amountApproved)}</td>
      <td><button type="button" class="copy-btn mini regen-btn" data-id="${row.id}" data-name="${escapeHtml(row.name)}">Regenerar</button></td>
    </tr>`;
  }).join('');

  vendorsEmptyMessage.hidden = rows.length !== 0;

  vendorsBody.querySelectorAll('.copy-link-btn').forEach((btn) => {
    btn.addEventListener('click', () => copyText(btn.dataset.link, btn));
  });

  vendorsBody.querySelectorAll('.regen-btn').forEach((btn) => {
    btn.addEventListener('click', () => handleRegenerate(btn.dataset.id, btn.dataset.name));
  });

  renderSellerOptions(rows);
}

function renderSellerOptions(rows) {
  if (!regSeller) return;
  const current = regSeller.value;
  regSeller.innerHTML =
    `<option value="" disabled${current ? '' : ' selected'}>Selecciona un vendedor</option>` +
    rows.map((row) => `<option value="${row.id}"${String(row.id) === current ? ' selected' : ''}>${escapeHtml(row.name)}</option>`).join('');
}

// ---------- Registrar venta por un vendedor ----------

function regSetMessage(text, type = 'info') {
  regMessage.className = `message ${type}`;
  regMessage.style.display = 'block';
  regMessage.textContent = text;
}

function regClearMessage() {
  regMessage.style.display = 'none';
  regMessage.textContent = '';
}

function regGetQuantity() {
  if (regCustomQty.value !== '') {
    const custom = Math.floor(Number(regCustomQty.value));
    if (Number.isFinite(custom) && custom >= 1) return custom;
  }
  const selected = document.querySelector('input[name="regTickets"]:checked');
  return Number(selected?.value || 1);
}

function regUpdateTotal() {
  const quantity = regGetQuantity();
  const total = quantity * PRICE_PER_TICKET;
  regTotalPrice.textContent = formatAmount(total);
  regDepositAmount.value = total;
  regDepositHint.textContent = `${formatAmount(total)} = ${quantity} ${quantity === 1 ? 'rifa' : 'rifas'} × ${formatAmount(PRICE_PER_TICKET)} (automático).`;
}

function regNormalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('56')) return digits;
  if (digits.length === 9) return `56${digits}`;
  return digits;
}

function regBuildMessage({ name, sellerName, quantity, amount, numbers, history }) {
  const past = history && Array.isArray(history.transactions) ? history.transactions : [];
  const word = (n) => (n === 1 ? 'rifa' : 'rifas');

  let msg =
    `¡Hola ${name}! 🎟️\n\n` +
    `¡Gracias por participar en la ${RAFFLE_NAME}!\n\n` +
    `Tu compra de ${quantity} ${word(quantity)} por ${formatAmount(amount)} quedó registrada con ${sellerName}.\n\n` +
    `🔢 ${past.length ? 'Tus números nuevos son' : 'Tus números son'}: ${numbers.join(', ')}\n\n`;

  if (past.length) {
    const lines = past.map((tx) => {
      const detail = tx.numbers && tx.numbers.length ? ` (n° ${tx.numbers.join(', ')})` : '';
      const date = new Date(tx.date).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
      return `• ${date}: ${tx.quantity} ${word(tx.quantity)}${detail}`;
    });
    const totalRifas = (history.totalRifas || 0) + quantity;
    msg += `📋 Compras anteriores:\n${lines.join('\n')}\n\nEn total llevas ${totalRifas} ${word(totalRifas)} en la rifa 🎉\n\n`;
  }

  msg +=
    `Guarda este mensaje. Tu participación se confirma una vez verificado el pago. ` +
    `El sorteo será en noviembre de 2026.\n\n` +
    `¡Mucha suerte! 🍀`;

  return msg;
}

async function handleRegisterSale(event) {
  event.preventDefault();

  const sellerId = regSeller.value;
  const sellerName = regSeller.options[regSeller.selectedIndex]?.text || '';
  const name = regName.value.trim();
  const email = regEmail.value.trim();
  const phoneRaw = regPhone.value.trim();
  const phone = phoneRaw.replace(/\D/g, '').replace(/^56(?=\d{9}$)/, '');
  const quantity = regGetQuantity();
  const amount = quantity * PRICE_PER_TICKET;
  const proofFile = regProofFile.files?.[0];

  if (!sellerId) return regSetMessage('Selecciona un vendedor.', 'error');
  if (!name || !email || !phoneRaw) return regSetMessage('Completa nombre, correo y teléfono del comprador.', 'error');
  if (phone.length !== 9) return regSetMessage('El teléfono del comprador debe tener 9 dígitos (ej. 912345678).', 'error');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) return regSetMessage('Cantidad de rifas inválida (1 a 1000).', 'error');
  if (!proofFile) return regSetMessage('Adjunta el comprobante de pago.', 'error');
  if (proofFile.size > 4 * 1024 * 1024) return regSetMessage('El comprobante debe ser menor a 4MB.', 'error');

  regSetMessage('Registrando la venta...', 'info');

  try {
    const payload = new FormData();
    payload.set('sellerId', sellerId);
    payload.set('name', name);
    payload.set('email', email);
    payload.set('phone', phone);
    payload.set('quantity', String(quantity));
    payload.set('depositAmount', String(amount));
    payload.set('proofFile', proofFile);

    const response = await fetch('/api/admin/register-sale', {
      method: 'POST',
      headers: { 'x-admin-key': ADMIN_KEY },
      body: payload
    });

    const result = await response.json().catch(() => ({}));

    if (response.status === 401) {
      showAccessDenied();
      return;
    }
    if (!response.ok) {
      throw new Error(result.error || 'No se pudo registrar la venta.');
    }

    const numbers = result.data?.raffleNumbers || [];
    const text = regBuildMessage({ name, sellerName, quantity, amount, numbers, history: result.history });

    regAssignedNumbers.textContent = numbers.join('  ·  ');
    regWaMessage.value = text;
    const phoneDigits = regNormalizePhone(phone);
    regWaLink.href = phoneDigits
      ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    regClearMessage();
    regResultPanel.hidden = false;
    regResultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    regForm.reset();
    regUpdateTotal();
    loadAll();
  } catch (error) {
    regSetMessage(error.message, 'error');
  }
}

async function copyText(text, button) {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = '¡Copiado!';
  } catch (error) {
    window.prompt('Copia el enlace:', text);
  }
  setTimeout(() => { button.textContent = original; }, 2000);
}

async function loadSellers(showError) {
  try {
    const rows = await apiGet('/api/admin/sellers');
    renderSellers(rows || []);
  } catch (error) {
    if (error.message === 'unauthorized') return;
    console.error('No se pudo cargar vendedores:', error);
    vendorsCount.textContent = '';
    vendorsBody.innerHTML = '';
    vendorsEmptyMessage.hidden = false;
    vendorsEmptyMessage.textContent = 'No se pudo cargar la lista de vendedores. Si acabas de agregar la función, falta aplicar la migración de la base de datos.';
    if (showError) window.alert(error.message);
  }
}

async function handleCreateSeller(event) {
  event.preventDefault();
  const name = newSellerName.value.trim();
  if (!name) return;

  createSellerMsg.className = 'message info';
  createSellerMsg.style.display = 'block';
  createSellerMsg.textContent = 'Creando vendedor...';

  try {
    const response = await fetch('/api/admin/sellers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
      body: JSON.stringify({ name })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No se pudo crear el vendedor.');

    createSellerMsg.className = 'message success';
    createSellerMsg.textContent = `Vendedor "${result.data.name}" creado. Copia su enlace desde la tabla.`;
    newSellerName.value = '';
    await Promise.all([loadSellers(), loadAll()]);
  } catch (error) {
    createSellerMsg.className = 'message error';
    createSellerMsg.textContent = error.message;
  }
}

async function handleRegenerate(id, name) {
  if (!window.confirm(`Regenerar el enlace de "${name}". El enlace anterior dejará de funcionar. ¿Continuar?`)) return;

  try {
    const response = await fetch('/api/admin/sellers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
      body: JSON.stringify({ id: Number(id) })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No se pudo regenerar el enlace.');
    await loadSellers();
  } catch (error) {
    window.alert(error.message);
  }
}

function renderCustomers(rows) {
  customersCount.textContent = `(${rows.length})`;
  customersBody.innerHTML = rows.map((row) => `
    <tr>
      <td><strong>${escapeHtml(row.name)}</strong></td>
      <td>${escapeHtml(row.email)}</td>
      <td>${escapeHtml(row.phone)}</td>
      <td>${row.transactions}</td>
      <td>${row.rifas}</td>
      <td>${formatAmount(row.amount)}</td>
      <td>${formatAmount(row.amountApproved)}</td>
    </tr>
  `).join('');
}

// ---------- Gráfico de ventas y ranking de vendedores ----------

const SVG_NS = 'http://www.w3.org/2000/svg';
const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Una fila por día desde la primera venta hasta hoy, con las rifas acumuladas.
function buildSalesSeries(transactions) {
  if (!transactions.length) return [];

  const byDay = new Map();
  let first = null;

  transactions.forEach((tx) => {
    const date = new Date(tx.submittedAt);
    const key = dayKey(date);
    const entry = byDay.get(key) || { total: 0, approved: 0 };
    entry.total += tx.quantity;
    if (tx.status === 'approved') entry.approved += tx.quantity;
    byDay.set(key, entry);
    if (!first || date < first) first = date;
  });

  const series = [];
  const today = startOfDay(new Date());
  let total = 0;
  let approved = 0;

  for (let day = startOfDay(first); day <= today; day.setDate(day.getDate() + 1)) {
    const entry = byDay.get(dayKey(day)) || { total: 0, approved: 0 };
    total += entry.total;
    approved += entry.approved;
    series.push({ date: new Date(day), added: entry.total, total, approved });
  }

  return series;
}

function niceStep(max, ticks) {
  const rough = Math.max(max, 1) / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 5, 10].find((m) => m * magnitude >= rough) * magnitude;
}

function svgEl(tag, attrs, parent) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  if (parent) parent.appendChild(el);
  return el;
}

function formatShortDate(date) {
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

function renderSalesChart(transactions) {
  const series = buildSalesSeries(transactions);

  salesChart.innerHTML = '';
  salesChartEmpty.hidden = series.length !== 0;
  if (!series.length) return;

  const W = Math.max(salesChart.clientWidth || 900, 320);
  const H = 260;
  const margin = { top: 14, right: 44, bottom: 28, left: 40 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;
  const n = series.length;

  const step = niceStep(series[n - 1].total, 4);
  const yMax = Math.max(step, Math.ceil(series[n - 1].total / step) * step);
  const x = (i) => margin.left + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v) => margin.top + plotH - (v / yMax) * plotH;

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}` }, salesChart);

  for (let v = 0; v <= yMax; v += step) {
    svgEl('line', { class: 'grid-line', x1: margin.left, x2: W - margin.right, y1: y(v), y2: y(v) }, svg);
    const label = svgEl('text', { class: 'axis-label', x: margin.left - 8, y: y(v) + 4, 'text-anchor': 'end' }, svg);
    label.textContent = v.toLocaleString('es-CL');
  }

  const labelCount = Math.min(n, Math.max(2, Math.floor(plotW / 90)));
  const labelIndexes = new Set();
  for (let k = 0; k < labelCount; k += 1) {
    labelIndexes.add(labelCount === 1 ? 0 : Math.round((k * (n - 1)) / (labelCount - 1)));
  }
  labelIndexes.forEach((i) => {
    const anchor = n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
    const label = svgEl('text', { class: 'axis-label', x: x(i), y: H - 8, 'text-anchor': anchor }, svg);
    label.textContent = formatShortDate(series[i].date);
  });

  const lines = [
    { key: 'total', color: 'var(--series-total)' },
    { key: 'approved', color: 'var(--series-approved)' }
  ];

  lines.forEach(({ key, color }) => {
    if (n === 1) {
      svgEl('circle', { cx: x(0), cy: y(series[0][key]), r: 4, fill: color }, svg);
      return;
    }
    const d = series.map((point, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(point[key]).toFixed(1)}`).join(' ');
    svgEl('path', { d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
  });

  // Etiquetas directas con el valor final de cada línea, separadas si quedan encimadas.
  const last = series[n - 1];
  let totalY = y(last.total) + 4;
  let approvedY = y(last.approved) + 4;
  if (approvedY - totalY < 14) {
    const mid = (totalY + approvedY) / 2;
    totalY = mid - 7;
    approvedY = mid + 7;
  }
  [[last.total, totalY], [last.approved, approvedY]].forEach(([value, ly]) => {
    const label = svgEl('text', { class: 'end-label', x: x(n - 1) + 8, y: ly }, svg);
    label.textContent = value.toLocaleString('es-CL');
  });

  // Capa de hover: línea guía, puntos y tooltip del día más cercano.
  const crosshair = svgEl('line', { class: 'crosshair', y1: margin.top, y2: margin.top + plotH, visibility: 'hidden' }, svg);
  const dots = lines.map(({ color }) =>
    svgEl('circle', { r: 4, fill: color, stroke: '#ffffff', 'stroke-width': 2, visibility: 'hidden' }, svg));
  const hitArea = svgEl('rect', { x: margin.left, y: margin.top, width: plotW, height: plotH, fill: 'transparent' }, svg);

  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  salesChart.appendChild(tooltip);

  const swatch = (color) => `<span class="legend-swatch" style="background:${color}"></span>`;

  function showPoint(event) {
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / W;
    const px = (event.clientX - rect.left) / scale;
    const i = n === 1 ? 0 : Math.min(n - 1, Math.max(0, Math.round(((px - margin.left) / plotW) * (n - 1))));
    const point = series[i];

    crosshair.setAttribute('x1', x(i));
    crosshair.setAttribute('x2', x(i));
    crosshair.setAttribute('visibility', 'visible');
    lines.forEach(({ key }, k) => {
      dots[k].setAttribute('cx', x(i));
      dots[k].setAttribute('cy', y(point[key]));
      dots[k].setAttribute('visibility', 'visible');
    });

    tooltip.innerHTML = `
      <strong>${point.date.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
      <div class="tooltip-row">${swatch('var(--series-total)')}Registradas: <strong>${point.total.toLocaleString('es-CL')}</strong></div>
      <div class="tooltip-row">${swatch('var(--series-approved)')}Confirmadas: <strong>${point.approved.toLocaleString('es-CL')}</strong></div>
      <div class="muted-text">+${point.added.toLocaleString('es-CL')} ese día</div>
    `;
    tooltip.hidden = false;

    const left = x(i) * scale;
    const width = tooltip.offsetWidth;
    tooltip.style.left = `${left + 12 + width > rect.width ? left - 12 - width : left + 12}px`;
  }

  function hidePoint() {
    crosshair.setAttribute('visibility', 'hidden');
    dots.forEach((dot) => dot.setAttribute('visibility', 'hidden'));
    tooltip.hidden = true;
  }

  hitArea.addEventListener('pointermove', showPoint);
  hitArea.addEventListener('pointerdown', showPoint);
  hitArea.addEventListener('pointerleave', hidePoint);
}

function buildRanking(transactions, since) {
  const bySeller = new Map();

  transactions.forEach((tx) => {
    if (since && new Date(tx.submittedAt) < since) return;
    const row = bySeller.get(tx.seller) || { name: tx.seller, rifas: 0, rifasApproved: 0, sales: 0, amount: 0 };
    row.rifas += tx.quantity;
    if (tx.status === 'approved') row.rifasApproved += tx.quantity;
    row.sales += 1;
    row.amount += Number(tx.amount || 0);
    bySeller.set(tx.seller, row);
  });

  return [...bySeller.values()]
    .sort((a, b) => b.rifas - a.rifas || b.amount - a.amount)
    .slice(0, 10);
}

function renderRanking(body, emptyMessage, rows) {
  body.innerHTML = rows.map((row, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(row.name)}</strong></td>
      <td>${row.rifas}${row.rifasApproved !== row.rifas ? ` <span class="muted-text">(${row.rifasApproved} conf.)</span>` : ''}</td>
      <td>${row.sales}</td>
      <td>${formatAmount(row.amount)}</td>
    </tr>
  `).join('');
  emptyMessage.hidden = rows.length !== 0;
}

function renderSalesInsights(transactions) {
  renderSalesChart(transactions);
  renderRanking(rankingAllBody, rankingAllEmpty, buildRanking(transactions));
  renderRanking(rankingWeekBody, rankingWeekEmpty, buildRanking(transactions, new Date(Date.now() - 7 * DAY_MS)));
}

function renderDashboard(dashboard) {
  const { totals, checks } = dashboard;

  statNumbers.textContent = totals.numbers;
  statReserved.textContent = totals.reserved;
  statSold.textContent = totals.sold;
  statTransactions.textContent = totals.transactions;
  statPending.textContent = totals.pendingTransactions;
  statCustomers.textContent = totals.customers;
  statVendors.textContent = totals.vendors;
  statConfirmedAmount.textContent = formatAmount(totals.amountApproved);
  statPendingAmount.textContent = formatAmount(totals.amountPending);

  renderIntegrityAlerts(checks);
  renderSalesInsights(dashboard.transactions);
  renderNumbers(dashboard.numbers);
  renderTransactions(dashboard.transactions);
  renderCustomers(dashboard.customers);
}

// ---------- Carga ----------

async function loadAll() {
  try {
    // Núcleo: confirmar compras + dashboards. Si algo falla aquí, no se abre el panel.
    const [purchases, dashboard] = await Promise.all([
      apiGet('/api/admin/purchases'),
      apiGet('/api/admin/dashboard')
    ]);

    latestPurchases = purchases || [];
    latestDashboard = dashboard || null;

    renderConfirmView(latestPurchases);
    if (latestDashboard) renderDashboard(latestDashboard);

    // Vendedores: si falla (p. ej. falta la migración), no bloquea el resto del panel.
    loadSellers();

    return true;
  } catch (error) {
    if (error.message !== 'unauthorized') {
      window.alert(error.message);
    }
    return false;
  }
}

// ---------- Navegación ----------

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    const tab = btn.dataset.tab;
    confirmView.hidden = tab !== 'confirm';
    dashboardView.hidden = tab !== 'dashboard';
    registerView.hidden = tab !== 'register';

    // El gráfico se dibuja al ancho real, que solo se conoce con la vista visible.
    if (tab === 'dashboard' && latestDashboard) renderSalesChart(latestDashboard.transactions);
  });
});

let chartResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(chartResizeTimer);
  chartResizeTimer = setTimeout(() => {
    if (!dashboardView.hidden && latestDashboard) renderSalesChart(latestDashboard.transactions);
  }, 150);
});

subtabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    subtabButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    const active = btn.dataset.subtab;
    Object.entries(subViews).forEach(([key, view]) => {
      if (view) view.hidden = key !== active;
    });
  });
});

if (numbersFilter) {
  numbersFilter.addEventListener('input', () => {
    if (latestDashboard) renderNumbers(latestDashboard.numbers);
  });
}

refreshBtn.addEventListener('click', loadAll);
refreshDashboardBtn.addEventListener('click', loadAll);
refreshSellersBtn.addEventListener('click', () => loadSellers(true));
createSellerForm.addEventListener('submit', handleCreateSeller);
downloadNumbersBtn.addEventListener('click', downloadNumbersCsv);

regForm.addEventListener('submit', handleRegisterSale);

regTicketInputs.forEach((input) => {
  input.addEventListener('change', () => {
    regCustomQty.value = '';
    regUpdateTotal();
  });
});

regCustomQty.addEventListener('input', () => {
  regTicketInputs.forEach((input) => { input.checked = false; });
  regUpdateTotal();
});

regCopyMessageBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(regWaMessage.value);
    regCopyFeedback.textContent = '¡Mensaje copiado!';
  } catch (error) {
    regWaMessage.focus();
    regWaMessage.select();
    regCopyFeedback.textContent = 'Copia el texto manualmente (Ctrl/Cmd + C).';
  }
  setTimeout(() => { regCopyFeedback.textContent = ''; }, 3000);
});

regNewSaleBtn.addEventListener('click', () => {
  regResultPanel.hidden = true;
  regClearMessage();
  regForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

regUpdateTotal();

if (!ADMIN_KEY) {
  showAccessDenied();
} else {
  loadAll().then((ok) => {
    if (ok) showPanel();
  });
}
