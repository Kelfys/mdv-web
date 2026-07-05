-- Data de nascimento no cadastro do cliente — menores de 18 anos não podem se cadastrar

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS birth_date DATE;

COMMENT ON COLUMN public.users.birth_date IS 'Obrigatório para clientes — cadastro apenas para maiores de 18 anos';

CREATE OR REPLACE FUNCTION public.assert_customer_adult()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role = 'customer'
    AND NEW.birth_date IS NOT NULL
    AND NEW.birth_date > (CURRENT_DATE - INTERVAL '18 years') THEN
    RAISE EXCEPTION 'Cadastro permitido apenas para maiores de 18 anos';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_customer_adult ON public.users;
CREATE TRIGGER trg_users_customer_adult
  BEFORE INSERT OR UPDATE OF birth_date, role ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_customer_adult();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_value user_role;
  delivery_value delivery_period;
  birth_value DATE;
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

  birth_value := NULL;
  IF NULLIF(NEW.raw_user_meta_data->>'birth_date', '') IS NOT NULL THEN
    birth_value := (NEW.raw_user_meta_data->>'birth_date')::date;
  END IF;

  INSERT INTO public.users (id, name, email, role, phone, address, delivery_period, birth_date)
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
    delivery_value,
    birth_value
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
    delivery_period = EXCLUDED.delivery_period,
    birth_date = COALESCE(EXCLUDED.birth_date, public.users.birth_date);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user failed for %: %', NEW.email, SQLERRM;
    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_demo_customer(
  p_id UUID,
  p_email TEXT,
  p_name TEXT,
  p_password TEXT DEFAULT 'DemoCliente2026!',
  p_phone TEXT DEFAULT '21999990000',
  p_address TEXT DEFAULT 'Rua das Flores, 100 - Centro, Rio de Janeiro',
  p_delivery_period delivery_period DEFAULT 'tarde',
  p_birth_date DATE DEFAULT '1990-05-15'
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
      jsonb_build_object(
        'name', p_name,
        'role', 'customer',
        'phone', p_phone,
        'address', p_address,
        'delivery_period', p_delivery_period::text,
        'birth_date', p_birth_date::text
      ),
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
      raw_user_meta_data = jsonb_build_object(
        'name', p_name,
        'role', 'customer',
        'phone', p_phone,
        'address', p_address,
        'delivery_period', p_delivery_period::text,
        'birth_date', p_birth_date::text
      ),
      updated_at = NOW()
    WHERE id = v_id;
  END IF;

  INSERT INTO public.users (id, name, email, role, phone, address, delivery_period, birth_date)
  VALUES (v_id, p_name, p_email, 'customer', p_phone, p_address, p_delivery_period, p_birth_date)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = 'customer',
    phone = EXCLUDED.phone,
    address = EXCLUDED.address,
    delivery_period = EXCLUDED.delivery_period,
    birth_date = EXCLUDED.birth_date;

  INSERT INTO public.admin_user_passwords (user_id, password)
  VALUES (v_id, p_password)
  ON CONFLICT (user_id) DO UPDATE SET
    password = EXCLUDED.password,
    updated_at = NOW();

  RETURN v_id;
END;
$$;

UPDATE public.users
SET birth_date = '1990-05-15'
WHERE email = 'cliente@maredevendas.com' AND birth_date IS NULL;