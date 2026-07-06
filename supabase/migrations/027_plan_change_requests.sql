-- Pedidos de mudança de plano e permissão de moderadores para aprovar.

DO $$ BEGIN
  CREATE TYPE plan_change_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS can_approve_plan_changes BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.plan_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  requested_plan_id public.subscription_plan_id NOT NULL,
  current_plan_id public.subscription_plan_id NOT NULL,
  status plan_change_request_status NOT NULL DEFAULT 'pending',
  merchant_note TEXT,
  review_note TEXT,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_plan_change_requests_status ON public.plan_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_plan_change_requests_store ON public.plan_change_requests(store_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_change_requests_store_pending
  ON public.plan_change_requests(store_id)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.can_approve_plan_change_requests()
RETURNS BOOLEAN AS $$
  SELECT public.is_admin() OR (
    public.is_moderator() AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND can_approve_plan_changes = true
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

ALTER TABLE public.plan_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants create plan change requests" ON public.plan_change_requests;
CREATE POLICY "Merchants create plan change requests" ON public.plan_change_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = store_id AND s.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Read plan change requests" ON public.plan_change_requests;
CREATE POLICY "Read plan change requests" ON public.plan_change_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = store_id AND s.owner_id = auth.uid()
    )
    OR public.can_approve_plan_change_requests()
  );

DROP POLICY IF EXISTS "Review plan change requests" ON public.plan_change_requests;
CREATE POLICY "Review plan change requests" ON public.plan_change_requests
  FOR UPDATE USING (public.can_approve_plan_change_requests());