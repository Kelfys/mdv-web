-- Staff (admin/moderador) pode criar e excluir anúncios sem regras de plano do lojista.
-- UPDATE já coberto por "Staff can update store ads" (migration 044).

DROP POLICY IF EXISTS "Staff can insert store ads" ON public.store_ads;
CREATE POLICY "Staff can insert store ads" ON public.store_ads
  FOR INSERT WITH CHECK (
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

DROP POLICY IF EXISTS "Staff can delete store ads" ON public.store_ads;
CREATE POLICY "Staff can delete store ads" ON public.store_ads
  FOR DELETE USING (
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