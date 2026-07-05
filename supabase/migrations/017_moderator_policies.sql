-- Papel moderador (parte 2): funções, RLS e trigger

CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'moderator'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
  SELECT public.is_admin() OR public.is_moderator();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Anyone can read approved stores" ON public.stores;
CREATE POLICY "Anyone can read approved stores" ON public.stores
  FOR SELECT USING (
    owner_id = auth.uid()
    OR public.is_staff()
    OR (
      status = 'approved'
      AND subscription_status IN ('active', 'trialing')
    )
  );

DROP POLICY IF EXISTS "Owners can update own stores" ON public.stores;
CREATE POLICY "Owners can update own stores" ON public.stores
  FOR UPDATE USING (owner_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "Anyone can read active products of approved stores" ON public.products;
CREATE POLICY "Anyone can read active products of approved stores" ON public.products
  FOR SELECT USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = store_id AND s.owner_id = auth.uid()
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

DROP POLICY IF EXISTS "Store owners can manage products" ON public.products;
CREATE POLICY "Store owners can manage products" ON public.products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Store owners and admin can read orders" ON public.orders;
CREATE POLICY "Store owners and staff can read orders" ON public.orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "Read order items with order access" ON public.order_items;
CREATE POLICY "Read order items with order access" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.stores s ON s.id = o.store_id
      WHERE o.id = order_id AND (s.owner_id = auth.uid() OR public.is_staff())
    )
  );

DROP POLICY IF EXISTS "Store owners and admin can read views" ON public.store_views;
CREATE POLICY "Store owners and staff can read views" ON public.store_views
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT USING (auth.uid() = id OR public.is_staff());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_value user_role;
  delivery_value delivery_period;
BEGIN
  IF NEW.email = 'brunopdaraujo@gmail.com' THEN
    user_role_value := 'admin';
  ELSE
    user_role_value := COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'role', '')::user_role,
      'customer'::user_role
    );
    IF user_role_value IN ('admin', 'moderator') THEN
      user_role_value := 'customer';
    END IF;
  END IF;

  delivery_value := NULL;
  IF NULLIF(NEW.raw_user_meta_data->>'delivery_period', '') IS NOT NULL THEN
    delivery_value := (NEW.raw_user_meta_data->>'delivery_period')::delivery_period;
  END IF;

  INSERT INTO public.users (id, name, email, role, phone, address, delivery_period)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    user_role_value,
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'address', ''),
    delivery_value
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = CASE
      WHEN EXCLUDED.email = 'brunopdaraujo@gmail.com' THEN 'admin'::user_role
      WHEN public.users.role = 'admin' AND EXCLUDED.email <> 'brunopdaraujo@gmail.com' THEN 'customer'::user_role
      ELSE public.users.role
    END,
    phone = EXCLUDED.phone,
    address = EXCLUDED.address,
    delivery_period = EXCLUDED.delivery_period;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user failed for %: %', NEW.email, SQLERRM;
    RAISE;
END;
$$;