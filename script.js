const pricePerTicket = 1000;
const totalPrice = document.getElementById('totalPrice');
const ticketInputs = document.querySelectorAll('input[name="tickets"]');
const form = document.getElementById('purchaseForm');
const message = document.getElementById('message');

function updateTotal() {
  const selected = document.querySelector('input[name="tickets"]:checked');
  const quantity = Number(selected?.value || 1);
  totalPrice.textContent = `$${(quantity * pricePerTicket).toLocaleString('es-ES')}`;
}

ticketInputs.forEach((input) => input.addEventListener('change', updateTotal));

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const data = new FormData(form);
  const name = data.get('name')?.toString().trim() || 'Comprador';
  const seller = data.get('seller')?.toString().trim() || 'No registrado';
  const quantity = document.querySelector('input[name="tickets"]:checked')?.value || '1';
  const amount = data.get('depositAmount')?.toString() || '0';

  message.style.display = 'block';
  message.innerHTML = `Gracias, ${name}. Tu compra de ${quantity} rifa(s) fue registrada. El comprobante por $${Number(amount).toLocaleString('es-ES')} está listo para revisión. Vendida por ${seller}.`;
  form.reset();
  updateTotal();
});

updateTotal();
