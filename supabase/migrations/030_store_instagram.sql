-- Instagram opcional no perfil da loja (handle sem @)
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS instagram TEXT;

COMMENT ON COLUMN public.stores.instagram IS 'Usuário do Instagram da loja (sem @), ex.: minhaloja';