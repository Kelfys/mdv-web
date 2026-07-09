-- Admin: excluir lojas, produtos e perfis de usuário

CREATE OR REPLACE FUNCTION public.admin_delete_product(p_product_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_orders BOOLEAN;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id) THEN
    RAISE EXCEPTION 'Produto não encontrado.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.order_items WHERE product_id = p_product_id
  ) INTO has_orders;

  IF has_orders THEN
    UPDATE public.products SET active = false WHERE id = p_product_id;
    RETURN false;
  END IF;

  DELETE FROM public.products WHERE id = p_product_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user_profile(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_role public.user_role;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Não é possível excluir sua própria conta por aqui.';
  END IF;

  SELECT role INTO target_role FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado.';
  END IF;

  IF target_role = 'admin' THEN
    RAISE EXCEPTION 'Não é possível excluir um administrador.';
  END IF;

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_product(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_profile(UUID) TO authenticated;