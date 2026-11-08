// Carga los datos de la rifa de este despliegue (/api/config) y los aplica a la página.
// Marcas en el HTML:
//   data-raffle-text="Vendedores · {title}"  → texto con {campos} reemplazados
//   data-raffle-src / data-raffle-alt / data-raffle-href="campo"
//   data-raffle-show="campo"                → se oculta si el campo está vacío
//   data-price-qty="5"                      → precio de 5 rifas, con formato $10.000
// Los scripts de cada página esperan a window.raffleReady antes de usar el precio.
(function () {
  function get(path, raffle) {
    return path.split('.').reduce((value, key) => (value == null ? value : value[key]), raffle);
  }

  function isEmpty(value) {
    return value == null || value === '' || (Array.isArray(value) && value.length === 0);
  }

  function fill(template, raffle) {
    return template.replace(/\{([\w.]+)\}/g, (_, path) => get(path, raffle) ?? '');
  }

  function apply(raffle) {
    document.querySelectorAll('[data-raffle-show]').forEach((el) => {
      el.hidden = isEmpty(get(el.dataset.raffleShow, raffle));
    });
    document.querySelectorAll('[data-raffle-text]').forEach((el) => {
      el.textContent = fill(el.dataset.raffleText, raffle);
    });
    document.querySelectorAll('[data-raffle-src]').forEach((el) => {
      const value = get(el.dataset.raffleSrc, raffle);
      if (value) el.src = value;
    });
    document.querySelectorAll('[data-raffle-alt]').forEach((el) => {
      el.alt = get(el.dataset.raffleAlt, raffle) ?? '';
    });
    document.querySelectorAll('[data-raffle-href]').forEach((el) => {
      const value = get(el.dataset.raffleHref, raffle);
      if (value) el.href = value;
    });
    document.querySelectorAll('[data-price-qty]').forEach((el) => {
      el.textContent = `$${(Number(el.dataset.priceQty) * raffle.price).toLocaleString('es-CL')}`;
    });
  }

  function reveal() {
    document.documentElement.classList.remove('raffle-loading');
  }

  window.raffleReady = fetch('/api/config')
    .then((response) => {
      if (!response.ok) throw new Error('No se pudo cargar la configuración de la rifa.');
      return response.json();
    })
    .then((raffle) => {
      window.RAFFLE = raffle;
      apply(raffle);
      return raffle;
    })
    .finally(reveal);

  window.raffleReady.catch((error) => {
    console.error(error);
    window.alert('No se pudo cargar la información de la rifa. Recarga la página.');
  });
})();
