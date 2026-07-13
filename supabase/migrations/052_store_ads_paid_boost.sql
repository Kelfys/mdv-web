-- Alinhado com remoto: version=052 name=store_ads_paid_boost
-- Não reexecutar em prod se já aplicada (só para histórico local / db push).
-- Destaque pago no feed: is_paid_boost exige taxa reconhecida no INSERT do lojista.

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
      product_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = product_id
          AND p.store_id = store_id
          AND p.active = true
      )
    )
    AND (
      (
        is_extra = false
        AND public.store_ads_included_this_month(store_id) < 2
        AND (
          is_paid_boost = false
          OR (is_paid_boost = true AND fee_amount >= 10 AND fee_acknowledged = true)
        )
      )
      OR (
        is_extra = true
        AND fee_amount >= 5
        AND fee_acknowledged = true
      )
    )
  );
