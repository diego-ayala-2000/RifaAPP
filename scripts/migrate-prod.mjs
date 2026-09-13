// Aplica las migraciones de Prisma contra la base de datos de PRODUCCIÓN.
//
// Uso:
//   npx vercel env pull .env.production --environment=production --yes
//   node scripts/migrate-prod.mjs [ruta-al-env]        (por defecto .env.production)
//
// Prisma Migrate necesita una conexión DIRECTA postgresql:// (no acepta
// prisma:// / prisma+postgres://). El script:
//   1) usa DATABASE_URL_UNPOOLED / POSTGRES_URL_NON_POOLING si ya son postgresql://
//   2) si no, arma la URL directa con PGHOST_UNPOOLED + PGUSER + PGPASSWORD + PGDATABASE
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const envFile = process.argv[2] || '.env.production';

let raw;
try {
  raw = readFileSync(envFile, 'utf8');
} catch (error) {
  console.error(`No se encontró ${envFile}. Corre primero:`);
  console.error('  npx vercel env pull .env.production --environment=production --yes');
  process.exit(1);
}

const env = {};
for (const line of raw.split('\n')) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (!match) continue;
  let value = match[2];
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  env[match[1]] = value;
}

const isPostgres = (url) => /^postgres(ql)?:\/\//.test(url || '');

function resolveDirectUrl() {
  for (const key of ['DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'DATABASE_URL', 'POSTGRES_URL']) {
    if (isPostgres(env[key])) return { url: env[key], how: key };
  }

  const host = env.PGHOST_UNPOOLED || env.PGHOST || env.POSTGRES_HOST;
  const user = env.PGUSER || env.POSTGRES_USER;
  const pass = env.PGPASSWORD || env.POSTGRES_PASSWORD;
  const db = env.PGDATABASE || env.POSTGRES_DATABASE || 'neondb';

  if (host && user && pass) {
    const url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}/${db}?sslmode=require`;
    return { url, how: `armada con PGHOST_UNPOOLED (${host})` };
  }

  return null;
}

const resolved = resolveDirectUrl();

if (!resolved) {
  console.error('No pude obtener una conexión postgresql:// directa desde el env.');
  console.error('Consigue la cadena "Direct connection" en el panel de Neon y corre:');
  console.error('  DATABASE_URL="postgresql://..." npx prisma migrate deploy');
  process.exit(1);
}

console.log(`Conexión directa: ${resolved.how}`);
execSync('npx prisma migrate deploy', {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: resolved.url, DIRECT_URL: resolved.url }
});
