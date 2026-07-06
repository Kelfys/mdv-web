-- Redistribui lojas demo: 4 por bairro em Nova Holanda, Parque União, Ramos e Bonsucesso
-- Copacabana fica sem lojas demo

UPDATE public.stores SET neighborhood_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb006' WHERE slug IN (
  'mercearia-do-ze', 'padaria-pao-quente', 'boutique-maria', 'casa-e-estilo'
);
UPDATE public.stores SET neighborhood_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb007' WHERE slug IN (
  'distribuidora-gelada', 'adega-do-vale', 'moda-jovem-street', 'moveis-noroeste'
);
UPDATE public.stores SET neighborhood_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb008' WHERE slug IN (
  'conserto-rapido', 'lavanderia-express', 'tech-marec', 'pet-love'
);
UPDATE public.stores SET neighborhood_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb009' WHERE slug IN (
  'farmacia-popular', 'salao-beleza-total', 'celular-e-cia', 'mundo-animal'
);