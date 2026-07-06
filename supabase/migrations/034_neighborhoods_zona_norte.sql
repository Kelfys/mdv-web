-- Bairros adicionais — Zona Norte (Rio de Janeiro)

INSERT INTO public.neighborhoods (id, name, slug, city, state)
VALUES
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb006', 'Nova Holanda', 'nova-holanda', 'Rio de Janeiro', 'RJ'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb007', 'Parque União', 'parque-uniao', 'Rio de Janeiro', 'RJ'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb008', 'Ramos', 'ramos', 'Rio de Janeiro', 'RJ'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb009', 'Bonsucesso', 'bonsucesso', 'Rio de Janeiro', 'RJ')
ON CONFLICT (slug) DO NOTHING;