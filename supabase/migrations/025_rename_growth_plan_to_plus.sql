-- Renomeia o plano growth → plus no enum subscription_plan_id

ALTER TYPE public.subscription_plan_id RENAME VALUE 'growth' TO 'plus';