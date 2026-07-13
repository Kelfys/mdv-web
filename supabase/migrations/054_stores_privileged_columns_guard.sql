-- P0 C2: impede lojista de autoaprovar loja / auto-Premium
-- Owner: só campos de vitrine/contato
-- Staff (moderador): status / subscription_status / approved_at (fila de aprovação)
-- Admin: tudo (plan_id, expires, owner, etc.)

CREATE OR REPLACE FUNCTION public.enforce_stores_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Ninguém além de admin troca dono da loja
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'not allowed to change store owner'
      USING ERRCODE = '42501';
  END IF;

  -- Staff regional: pode aprovar/rejeitar, não muda plano nem vencimento
  IF public.is_staff() THEN
    IF NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
      RAISE EXCEPTION 'only admin can change plan_id'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at THEN
      RAISE EXCEPTION 'only admin can change subscription_expires_at'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Dono / demais: congela colunas privilegiadas
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
     OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
  THEN
    RAISE EXCEPTION 'not allowed to change privileged store fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stores_privileged_columns ON public.stores;
CREATE TRIGGER trg_stores_privileged_columns
  BEFORE UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_stores_privileged_columns();

COMMENT ON FUNCTION public.enforce_stores_privileged_columns() IS
  'P0 C2: bloqueia autoaprovacao e auto-plano; staff so aprova; admin total';
