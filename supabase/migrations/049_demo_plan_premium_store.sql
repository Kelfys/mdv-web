-- Alinhado com remoto: version=049 name=demo_plan_premium_store
-- Não reexecutar em prod se já aplicada (só para histórico local / db push).
-- Demo Premium (histórico remoto sem statements; recriado idempotente)

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
