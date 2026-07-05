-- Curtidas e comentários de produtos

CREATE TABLE public.product_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, user_id)
);

CREATE INDEX idx_product_likes_product ON public.product_likes(product_id);
CREATE INDEX idx_product_likes_user ON public.product_likes(user_id);

CREATE TABLE public.product_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(trim(content)) >= 1 AND char_length(content) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_comments_product ON public.product_comments(product_id);
CREATE INDEX idx_product_comments_created ON public.product_comments(created_at DESC);

ALTER TABLE public.product_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_comments ENABLE ROW LEVEL SECURITY;

-- Curtidas: leitura pública, escrita só para usuário autenticado (próprio registro)
CREATE POLICY "Anyone can read product likes" ON public.product_likes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can like products" ON public.product_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike own likes" ON public.product_likes
  FOR DELETE USING (auth.uid() = user_id);

-- Comentários: leitura pública, escrita só para usuário autenticado
CREATE POLICY "Anyone can read product comments" ON public.product_comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can comment on products" ON public.product_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own product comments" ON public.product_comments
  FOR DELETE USING (auth.uid() = user_id OR public.is_admin());