// Datos de cada rifa. El mismo código se despliega una vez por rifa (un proyecto de
// Vercel cada una, con su propia base de datos) y la variable de entorno RAFFLE elige
// cuál de estas configuraciones se usa. Sin RAFFLE se usa la rifa JMJ.
//
// Los campos en null o listas vacías se ocultan en la página.
const RAFFLES = {
  jmj: {
    // Nombre corto: etiqueta superior y título de la pestaña del navegador.
    shortName: 'JMJ Corea 2027',
    title: 'Rifa JMJ Corea 2027',
    // Nombre completo que aparece en el ticket PDF y en el mensaje de WhatsApp.
    ticketName: 'Rifa JMJ Corea 2027 · Camino Neocatecumenal Parroquia San Pedro de las Condes',
    organization: 'Parroquia San Pedro de Las Condes',
    headline: 'Rifa para la Jornada Mundial de la Juventud',
    description: 'Campaña de recaudación de fondos para la peregrinación de Corea',
    logo: { src: 'content/images.jpeg', alt: 'Logo JMJ Seúl 2027' },
    price: 2000,
    // Primer número de rifa que se entrega.
    firstNumber: 1,
    draw: {
      title: 'Sorteo a fines de noviembre 2026',
      note: '📍 Presencial en la Parroquia San Pedro de Las Condes, un sábado después de la Eucaristía.',
      // Se usa en frases como "El sorteo será en noviembre de 2026."
      when: 'noviembre de 2026'
    },
    prizes: ['iPad 11 Wi‑Fi 128GB', 'Apple AirPods 4', 'Okwu Fundamental Brushes Collection'],
    // true: se muestran como 1er, 2do, 3er premio. false: lista de premios sin orden.
    prizesRanked: true,
    prizeNote: '🎉 ¡Y muchos premios más que se repartirán el día del sorteo!',
    bank: {
      name: 'Jorge Ayala Marfil',
      rut: '5.868.327-2',
      accountType: 'Cuenta corriente',
      account: '15782935',
      bank: 'BICE',
      email: 'jubileoroma@gmail.com'
    },
    mercadoPagoUrl: 'https://link.mercadopago.cl/jmjkoreasanpedro',
    // Quien vende la rifa, en la explicación del paso 2 ("Aporte a un peregrino").
    sellerNoun: 'peregrino',
    // WhatsApp para aportes al fondo común (sin vendedor). null oculta esa opción.
    commonFundWhatsapp: '56962466138',
    contactEmail: 'jubileoroma@gmail.com'
  },

  postconfirmacion: {
    shortName: 'Post Confirmación 2026',
    title: 'Rifa pro fondos Campamento de Post Confirmación 2026',
    ticketName: 'Rifa pro fondos Campamento de Post Confirmación 2026',
    organization: null,
    headline: 'Rifa pro fondos Campamento de Post Confirmación 2026',
    description: null,
    logo: null,
    price: 2000,
    firstNumber: 2000,
    draw: {
      title: 'Fecha del sorteo por definir',
      note: null,
      when: null
    },
    prizes: [
      '3 entradas dobles al Trampoline Park',
      '3 entradas dobles a Cerogrado',
      'Cafetera italiana + 6 vasos',
      '1 parlante Monster',
      '1 perfume Irresistible de Givenchy',
      '1 hielera',
      'Encíclica Magnífica Humanitas',
      '6 libros católicos',
      '1 caja de frutos secos (5 kg)',
      'Par de aros marca Venusta',
      '1 juego de loza (4 personas)',
      '1 juego de bandejas de mesa',
      '1 juego de copas de espumante',
      '3 libros para niños en inglés'
    ],
    prizesRanked: false,
    prizeNote: null,
    bank: null,
    mercadoPagoUrl: null,
    sellerNoun: null,
    commonFundWhatsapp: null,
    contactEmail: null
  }
};

const DEFAULT_RAFFLE = 'jmj';

function getRaffle() {
  const id = (process.env.RAFFLE || DEFAULT_RAFFLE).trim().toLowerCase();
  const raffle = RAFFLES[id];

  if (!raffle) {
    throw new Error(`La rifa "${id}" no existe. Revisa la variable de entorno RAFFLE.`);
  }

  return { id, ...raffle };
}

export { RAFFLES, getRaffle };
