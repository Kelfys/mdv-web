-- Bairros (regiões) e moderadores com escopo regional

CREATE TABLE IF NOT EXISTS public.neighborhoods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  state TEXT NOT NULL CHECK (char_length(state) = 2),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_neighborhoods_slug ON public.neighborhoods(slug);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_active ON public.neighborhoods(active);

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS neighborhood_id UUID REFERENCES public.neighborhoods(id) ON DELETE RESTRICT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS neighborhood_id UUID REFERENCES public.neighborhoods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stores_neighborhood ON public.stores(neighborhood_id);
CREATE INDEX IF NOT EXISTS idx_users_neighborhood ON public.users(neighborhood_id);

-- Bairros iniciais (Rio de Janeiro)
INSERT INTO public.neighborhoods (id, name, slug, city, state)
VALUES
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb001', 'Copacabana', 'copacabana', 'Rio de Janeiro', 'RJ'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002', 'Ipanema', 'ipanema', 'Rio de Janeiro', 'RJ'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb003', 'Leblon', 'leblon', 'Rio de Janeiro', 'RJ'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb004', 'Centro', 'centro', 'Rio de Janeiro', 'RJ'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb005', 'Tijuca', 'tijuca', 'Rio de Janeiro', 'RJ')
ON CONFLICT (slug) DO NOTHING;

UPDATE public.stores
SET neighborhood_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb001'
WHERE neighborhood_id IS NULL;

UPDATE public.users
SET neighborhood_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb001'
WHERE role = 'moderator' AND neighborhood_id IS NULL;

CREATE OR REPLACE FUNCTION public.moderator_neighborhood_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT neighborhood_id FROM public.users WHERE id = auth.uid() AND role = 'moderator';
$$;

CREATE OR REPLACE FUNCTION public.moderator_can_access_store(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = p_store_id
        AND public.is_moderator()
        AND s.neighborhood_id = public.moderator_neighborhood_id()
    );
$$;

ALTER TABLE public.neighborhoods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active neighborhoods" ON public.neighborhoods;
CREATE POLICY "Anyone can read active neighborhoods" ON public.neighborhoods
  FOR SELECT USING (active = true OR public.is_staff());

DROP POLICY IF EXISTS "Admin can manage neighborhoods" ON public.neighborhoods;
CREATE POLICY "Admin can manage neighborhoods" ON public.neighborhoods
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Anyone can read approved stores" ON public.stores;
CREATE POLICY "Read stores" ON public.stores
  FOR SELECT USING (
    owner_id = auth.uid()
    OR public.is_admin()
    OR (
      public.is_moderator()
      AND neighborhood_id = public.moderator_neighborhood_id()
    )
    OR (
      status = 'approved'
      AND subscription_status IN ('active', 'trialing')
    )
  );

DROP POLICY IF EXISTS "Owners can update own stores" ON public.stores;
CREATE POLICY "Owners and regional staff can update stores" ON public.stores
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR public.is_admin()
    OR (
      public.is_moderator()
      AND neighborhood_id = public.moderator_neighborhood_id()
    )
  );

DROP POLICY IF EXISTS "Store owners and staff can read orders" ON public.orders;
CREATE POLICY "Read orders with store access" ON public.orders
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_admin()
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
  );

DROP POLICY IF EXISTS "Read order items with order access" ON public.order_items;
CREATE POLICY "Read order items with order access" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.stores s ON s.id = o.store_id
      WHERE o.id = order_id
        AND (
          s.owner_id = auth.uid()
          OR public.is_admin()
          OR (
            public.is_moderator()
            AND s.neighborhood_id = public.moderator_neighborhood_id()
          )
          OR o.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Anyone can read active products of approved stores" ON public.products;
CREATE POLICY "Read products with store access" ON public.products
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
      active = true
      AND EXISTS (
        SELECT 1 FROM public.stores s
        WHERE s.id = store_id
          AND s.status = 'approved'
          AND s.subscription_status IN ('active', 'trialing')
      )
    )
  );

DROP POLICY IF EXISTS "Store owners and staff can read views" ON public.store_views;
CREATE POLICY "Read store views with store access" ON public.store_views
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
  );

DROP POLICY IF EXISTS "Read plan change requests" ON public.plan_change_requests;
CREATE POLICY "Read plan change requests" ON public.plan_change_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = store_id AND s.owner_id = auth.uid()
    )
    OR (
      public.can_approve_plan_change_requests()
      AND (
        public.is_admin()
        OR EXISTS (
          SELECT 1 FROM public.stores s
          WHERE s.id = store_id
            AND s.neighborhood_id = public.moderator_neighborhood_id()
        )
      )
    )
  );