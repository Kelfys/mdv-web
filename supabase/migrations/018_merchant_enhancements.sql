-- Melhorias do painel do lojista: histórico de preços, cooldown e status de pedidos

CREATE TABLE IF NOT EXISTS public.product_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  old_price NUMERIC(10, 2) NOT NULL,
  new_price NUMERIC(10, 2) NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_price_history_product_id
  ON public.product_price_history(product_id, changed_at DESC);

ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store owners can read price history" ON public.product_price_history;
CREATE POLICY "Store owners can read price history" ON public.product_price_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      WHERE p.id = product_id AND (s.owner_id = auth.uid() OR public.is_admin() OR public.is_moderator())
    )
  );

CREATE OR REPLACE FUNCTION public.log_product_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.price IS DISTINCT FROM OLD.price THEN
    INSERT INTO public.product_price_history (product_id, old_price, new_price)
    VALUES (OLD.id, OLD.price, NEW.price);
    NEW.price_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_price_change ON public.products;
CREATE TRIGGER trg_product_price_change
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.log_product_price_change();

DROP POLICY IF EXISTS "Store owners can update own orders" ON public.orders;
CREATE POLICY "Store owners can update own orders" ON public.orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = store_id AND s.owner_id = auth.uid()
    )
    OR public.is_admin()
    OR public.is_moderator()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = store_id AND s.owner_id = auth.uid()
    )
    OR public.is_admin()
    OR public.is_moderator()
  );