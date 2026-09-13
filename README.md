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

## Dos flujos

- **`index.html` (comprador):** informativo. El comprador elige la cantidad, paga por
  transferencia o Mercado Pago y **reenvía el comprobante al vendedor por WhatsApp**.
  Esta página ya no tiene formulario.
- **`vendedor.html` (vendedor):** el vendedor ingresa cada venta (datos del comprador,
  cantidad, monto y comprobante). Al enviarla obtiene un **ticket en PDF** (tamaño A6)
  con los números asignados, los datos de la venta y el historial de compras del
  comprador, listo para descargar y reenviar por WhatsApp u otro medio. El mismo
  ticket puede volver a descargarse desde la pestaña **"Mis ventas"** para cualquier
  venta ya registrada.

**Cada vendedor tiene su enlace personal** con un token único:

```
https://<tu-dominio>/vendedor.html?t=TOKEN_DEL_VENDEDOR
```

Los vendedores y sus tokens se definen en `lib/sellers.js` (no requiere variables de
entorno). El token es la credencial: identifica al vendedor, precarga su nombre en el
formulario (el servidor lo fuerza, no se puede cambiar) y da acceso a la pestaña
**"Mis ventas"** con su historial y totales. Sin un `?t=` válido la página muestra
"enlace no válido" y `/api/seller/submit` responde `401`.

Genera tokens con `openssl rand -hex 8` y entrega a cada vendedor solo su enlace.

La venta entra como `pending` con números `reserved`; el equipo la confirma desde
`admin.html`.

## Panel de administración (`admin.html`)

Mismo esquema de enlace secreto que el panel de vendedores:

```
https://<tu-dominio>/admin.html?k=CLAVE_ADMIN
```

`CLAVE_ADMIN` debe coincidir con la variable de entorno `ADMIN_ACCESS_KEY`
(configúrala en Vercel para Production y Preview; si no existe, se usa `ADMIN_PASSWORD`
como respaldo). Sin `?k=` válido, la página muestra "enlace no válido" y las funciones
`/api/admin/*` responden `401`.

Tiene dos pestañas:

- **Confirmar compras:** lista las transacciones `pending`, permite ver el comprobante
  y confirmarlas (pasa la transacción a `approved` y sus números a `sold`).
- **Dashboards:** estado general (números asignados, reservados vs. vendidos,
  transacciones, recaudación confirmada y pendiente), alertas de integridad y cuatro
  tablas de la base de datos:
  - **Asignación de números** (la principal): cada número con su comprador, vendedor,
    estado y transacción, con filtro de búsqueda.
  - **Transacciones**, **Vendedores** (totales por vendedor) y **Clientes**.

Datos servidos por `/api/admin/dashboard` (`getDashboard()` en `lib/db.js`).

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
