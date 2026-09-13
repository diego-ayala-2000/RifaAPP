const PRICE_PER_TICKET = 2000;
const MAX_PROOF_SIZE = 4 * 1024 * 1024;
const RAFFLE_NAME = 'Rifa JMJ Corea 2027 · Parroquia San Pedro de Las Condes';

// Cada vendedor tiene su enlace personal con su token: vendedor.html?t=TOKEN
const SELLER_TOKEN =
  new URLSearchParams(location.search).get('t') ||
  new URLSearchParams(location.search).get('k') ||
  '';

const accessDenied = document.getElementById('accessDenied');
const sellerPanel = document.getElementById('sellerPanel');
const sellerGreeting = document.getElementById('sellerGreeting');
const sellerNameLabel = document.getElementById('sellerNameLabel');

const tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
const registerView = document.getElementById('registerView');
const salesView = document.getElementById('salesView');

const form = document.getElementById('sellForm');
const message = document.getElementById('message');
const ticketInputs = document.querySelectorAll('input[name="tickets"]');
const customQty = document.getElementById('customQty');
const totalPrice = document.getElementById('totalPrice');
const depositInput = document.getElementById('depositAmount');
const depositHint = document.getElementById('depositHint');
const proofFileInput = document.getElementById('proofFile');

const resultPanel = document.getElementById('resultPanel');
const assignedNumbers = document.getElementById('assignedNumbers');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const copyMessageFeedback = document.getElementById('copyMessageFeedback');
const newSaleBtn = document.getElementById('newSaleBtn');

let currentReceipt = null;

const refreshSalesBtn = document.getElementById('refreshSalesBtn');
const salesCount = document.getElementById('salesCount');
const salesBody = document.getElementById('salesBody');
const salesEmptyMessage = document.getElementById('salesEmptyMessage');
const statSales = document.getElementById('statSales');
const statRifas = document.getElementById('statRifas');
const statPending = document.getElementById('statPending');
const statAmount = document.getElementById('statAmount');
const statAmountApproved = document.getElementById('statAmountApproved');

let sellerName = '';

function setMessage(text, type = 'info') {
  if (!message) return;
  message.className = `message ${type}`;
  message.style.display = 'block';
  message.textContent = text;
}

function clearMessage() {
  if (!message) return;
  message.style.display = 'none';
  message.textContent = '';
}

function showAccessDenied() {
  if (sellerPanel) sellerPanel.hidden = true;
  if (accessDenied) accessDenied.hidden = false;
}

function showPanel() {
  if (accessDenied) accessDenied.hidden = true;
  if (sellerPanel) sellerPanel.hidden = false;
  updateTotal();
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
}

