-- Anúncios (store_ads): aprovação admin/moderador, slots inclusos vs. extras pagos.
-- Premium: 2 inclusos/mês (is_extra=false). Extras: fee_amount >= 5, fee_acknowledged, 24h após approve.
-- Lojista cria pending; staff atualiza para approved/rejected; feed lê só approved com expires_at > now().

ALTER TABLE public.store_ads
  ADD COLUMN IF NOT EXISTS is_extra BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fee_amount DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  ADD COLUMN IF NOT EXISTS fee_acknowledged BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_store_ads_pending ON public.store_ads(created_at DESC)
  WHERE status = 'pending';

-- Conta apenas anúncios inclusos (não extras) criados no mês calendário.
CREATE OR REPLACE FUNCTION public.store_ads_included_this_month(p_store_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.store_ads
  WHERE store_id = p_store_id
    AND is_extra = false
    AND created_at >= date_trunc('month', now());
$$;

DROP POLICY IF EXISTS "Public can read active store ads" ON public.store_ads;
CREATE POLICY "Public can read active store ads" ON public.store_ads
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = store_id AND s.owner_id = auth.uid()
    )
    OR (
      public.is_moderator()
      AND EXISTS (
        SELECT 1 FROM public.stores s
        WHERE s.id = store_id
          AND s.neighborhood_id = public.moderator_neighborhood_id()
      )
    )
    OR (
      status = 'approved'
      AND expires_at IS NOT NULL
      AND expires_at > now()
      AND EXISTS (
        SELECT 1 FROM public.stores s
        WHERE s.id = store_id
          AND s.status = 'approved'
          AND s.subscription_status IN ('active', 'trialing')
      )
    )
  );

DROP POLICY IF EXISTS "Merchants can create store ads" ON public.store_ads;
CREATE POLICY "Merchants can create store ads" ON public.store_ads
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = store_id
        AND s.owner_id = auth.uid()
        AND s.status = 'approved'
        AND s.subscription_status IN ('active', 'trialing')
        AND s.plan_id = 'premium'
    )
    AND (
      (is_extra = false AND public.store_ads_included_this_month(store_id) < 2)
      OR (is_extra = true AND fee_amount >= 5 AND fee_acknowledged = true)
    )
  );

DROP POLICY IF EXISTS "Admin can update store ads" ON public.store_ads;
CREATE POLICY "Staff can update store ads" ON public.store_ads
  FOR UPDATE USING (
    public.is_admin()
    OR (
      public.is_moderator()
      AND EXISTS (
        SELECT 1 FROM public.stores s
        WHERE s.id = store_id
          AND s.neighborhood_id = public.moderator_neighborhood_id()
      )
    )
  );