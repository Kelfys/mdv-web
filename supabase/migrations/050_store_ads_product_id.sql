-- Alinhado com remoto: version=050 name=store_ads_product_id
-- Não reexecutar em prod se já aplicada (só para histórico local / db push).
-- product_id em store_ads (anunciar produto no feed)

ALTER TABLE public.store_ads
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_store_ads_product_id ON public.store_ads(product_id);
