/**
 * Exporta SQL de 049–052 do remoto para arquivos locais (alinhamento de histórico).
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { connectionAttempts } from './db-connect.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv(name) {
  const path = resolve(root, name)
  if (!existsSync(path)) return {}
  const vars = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    vars[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return vars
}

const dbUrl = { ...loadEnv('.env'), ...loadEnv('.env.local') }.DATABASE_URL
let client
for (const { label, config } of connectionAttempts(dbUrl)) {
  const c = new pg.Client(config)
  try {
    await c.connect()
    client = c
    console.log('via', label)
    break
  } catch (e) {
    console.warn(label, e.message)
    await c.end().catch(() => {})
  }
}
if (!client) process.exit(1)

const { rows } = await client.query(
  `SELECT version, name, statements
   FROM supabase_migrations.schema_migrations
   WHERE version IN ('049','050','051','052')
   ORDER BY version`,
)

/** Reconstrução idempotente quando o remoto não guardou statements */
const FALLBACK = {
  '049': {
    name: 'demo_plan_premium_store',
    sql: `-- Demo Premium (histórico remoto sem statements; recriado idempotente)

SELECT public.seed_demo_merchant(
  '11111111-1111-4111-8111-111111110903',
  'demo-premium@maredevendas.com',
  'Lojista Demo Premium'
);

INSERT INTO public.stores (
  id, owner_id, name, slug, description, whatsapp,
  address, city, state, category_id, neighborhood_id, opening_hours,
  status, plan_id, subscription_status, approved_at, theme_color
)
SELECT
  '22222222-2222-4222-8222-222222220903',
  '11111111-1111-4111-8111-111111110903',
  'Loja Demo Premium',
  'loja-demo-premium',
  'Conta de teste — plano Premium (anúncios no feed).',
  '5521975190903',
  'Rua Demo, 300',
  'Rio de Janeiro',
  'RJ',
  c.id,
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb003',
  'Seg–Sáb 8h–20h',
  'approved',
  'premium',
  'active',
  NOW(),
  'pixel-purple'
FROM public.categories c
WHERE c.slug = 'eletronicos'
LIMIT 1
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = 'approved',
  plan_id = 'premium',
  subscription_status = 'active',
  approved_at = COALESCE(public.stores.approved_at, NOW()),
  neighborhood_id = EXCLUDED.neighborhood_id,
  theme_color = EXCLUDED.theme_color;

SELECT public.seed_demo_product(
  '22222222-2222-4222-8222-222222220903',
  'Fone Bluetooth',
  'Item teste plano Premium.',
  89.90
);
`,
  },
  '050': {
    name: 'store_ads_product_id',
    sql: `-- product_id em store_ads (anunciar produto no feed)

ALTER TABLE public.store_ads
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_store_ads_product_id ON public.store_ads(product_id);
`,
  },
}

for (const r of rows) {
  const name = r.name || FALLBACK[r.version]?.name || 'unknown'
  let body = ''
  if (Array.isArray(r.statements) && r.statements.length > 0) {
    body = r.statements
      .map((s) => {
        const t = String(s).trimEnd()
        return t.endsWith(';') ? t : `${t};`
      })
      .join('\n\n')
    body += '\n'
  } else if (FALLBACK[r.version]) {
    body = FALLBACK[r.version].sql
  } else {
    body = `-- Placeholder: aplicado no remoto sem statements armazenados\nSELECT 1;\n`
  }

  const header = [
    `-- Alinhado com remoto: version=${r.version} name=${name}`,
    `-- Não reexecutar em prod se já aplicada (só para histórico local / db push).`,
    '',
  ].join('\n')

  const file = resolve(root, 'supabase/migrations', `${r.version}_${name}.sql`)
  writeFileSync(file, header + body, 'utf8')
  console.log('wrote', file)
}

await client.end()
