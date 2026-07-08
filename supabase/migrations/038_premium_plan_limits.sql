-- Premium: limite mensal de anúncios reduzido de 4 para 2

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
    AND public.store_ads_created_this_month(store_id) < 2
  );