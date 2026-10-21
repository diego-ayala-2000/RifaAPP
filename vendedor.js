const PRICE_PER_TICKET = 2000;
const MAX_PROOF_SIZE = 4 * 1024 * 1024;
const RAFFLE_NAME = 'Rifa JMJ Corea 2027 · Camino Neocatecumenal Parroquia San Pedro de las Condes';

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
const printedView = document.getElementById('printedView');
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
const shareTicketBtn = document.getElementById('shareTicketBtn');
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
function buildTicketPdf({ name, email, phone, seller, quantity, amount, numbers, codes, submittedAt, history }) {
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
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(0);
    const lines = doc.splitTextToSize(text, contentWidth);
    const lineHeight = size * 0.42;
    ensureSpace(lines.length, lineHeight);
    lines.forEach((line) => {
      doc.text(line, pageWidth / 2, y, { align: 'center' });
      y += lineHeight;
    });
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
  if (codes && codes.length) row('Tickets impresos', codes.map(formatCode).join(', '));
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

function ticketFilename(name) {
  return `ticket-rifa-${String(name || 'comprador').replace(/\s+/g, '_').toLowerCase()}.pdf`;
}

function downloadTicket(doc, name) {
  doc.save(ticketFilename(name));
}

// Comparte el PDF con el selector nativo del sistema (el vendedor elige WhatsApp u
// otra app). Si el navegador no soporta compartir archivos (la mayoría de escritorio),
// se descarga el PDF para adjuntarlo manualmente.
async function shareTicket(doc, name) {
  const filename = ticketFilename(name);
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });

  const canShareFile = navigator.canShare && navigator.canShare({ files: [file] });

  if (navigator.share && canShareFile) {
    try {
      await navigator.share({
        files: [file],
        title: 'Ticket de compra',
        text: '¡Aquí tienes tu ticket de compra de la rifa! 🎟️'
      });
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') return false;
    }
  }

  downloadTicket(doc, name);
  return false;
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
      <td class="ticket-actions">
        <button type="button" class="copy-btn ticket-btn" data-id="${row.id}">📄 Ticket</button>
        <button type="button" class="copy-btn wa-share-btn" data-id="${row.id}">📲 WhatsApp</button>
      </td>
    </tr>
  `).join('');

  salesBody.querySelectorAll('.view-proof-btn').forEach((btn) => {
    btn.addEventListener('click', () => viewProof(btn.dataset.url, btn));
  });

  salesBody.querySelectorAll('.ticket-btn').forEach((btn) => {
    btn.addEventListener('click', () => withTicketDoc(btn.dataset.id, btn, downloadTicket));
  });

  salesBody.querySelectorAll('.wa-share-btn').forEach((btn) => {
    btn.addEventListener('click', () => withTicketDoc(btn.dataset.id, btn, shareTicket));
  });

  salesEmptyMessage.hidden = rows.length !== 0;
}

async function fetchTicketDoc(transactionId) {
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
    codes: transaction.codes,
    submittedAt: transaction.submittedAt,
    history
  });

  return { doc, name: transaction.name };
}

async function withTicketDoc(transactionId, button, action) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Generando...';

  try {
    const { doc, name } = await fetchTicketDoc(transactionId);
    await action(doc, name);
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

if (shareTicketBtn) {
  shareTicketBtn.addEventListener('click', async () => {
    if (!currentReceipt) return;

    try {
      const shared = await shareTicket(currentReceipt.doc, currentReceipt.name);
      copyMessageFeedback.textContent = shared ? '¡Ticket compartido!' : '¡Ticket descargado! Adjúntalo en WhatsApp.';
    } catch (error) {
      copyMessageFeedback.textContent = 'No se pudo compartir el PDF.';
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
    printedView.hidden = tab !== 'printed';
    salesView.hidden = tab !== 'sales';

    if (tab === 'printed') loadPrinted();
  });
});

// ---------------------------------------------------------------------------
// Tickets presenciales: se imprimen con un código, se venden en papel y luego se
// registran con los datos del comprador y el comprobante de la transferencia.
// ---------------------------------------------------------------------------

const printForm = document.getElementById('printForm');
const printQty = document.getElementById('printQty');
const printBtn = document.getElementById('printBtn');
const printMessage = document.getElementById('printMessage');

const printedSaleForm = document.getElementById('printedSaleForm');
const printedCodes = document.getElementById('printedCodes');
const printedCodesHint = document.getElementById('printedCodesHint');
const printedCount = document.getElementById('printedCount');
const printedTotal = document.getElementById('printedTotal');
const printedProofFile = document.getElementById('printedProofFile');
const printedSaleMessage = document.getElementById('printedSaleMessage');

const printedResultPanel = document.getElementById('printedResultPanel');
const printedAssigned = document.getElementById('printedAssigned');
const printedPdfBtn = document.getElementById('printedPdfBtn');
const printedShareBtn = document.getElementById('printedShareBtn');
const printedFeedback = document.getElementById('printedFeedback');
const printedNewBtn = document.getElementById('printedNewBtn');

const reprintBtn = document.getElementById('reprintBtn');
const refreshPrintedBtn = document.getElementById('refreshPrintedBtn');
const printedBody = document.getElementById('printedBody');
const printedEmptyMessage = document.getElementById('printedEmptyMessage');
const statPrinted = document.getElementById('statPrinted');
const statPrintedAvailable = document.getElementById('statPrintedAvailable');
const statPrintedUsed = document.getElementById('statPrintedUsed');

const TICKETS_PER_PAGE = 7;
const CODE_LENGTH = 6;

let printedTickets = [];
let printedReceipt = null;
let logoDataUrl;

function showNotice(element, text, type = 'info') {
  element.className = `message ${type}`;
  element.style.display = 'block';
  element.textContent = text;
}

function hideNotice(element) {
  element.style.display = 'none';
  element.textContent = '';
}

// En papel el código se muestra en dos bloques (K7M-4QX) para leerlo sin errores;
// al registrarlo se aceptan con o sin guion.
function formatCode(code) {
  const clean = String(code || '');
  return clean.length === CODE_LENGTH ? `${clean.slice(0, 3)}-${clean.slice(3)}` : clean;
}

function parseCodes(text) {
  const codes = String(text || '')
    .toUpperCase()
    .split(/[\s,;]+/)
    .map((code) => code.replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean);
  return [...new Set(codes)];
}

async function loadLogo() {
  if (logoDataUrl !== undefined) return logoDataUrl;

  try {
    const response = await fetch('content/images.jpeg');
    const blob = await response.blob();
    logoDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    logoDataUrl = null;
  }

  return logoDataUrl;
}

// Hoja A4 con 7 tickets. Cada ticket tiene a la izquierda el talón del vendedor
// (donde se anotan los datos del comprador) y a la derecha la parte del comprador.
function buildPrintSheetPdf(codes, seller, logo) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 10;
  const marginTop = 12;
  const ticketHeight = 39;
  const stubWidth = 66;
  const left = marginX;
  const right = pageWidth - marginX;
  const cutX = left + stubWidth;

  function cutLine(x1, y1, x2, y2) {
    doc.setDrawColor(150);
    doc.setLineDashPattern([1.5, 1.2], 0);
    doc.line(x1, y1, x2, y2);
    doc.setLineDashPattern([], 0);
  }

  function writeLine(label, x, y, width) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(60);
    doc.text(label, x, y);
    doc.setDrawColor(170);
    doc.line(x + doc.getTextWidth(label) + 1, y + 0.6, x + width, y + 0.6);
  }

  codes.forEach((code, index) => {
    const slot = index % TICKETS_PER_PAGE;
    if (index > 0 && slot === 0) doc.addPage();

    const top = marginTop + slot * ticketHeight;
    const bottom = top + ticketHeight;

    // Líneas de corte del ticket y entre talón y parte del comprador.
    cutLine(left, top, right, top);
    cutLine(left, bottom, right, bottom);
    cutLine(left, top, left, bottom);
    cutLine(right, top, right, bottom);
    cutLine(cutX, top, cutX, bottom);

    // Talón del vendedor.
    const sx = left + 4;
    const sw = stubWidth - 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(198, 40, 40);
    doc.text('TALÓN VENDEDOR', sx, top + 5.5);
    doc.setFont('courier', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(formatCode(code), sx, top + 11.5);
    writeLine('Nombre:', sx, top + 18, sw);
    writeLine('Teléfono:', sx, top + 24, sw);
    writeLine('Correo:', sx, top + 30, sw);
    doc.setFontSize(6.5);
    doc.setTextColor(110);
    doc.text(doc.splitTextToSize(`Vendedor: ${seller}`, sw)[0], sx, top + 35.5);

    // Parte del comprador.
    const bx = cutX + 5;
    const logoSize = 22;
    const bw = right - bx - 4 - (logo ? logoSize + 4 : 0);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0);
    const titleLines = doc.splitTextToSize(RAFFLE_NAME, bw).slice(0, 2);
    doc.text(titleLines, bx, top + 5.5);

    const afterTitle = top + 5.5 + titleLines.length * 3.6;
    doc.setFontSize(7);
    doc.setTextColor(198, 40, 40);
    doc.text('TICKET DEL COMPRADOR', bx, afterTitle + 1.5);

    doc.setFont('courier', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(0);
    doc.text(formatCode(code), bx, afterTitle + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(40);
    doc.text(`Valor: ${formatCurrency(PRICE_PER_TICKET)}  ·  Sorteo: noviembre de 2026  ·  Vendedor: ${seller}`, bx, afterTitle + 15.5, {
      maxWidth: right - bx - 4
    });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(110);
    doc.text(
      doc.splitTextToSize(
        'Conserva este ticket. Tu número de rifa se asigna cuando el vendedor registra tu pago con este código.',
        right - bx - 4
      ),
      bx,
      bottom - 5
    );

    if (logo) {
      doc.addImage(logo, 'JPEG', right - 4 - logoSize, top + 4, logoSize, logoSize);
    }
  });

  doc.setTextColor(0);
  return doc;
}

async function savePrintSheet(codes, seller) {
  const logo = await loadLogo();
  const doc = buildPrintSheetPdf(codes, seller, logo);
  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`tickets-presenciales-${String(seller || 'vendedor').replace(/\s+/g, '_').toLowerCase()}-${stamp}.pdf`);
}

function printedStatusPill(row) {
  return row.status === 'available'
    ? '<span class="pill pill-wait">Sin registrar</span>'
    : '<span class="pill pill-ok">Registrado</span>';
}

function renderPrinted(result) {
  printedTickets = result.tickets || [];
  const totals = result.totals || {};

  statPrinted.textContent = totals.printed || 0;
  statPrintedAvailable.textContent = totals.available || 0;
  statPrintedUsed.textContent = totals.used || 0;

  printedBody.innerHTML = printedTickets.map((row) => `
    <tr>
      <td class="ticket-code">${escapeHtml(formatCode(row.code))}</td>
      <td>${printedStatusPill(row)}</td>
      <td>${escapeHtml(row.customer || '—')}</td>
      <td>${row.raffleNumber ?? '—'}</td>
      <td>${formatDate(row.createdAt)}</td>
      <td>${formatDate(row.usedAt)}</td>
    </tr>
  `).join('');

  printedEmptyMessage.hidden = printedTickets.length !== 0;
  reprintBtn.disabled = !totals.available;
}

async function loadPrinted() {
  try {
    const response = await fetch('/api/seller/printed', {
      headers: { 'x-seller-token': SELLER_TOKEN }
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || 'No se pudieron cargar los tickets impresos.');
    }

    renderPrinted(result);
  } catch (error) {
    showNotice(printMessage, error.message, 'error');
  }
}

function updatePrintedTotal() {
  const codes = parseCodes(printedCodes.value);
  const invalid = codes.filter((code) => code.length !== CODE_LENGTH);

  printedCount.textContent = codes.length;
  printedTotal.textContent = formatCurrency(codes.length * PRICE_PER_TICKET);

  if (invalid.length) {
    printedCodesHint.classList.remove('is-valid');
    printedCodesHint.textContent = `Revisa: ${invalid.join(', ')} (cada código tiene ${CODE_LENGTH} caracteres).`;
  } else if (codes.length) {
    printedCodesHint.classList.add('is-valid');
    printedCodesHint.textContent = `${codes.length} ${rifaWord(codes.length)} × ${formatCurrency(PRICE_PER_TICKET)} = ${formatCurrency(codes.length * PRICE_PER_TICKET)}.`;
  } else {
    printedCodesHint.classList.remove('is-valid');
    printedCodesHint.textContent = 'Separa los códigos con comas, espacios o saltos de línea.';
  }
}

printedCodes.addEventListener('input', updatePrintedTotal);

printForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const quantity = Math.floor(Number(printQty.value));

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 200) {
    showNotice(printMessage, 'Ingresa una cantidad entre 1 y 200.', 'error');
    return;
  }

  printBtn.disabled = true;
  showNotice(printMessage, 'Generando códigos...', 'info');

  try {
    const response = await fetch('/api/seller/printed', {
      method: 'POST',
      headers: { 'x-seller-token': SELLER_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity })
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || 'No se pudieron generar los tickets.');
    }

    await savePrintSheet(result.codes, result.seller || sellerName);
    showNotice(printMessage, `¡Listo! Se descargó el PDF con ${result.codes.length} tickets para imprimir.`, 'success');
    loadPrinted();
  } catch (error) {
    showNotice(printMessage, error.message, 'error');
  } finally {
    printBtn.disabled = false;
  }
});

reprintBtn.addEventListener('click', async () => {
  const codes = printedTickets.filter((row) => row.status === 'available').map((row) => row.code).sort();
  if (!codes.length) return;

  reprintBtn.disabled = true;
  try {
    await savePrintSheet(codes, sellerName);
  } finally {
    reprintBtn.disabled = false;
  }
});

refreshPrintedBtn.addEventListener('click', loadPrinted);

printedSaleForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const data = new FormData(printedSaleForm);
  const codes = parseCodes(printedCodes.value);
  const name = data.get('name')?.toString().trim() || '';
  const email = data.get('email')?.toString().trim() || '';
  const phone = (data.get('phone')?.toString() || '').replace(/\D/g, '').replace(/^56(?=\d{9}$)/, '');
  const proofFile = printedProofFile?.files?.[0];

  if (!codes.length) {
    showNotice(printedSaleMessage, 'Ingresa al menos un código de ticket.', 'error');
    return;
  }

  if (codes.some((code) => code.length !== CODE_LENGTH)) {
    showNotice(printedSaleMessage, `Cada código debe tener ${CODE_LENGTH} caracteres.`, 'error');
    return;
  }

  if (!name || !email || phone.length !== 9) {
    showNotice(printedSaleMessage, 'Completa nombre, correo y teléfono (9 dígitos) del comprador.', 'error');
    return;
  }

  if (!proofFile) {
    showNotice(printedSaleMessage, 'Debes adjuntar el comprobante de la transferencia.', 'error');
    return;
  }

  if (proofFile.size > MAX_PROOF_SIZE) {
    showNotice(printedSaleMessage, 'El comprobante es muy pesado. Debe ser menor a 4MB.', 'error');
    return;
  }

  showNotice(printedSaleMessage, 'Registrando los tickets...', 'info');

  try {
    const payload = new FormData();
    payload.set('codes', codes.join(','));
    payload.set('name', name);
    payload.set('email', email);
    payload.set('phone', phone);
    payload.set('proofFile', proofFile);

    const response = await fetch('/api/seller/printed', {
      method: 'POST',
      headers: { 'x-seller-token': SELLER_TOKEN },
      body: payload
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || `No se pudieron registrar los tickets (${response.status}).`);
    }

    const numbers = result.data?.raffleNumbers || [];
    const savedCodes = result.data?.codes || codes;
    const quantity = savedCodes.length;

    printedAssigned.textContent = savedCodes
      .map((code, i) => `${formatCode(code)} → n° ${numbers[i] ?? '—'}`)
      .join('  ·  ');

    printedReceipt = {
      name,
      doc: buildTicketPdf({
        name,
        email,
        phone,
        seller: sellerName,
        quantity,
        amount: quantity * PRICE_PER_TICKET,
        numbers,
        codes: savedCodes,
        history: result.history
      })
    };

    hideNotice(printedSaleMessage);
    printedResultPanel.hidden = false;
    printedResultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (result.summary) renderSummary(result.summary);
    printedSaleForm.reset();
    updatePrintedTotal();
    loadPrinted();
  } catch (error) {
    showNotice(printedSaleMessage, `No se pudieron registrar los tickets. ${error.message}`, 'error');
  }
});

function flashPrintedFeedback(text) {
  printedFeedback.textContent = text;
  setTimeout(() => {
    printedFeedback.textContent = '';
  }, 3000);
}

printedPdfBtn.addEventListener('click', () => {
  if (!printedReceipt) return;
  downloadTicket(printedReceipt.doc, printedReceipt.name);
  flashPrintedFeedback('¡Ticket descargado!');
});

printedShareBtn.addEventListener('click', async () => {
  if (!printedReceipt) return;
  const shared = await shareTicket(printedReceipt.doc, printedReceipt.name);
  flashPrintedFeedback(shared ? '¡Ticket compartido!' : '¡Ticket descargado! Adjúntalo en WhatsApp.');
});

printedNewBtn.addEventListener('click', () => {
  printedResultPanel.hidden = true;
  hideNotice(printedSaleMessage);
  printedSaleForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