function statusPill(status) {
  const ok = status === 'approved';
  return `<span class="pill ${ok ? 'pill-ok' : 'pill-wait'}">${ok ? 'Confirmada' : 'Pendiente'}</span>`;
}

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
  const total = quantity * PRICE_PER_TICKET;

  if (totalPrice) {
    totalPrice.textContent = formatCurrency(total);
  }

  // El monto queda estrictamente ligado a la cantidad: no se puede editar a mano.
  if (depositInput) {
    depositInput.value = total;
  }

  if (depositHint) {
    depositHint.classList.add('is-valid');
    depositHint.textContent = `${formatCurrency(total)} = ${quantity} ${quantity === 1 ? 'rifa' : 'rifas'} × ${formatCurrency(PRICE_PER_TICKET)} (automático).`;
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

function formatShortDate(value) {
  return new Date(value).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function rifaWord(n) {
  return n === 1 ? 'rifa' : 'rifas';
}

// Ticket compacto (tamaño A6) con los mismos datos que antes se enviaban por WhatsApp:
// comprador, vendedor, cantidad, monto, números asignados e historial de compras.
function buildTicketPdf({ name, email, phone, seller, quantity, amount, numbers, submittedAt, history }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a6' });
  const margin = 8;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let y = margin + 2;

  const past = history && Array.isArray(history.transactions) ? history.transactions : [];
  const totalRifas = (history?.totalRifas || 0) + quantity;

  function ensureSpace(lines = 1, lineHeight = 4.6) {
    if (y + lines * lineHeight > pageHeight - margin) {
      doc.addPage();
      y = margin + 2;
    }
  }

  function center(text, size, style = 'normal') {
    ensureSpace();
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(0);
    doc.text(text, pageWidth / 2, y, { align: 'center', maxWidth: contentWidth });
    y += size * 0.42;
  }

  function dashedLine() {
    ensureSpace();
    doc.setDrawColor(160);
    doc.setLineDashPattern([0.8, 0.8], 0);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setLineDashPattern([], 0);
    y += 4;
  }

  function row(label, value) {
    if (!value) return;
    ensureSpace();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0);
    const labelText = `${label}: `;
    doc.text(labelText, margin, y);
    const labelWidth = doc.getTextWidth(labelText);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(String(value), contentWidth - labelWidth);
    doc.text(lines[0] || '', margin + labelWidth, y);
    y += 4.6;
    for (let i = 1; i < lines.length; i += 1) {
      ensureSpace();
      doc.text(lines[i], margin, y);
      y += 4.6;
    }
  }

  center(RAFFLE_NAME, 9, 'bold');
  y += 1;
  center('TICKET DE COMPRA', 11, 'bold');
  y += 2;
  dashedLine();

  row('Vendedor', seller);
  row('Fecha', formatDate(submittedAt || new Date()));
  dashedLine();

  row('Comprador', name);
  if (phone) row('Teléfono', `+56 ${phone}`);
  if (email) row('Correo', email);
  dashedLine();

  row('Cantidad', `${quantity} ${rifaWord(quantity)}`);
  row('Monto pagado', formatCurrency(amount));
  y += 1;

  ensureSpace();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0);
  doc.text('Números asignados:', margin, y);
  y += 4.6;
  doc.setFontSize(12);
  const numsText = doc.splitTextToSize(numbers.join('  ·  '), contentWidth);
  numsText.forEach((numsLine) => {
    ensureSpace(1, 6);
    doc.text(numsLine, margin, y);
    y += 6;
  });
  y += 1;
  dashedLine();

  if (past.length) {
    ensureSpace();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Compras anteriores:', margin, y);
    y += 4.6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    past.forEach((tx) => {
      const detail = tx.numbers && tx.numbers.length ? ` (n° ${tx.numbers.join(', ')})` : '';
      const lines = doc.splitTextToSize(
        `• ${formatShortDate(tx.date)}: ${tx.quantity} ${rifaWord(tx.quantity)}${detail}`,
        contentWidth
      );
      lines.forEach((historyLine) => {
        ensureSpace(1, 4);
        doc.text(historyLine, margin, y);
        y += 4;
      });
    });
    y += 1;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    ensureSpace();
    doc.text(`Total acumulado: ${totalRifas} ${rifaWord(totalRifas)}`, margin, y);
    y += 4.6;
    dashedLine();
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(110);
  const footer = doc.splitTextToSize(
    'Tu participación se confirma una vez verificado el pago. El sorteo será en noviembre de 2026. ¡Mucha suerte!',
    contentWidth
  );
  footer.forEach((footerLine) => {
    ensureSpace(1, 3.8);
    doc.text(footerLine, margin, y);
    y += 3.8;
  });
  doc.setTextColor(0);

  return doc;
}

function downloadTicket(doc, name) {
  const filename = `ticket-rifa-${String(name || 'comprador').replace(/\s+/g, '_').toLowerCase()}.pdf`;
  doc.save(filename);
}

function showResult({ name, email, phone, quantity, amount, numbers, history }) {
  assignedNumbers.textContent = numbers.join('  ·  ');

  const doc = buildTicketPdf({ name, email, phone, seller: sellerName, quantity, amount, numbers, history });
  currentReceipt = { doc, name };

  resultPanel.hidden = false;
  resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderSummary(summary) {
  if (!summary) return;

  sellerName = summary.seller || sellerName;
  if (sellerName) {
    sellerGreeting.textContent = `Hola, ${sellerName} 👋`;
    sellerNameLabel.textContent = sellerName;
  }

  const totals = summary.totals || {};
  statSales.textContent = totals.sales || 0;
  statRifas.textContent = totals.rifas || 0;
  statPending.textContent = totals.pending || 0;
  statAmount.textContent = formatCurrency(totals.amount);
  statAmountApproved.textContent = formatCurrency(totals.amountApproved);

  const rows = summary.transactions || [];
  salesCount.textContent = `(${rows.length})`;

  salesBody.innerHTML = rows.map((row) => `
    <tr>
      <td><strong>${escapeHtml(row.customer)}</strong></td>
      <td>${escapeHtml(row.email)}</td>
      <td>${escapeHtml(row.phone)}</td>
      <td>${row.quantity}</td>
      <td>${row.raffleNumbers.join(', ')}</td>
      <td>${formatCurrency(row.amount)}</td>
      <td>${statusPill(row.status)}</td>
      <td>${formatDate(row.submittedAt)}</td>
      <td>${row.proofUrl ? `<button type="button" class="copy-btn view-proof-btn" data-url="${escapeHtml(row.proofUrl)}">Ver foto</button>` : '—'}</td>
      <td><button type="button" class="copy-btn ticket-btn" data-id="${row.id}">📄 Ticket</button></td>
    </tr>
  `).join('');

  salesBody.querySelectorAll('.view-proof-btn').forEach((btn) => {
    btn.addEventListener('click', () => viewProof(btn.dataset.url, btn));
  });

  salesBody.querySelectorAll('.ticket-btn').forEach((btn) => {
    btn.addEventListener('click', () => downloadTicketForSale(btn.dataset.id, btn));
  });

  salesEmptyMessage.hidden = rows.length !== 0;
}

async function downloadTicketForSale(transactionId, button) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Generando...';

  try {
    const response = await fetch(`/api/seller/ticket?id=${encodeURIComponent(transactionId)}`, {
      headers: { 'x-seller-token': SELLER_TOKEN }
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || 'No se pudo generar el ticket.');
    }

    const { transaction, history } = result;
    const doc = buildTicketPdf({
      name: transaction.name,
      email: transaction.email,
      phone: transaction.phone,
      seller: transaction.seller,
      quantity: transaction.quantity,
      amount: transaction.amount,
      numbers: transaction.numbers,
      submittedAt: transaction.submittedAt,
      history
    });
    downloadTicket(doc, transaction.name);
  } catch (error) {
    window.alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function viewProof(url, button) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Cargando...';

  try {
    const response = await fetch(`/api/seller/proof?url=${encodeURIComponent(url)}`, {
      headers: { 'x-seller-token': SELLER_TOKEN }
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

async function loadSummary() {
  try {
    const response = await fetch('/api/seller/submit', {
      headers: { 'x-seller-token': SELLER_TOKEN }
    });

    if (response.status === 401) {
      showAccessDenied();
      return false;
    }

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || 'No se pudo cargar tu información.');
    }

    renderSummary(result);
    return true;
  } catch (error) {
    setMessage(error.message, 'error');
    return false;
  }
}

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const name = data.get('name')?.toString().trim() || '';
    const email = data.get('email')?.toString().trim() || '';
    const phoneRaw = data.get('phone')?.toString().trim() || '';
    const phone = phoneRaw.replace(/\D/g, '').replace(/^56(?=\d{9}$)/, '');
    const quantity = getSelectedQuantity();
    const proofFile = proofFileInput?.files?.[0];

    if (!name || !email || !phoneRaw) {
      setMessage('Completa nombre, correo y teléfono del comprador.', 'error');
      return;
    }

    if (phone.length !== 9) {
      setMessage('El teléfono del comprador debe tener 9 dígitos (ej. 912345678).', 'error');
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
      setMessage('Ingresa una cantidad de rifas válida (entre 1 y 1000).', 'error');
      return;
    }

    // El monto está estrictamente ligado a la cantidad.
    const amount = quantity * PRICE_PER_TICKET;

    if (!proofFile) {
      setMessage('Debes adjuntar el comprobante de pago.', 'error');
      return;
    }

    if (proofFile.size > MAX_PROOF_SIZE) {
      setMessage('El comprobante es muy pesado. Debe ser menor a 4MB.', 'error');
      return;
    }

    setMessage('Registrando la venta...', 'info');

    try {
      const payload = new FormData();
      payload.set('name', name);
      payload.set('email', email);
      payload.set('phone', phone);
      payload.set('quantity', String(quantity));
      payload.set('depositAmount', String(amount));
      payload.set('proofFile', proofFile);

      const response = await fetch('/api/seller/submit', {
        method: 'POST',
        headers: { 'x-seller-token': SELLER_TOKEN },
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

      if (response.status === 401) {
        clearMessage();
        showAccessDenied();
        return;
      }

      if (!response.ok) {
        throw new Error(result.error || result.message || `No se pudo registrar la venta (${response.status}).`);
      }

      const numbers = result.data?.raffleNumbers || [];

      clearMessage();
      showResult({ name, email, phone, quantity, amount, numbers, history: result.history });
      if (result.summary) renderSummary(result.summary);

      form.reset();
      updateTotal();
    } catch (error) {
      setMessage(`No se pudo registrar la venta. ${error.message}`, 'error');
    }
  });
}

if (downloadPdfBtn) {
  downloadPdfBtn.addEventListener('click', () => {
    if (!currentReceipt) return;

    try {
      downloadTicket(currentReceipt.doc, currentReceipt.name);
      copyMessageFeedback.textContent = '¡Ticket descargado!';
    } catch (error) {
      copyMessageFeedback.textContent = 'No se pudo generar el PDF.';
    }

    setTimeout(() => {
      copyMessageFeedback.textContent = '';
    }, 3000);
  });
}

if (newSaleBtn) {
  newSaleBtn.addEventListener('click', () => {
    resultPanel.hidden = true;
    clearMessage();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    const tab = btn.dataset.tab;
    registerView.hidden = tab !== 'register';
    salesView.hidden = tab !== 'sales';
  });
});

if (refreshSalesBtn) {
  refreshSalesBtn.addEventListener('click', loadSummary);
}

if (!SELLER_TOKEN) {
  showAccessDenied();
} else {
  loadSummary().then((ok) => {
    if (ok) showPanel();
  });
}

updateTotal();
