-- Configurações públicas da plataforma (ex.: cor de alerta do logo no cabeçalho).
-- Leitura: qualquer um (anon/authenticated). Escrita: só admin.

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_settings IS
  'Chaves públicas da UI (ex.: logo_accent). value é texto simples.';

INSERT INTO public.platform_settings (key, value)
VALUES ('logo_accent', 'normal')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;
CREATE POLICY "Anyone can read platform settings"
  ON public.platform_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin can insert platform settings" ON public.platform_settings;
CREATE POLICY "Admin can insert platform settings"
  ON public.platform_settings FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can update platform settings" ON public.platform_settings;
CREATE POLICY "Admin can update platform settings"
  ON public.platform_settings FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can delete platform settings" ON public.platform_settings;
CREATE POLICY "Admin can delete platform settings"
  ON public.platform_settings FOR DELETE
  USING (public.is_admin());
