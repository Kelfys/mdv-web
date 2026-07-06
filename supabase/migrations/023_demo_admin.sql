-- Admin demo com e-mail confirmado para login em /conta/entrar e /admin/entrar
-- Idempotente: pode rodar mais de uma vez

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.seed_demo_admin(
  p_id UUID,
  p_email TEXT,
  p_name TEXT,
  p_password TEXT DEFAULT 'MarecAdmin2026!'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE email = p_email LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      p_id,
      'authenticated',
      'authenticated',
      p_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', p_name, 'role', 'admin'),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
    v_id := p_id;
  ELSE
    UPDATE auth.users
    SET
      encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      raw_user_meta_data = jsonb_build_object('name', p_name, 'role', 'admin'),
      updated_at = NOW()
    WHERE id = v_id;
  END IF;

  INSERT INTO public.users (id, name, email, role)
  VALUES (v_id, p_name, p_email, 'admin')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = 'admin';

  INSERT INTO public.admin_user_passwords (user_id, password)
  VALUES (v_id, p_password)
  ON CONFLICT (user_id) DO UPDATE SET
    password = EXCLUDED.password,
    updated_at = NOW();

  RETURN v_id;
END;
$$;

SELECT public.seed_demo_admin(
  '99999999-9999-4999-8999-999999999000',
  'brunopdaraujo@gmail.com',
  'Bruno Admin'
);