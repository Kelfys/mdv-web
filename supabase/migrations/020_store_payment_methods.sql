-- Formas de pagamento aceitas por loja no checkout do carrinho
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS payment_methods TEXT[] NOT NULL
  DEFAULT ARRAY['pix', 'cash', 'card', 'transfer']::TEXT[];

COMMENT ON COLUMN public.stores.payment_methods IS 'pix | cash | card | transfer — opções exibidas no carrinho';