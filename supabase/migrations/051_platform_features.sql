-- Alinhado com remoto: version=051 name=platform_features
-- Não reexecutar em prod se já aplicada (só para histórico local / db push).
-- Reviews: resposta do lojista, wishlist, promo relâmpago, cliques em anúncios, log staff, destaque pago

-- Resposta do lojista às avaliações
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS store_response TEXT,
  ADD COLUMN IF NOT EXISTS store_response_at TIMESTAMPTZ;

DROP POLICY IF EXISTS "Store owners can respond to reviews" ON public.reviews;

CREATE POLICY "Store owners can respond to reviews" ON public.reviews
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = store_id AND s.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = store_id AND s.owner_id = auth.uid()
    )
  );

-- Lista de desejos (produtos salvos para comprar depois)
CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_items_user ON public.wishlist_items(user_id);

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own wishlist" ON public.wishlist_items;

CREATE POLICY "Users manage own wishlist" ON public.wishlist_items
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff read wishlist" ON public.wishlist_items;

CREATE POLICY "Staff read wishlist" ON public.wishlist_items
  FOR SELECT USING (public.is_staff());

-- Promoção relâmpago em produtos
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS flash_promo_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS flash_promo_ends_at TIMESTAMPTZ;

-- Métricas de cliques em anúncios do feed
CREATE TABLE IF NOT EXISTS public.store_ad_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID NOT NULL REFERENCES public.store_ads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_ad_clicks_ad ON public.store_ad_clicks(ad_id);

ALTER TABLE public.store_ad_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can record ad clicks" ON public.store_ad_clicks;

CREATE POLICY "Anyone can record ad clicks" ON public.store_ad_clicks
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Ad owners and staff read clicks" ON public.store_ad_clicks;

CREATE POLICY "Ad owners and staff read clicks" ON public.store_ad_clicks
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.store_ads a
      JOIN public.stores s ON s.id = a.store_id
      WHERE a.id = ad_id AND s.owner_id = auth.uid()
    )
  );

-- Destaque pago extra no feed (além dos inclusos no Premium)
ALTER TABLE public.store_ads
  ADD COLUMN IF NOT EXISTS is_paid_boost BOOLEAN NOT NULL DEFAULT false;

-- Log de ações do staff (moderação, aprovações em lote, etc.)
CREATE TABLE IF NOT EXISTS public.staff_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_action_log_created ON public.staff_action_log(created_at DESC);

ALTER TABLE public.staff_action_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read action log" ON public.staff_action_log;

CREATE POLICY "Staff read action log" ON public.staff_action_log
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "Staff insert action log" ON public.staff_action_log;

CREATE POLICY "Staff insert action log" ON public.staff_action_log
  FOR INSERT WITH CHECK (public.is_staff());
