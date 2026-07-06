-- Restaura senha do admin demo (idempotente)
SELECT public.seed_demo_admin(
  '99999999-9999-4999-8999-999999999000',
  'brunopdaraujo@gmail.com',
  'Bruno Admin',
  'MarecAdmin2026!'
);