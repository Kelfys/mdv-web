-- P0 C3: remove vault de senhas em texto plano
-- Senhas ficam apenas no Supabase Auth (bcrypt), nunca em public.*

DROP POLICY IF EXISTS "Admin can read user passwords" ON public.admin_user_passwords;
DROP POLICY IF EXISTS "Users can store own password" ON public.admin_user_passwords;
DROP POLICY IF EXISTS "Users and admin can update password record" ON public.admin_user_passwords;

REVOKE ALL ON FUNCTION public.save_user_password_for_admin(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_user_password_for_admin(TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION public.save_user_password_for_admin(TEXT) FROM anon;
DROP FUNCTION IF EXISTS public.save_user_password_for_admin(TEXT);

DROP TABLE IF EXISTS public.admin_user_passwords;
