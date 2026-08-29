# RifaAPP

Sitio estático con una función serverless que guarda las compras en Neon Postgres.

## Conectar Neon en Vercel

1. En Vercel, abre el proyecto del sitio.
2. Ve a **Storage** (o **Integrations**) y conecta la base de datos Neon a este proyecto.
3. Comprueba en **Settings → Environment Variables** que exista `DATABASE_URL` para
   **Production**, **Preview** y **Development**. Usa la conexión `pooled` de Neon.
4. Vuelve a desplegar el proyecto. Las variables nuevas no se agregan a despliegues anteriores.

La contraseña nunca se usa en `index.html` ni en `script.js`. El navegador envía el
formulario a `/api/submit-purchase`; esa función lee `DATABASE_URL` en el servidor y
guarda la compra mediante Prisma Client.

El modelo oficial está en `prisma/schema.prisma`. La migración inicial crea:

- `customers`
- `vendors`
- `transactions`
- `raffle_numbers`

Las relaciones son:

- Un cliente puede tener muchas transacciones.
- Un vendedor puede tener muchas transacciones.
- Una transacción puede tener muchos números de rifa.

Cada envío nuevo queda con estado `pending` y sus números con estado `reserved`,
hasta que se confirme el pago.

Para confirmar una transacción desde el editor SQL de Neon:

```sql
BEGIN;

UPDATE transactions
SET status = 'approved'
WHERE id = 123;

UPDATE raffle_numbers
SET status = 'sold', sold_at = NOW()
WHERE transaction_id = 123;

COMMIT;
```

Reemplaza `123` por el identificador real de la transacción.

## Probar localmente

Requiere Node.js 20 o posterior y Vercel CLI.

```bash
cd RifaAPP
npm install
npm run prisma:validate
npm run prisma:generate
npm run db:migrate
npm run dev
```

`DATABASE_URL` debe contener la conexión pooled de Neon. Si Vercel también entrega
`DATABASE_URL_UNPOOLED`, Prisma Migrate la usará automáticamente para las migraciones.
Ambas variables pueden estar en el mismo archivo `.env`, que nunca debe publicarse.

Antes de un despliegue de producción, aplica las migraciones pendientes con las
variables configuradas en Vercel:

```bash
npx vercel env run -e production -- npm run db:migrate
```

El script `postinstall` regenera Prisma Client automáticamente durante cada despliegue.

## Verificar los datos

En el editor SQL de Neon puedes revisar los últimos registros con:

```sql
SELECT
  t.id,
  c.name,
  c.email,
  c.phone,
  v.name AS seller,
  t.quantity,
  t.amount,
  t.status,
  ARRAY_AGG(r.number ORDER BY r.number) AS raffle_numbers,
  t.submitted_at
FROM transactions AS t
JOIN customers AS c ON c.id = t.customer_id
LEFT JOIN vendors AS v ON v.id = t.vendor_id
LEFT JOIN raffle_numbers AS r ON r.transaction_id = t.id
GROUP BY t.id, c.name, c.email, c.phone, v.name
ORDER BY t.submitted_at DESC;
```
