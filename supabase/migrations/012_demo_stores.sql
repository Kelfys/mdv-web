-- Lojas de exemplo: 2 por categoria (16 lojas) + produtos demo
-- Idempotente: pode rodar mais de uma vez

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.seed_demo_merchant(
  p_id UUID,
  p_email TEXT,
  p_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_id) THEN
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
      extensions.crypt('DemoLojista2026!', extensions.gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', p_name, 'role', 'merchant'),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
  END IF;

  INSERT INTO public.users (id, name, email, role)
  VALUES (p_id, p_name, p_email, 'merchant')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = 'merchant';

  INSERT INTO public.admin_user_passwords (user_id, password)
  VALUES (p_id, 'DemoLojista2026!')
  ON CONFLICT (user_id) DO UPDATE SET
    password = EXCLUDED.password,
    updated_at = NOW();

  RETURN p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_demo_store(
  p_id UUID,
  p_owner_id UUID,
  p_slug TEXT,
  p_name TEXT,
  p_description TEXT,
  p_whatsapp TEXT,
  p_city TEXT,
  p_category_slug TEXT,
  p_theme_color TEXT,
  p_opening_hours TEXT DEFAULT 'Seg–Sáb 8h–20h'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_id UUID;
BEGIN
  SELECT id INTO v_category_id FROM public.categories WHERE slug = p_category_slug LIMIT 1;

  INSERT INTO public.stores (
    id, owner_id, name, slug, description, whatsapp,
    address, city, state, category_id, opening_hours,
    status, plan_id, subscription_status, approved_at, theme_color
  ) VALUES (
    p_id,
    p_owner_id,
    p_name,
    p_slug,
    p_description,
    p_whatsapp,
    'Rua das Flores, 100',
    p_city,
    'RJ',
    v_category_id,
    p_opening_hours,
    'approved',
    'free',
    'active',
    NOW(),
    p_theme_color
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category_id = EXCLUDED.category_id,
    status = 'approved',
    subscription_status = 'active',
    theme_color = EXCLUDED.theme_color;

  RETURN p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_demo_product(
  p_store_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_price NUMERIC,
  p_stock INTEGER DEFAULT 20
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE store_id = p_store_id AND name = p_name
  ) THEN
    INSERT INTO public.products (store_id, name, description, price, stock, active)
    VALUES (p_store_id, p_name, p_description, p_price, p_stock, true);
  END IF;
END;
$$;

-- Merchants (UUIDs fixos para idempotência)
SELECT public.seed_demo_merchant('11111111-1111-4111-8111-111111110001', 'demo-alimentacao-1@maredevendas.com', 'José Mercearia');
SELECT public.seed_demo_merchant('11111111-1111-4111-8111-111111110002', 'demo-alimentacao-2@maredevendas.com', 'Ana Padaria');
SELECT public.seed_demo_merchant('11111111-1111-4111-8111-111111110003', 'demo-bebidas-1@maredevendas.com', 'Carlos Gelada');
SELECT public.seed_demo_merchant('11111111-1111-4111-8111-111111110004', 'demo-bebidas-2@maredevendas.com', 'Rita Adega');
SELECT public.seed_demo_merchant('11111111-1111-4111-8111-111111110005', 'demo-moda-1@maredevendas.com', 'Maria Boutique');
SELECT public.seed_demo_merchant('11111111-1111-4111-8111-111111110006', 'demo-moda-2@maredevendas.com', 'Lucas Street');
SELECT public.seed_demo_merchant('11111111-1111-4111-8111-111111110007', 'demo-eletronicos-1@maredevendas.com', 'Tech Marec');
SELECT public.seed_demo_merchant('11111111-1111-4111-8111-111111110008', 'demo-eletronicos-2@maredevendas.com', 'Paulo Celular');
SELECT public.seed_demo_merchant('11111111-1111-4111-8111-111111110009', 'demo-servicos-1@maredevendas.com', 'Marcos Conserto');
SELECT public.seed_demo_merchant('11111111-1111-4111-8111-111111110010', 'demo-servicos-2@maredevendas.com', 'Fernanda Lavanderia');
SELECT public.seed_demo_merchant('11111111-1111-4111-8111-111111110011', 'demo-saude-1@maredevendas.com', 'Dra. Farmácia');
SELECT public.seed_demo_merchant('11111111-1111-4111-8111-111111110012', 'demo-saude-2@maredevendas.com', 'Juliana Salão');
SELECT public.seed_demo_merchant('11111111-1111-4111-8111-111111110013', 'demo-casa-1@maredevendas.com', 'Roberto Casa');
SELECT public.seed_demo_merchant('11111111-1111-4111-8111-111111110014', 'demo-casa-2@maredevendas.com', 'Patrícia Móveis');
SELECT public.seed_demo_merchant('11111111-1111-4111-8111-111111110015', 'demo-pet-1@maredevendas.com', 'Amanda Pet');
SELECT public.seed_demo_merchant('11111111-1111-4111-8111-111111110016', 'demo-pet-2@maredevendas.com', 'Bruno Animal');

-- Lojas (2 por categoria)
SELECT public.seed_demo_store('22222222-2222-4222-8222-222222220001', '11111111-1111-4111-8111-111111110001', 'mercearia-do-ze', 'Mercearia do Zé', 'Produtos frescos e mantimentos do dia a dia.', '5521975111101', 'Rio de Janeiro', 'alimentacao', 'pixel-green');
SELECT public.seed_demo_store('22222222-2222-4222-8222-222222220002', '11111111-1111-4111-8111-111111110002', 'padaria-pao-quente', 'Padaria Pão Quente', 'Pães artesanais, bolos e café da manhã.', '5521975111102', 'Niterói', 'alimentacao', 'pixel-orange');

SELECT public.seed_demo_store('22222222-2222-4222-8222-222222220003', '11111111-1111-4111-8111-111111110003', 'distribuidora-gelada', 'Distribuidora Gelada', 'Refrigerantes, sucos e bebidas geladas.', '5521975111103', 'Rio de Janeiro', 'bebidas', 'pixel-cyan');
SELECT public.seed_demo_store('22222222-2222-4222-8222-222222220004', '11111111-1111-4111-8111-111111110004', 'adega-do-vale', 'Adega do Vale', 'Vinhos, cervejas especiais e destilados.', '5521975111104', 'Petrópolis', 'bebidas', 'pixel-purple');

SELECT public.seed_demo_store('22222222-2222-4222-8222-222222220005', '11111111-1111-4111-8111-111111110005', 'boutique-maria', 'Boutique Maria', 'Roupas femininas e acessórios da estação.', '5521975111105', 'Rio de Janeiro', 'moda', 'pixel-pink');
SELECT public.seed_demo_store('22222222-2222-4222-8222-222222220006', '11111111-1111-4111-8111-111111110006', 'moda-jovem-street', 'Moda Jovem Street', 'Streetwear, tênis e looks urbanos.', '5521975111106', 'São Gonçalo', 'moda', 'pixel-red');

SELECT public.seed_demo_store('22222222-2222-4222-8222-222222220007', '11111111-1111-4111-8111-111111110007', 'tech-marec', 'Tech Marec', 'Celulares, acessórios e assistência técnica.', '5521975286720', 'Rio de Janeiro', 'eletronicos', 'pixel-blue');
SELECT public.seed_demo_store('22222222-2222-4222-8222-222222220008', '11111111-1111-4111-8111-111111110008', 'celular-e-cia', 'Celular & Cia', 'Smartphones, capinhas e fones de ouvido.', '5521975111108', 'Duque de Caxias', 'eletronicos', 'pixel-cyan');

SELECT public.seed_demo_store('22222222-2222-4222-8222-222222220009', '11111111-1111-4111-8111-111111110009', 'conserto-rapido', 'Conserto Rápido', 'Manutenção de eletrodomésticos e eletrônicos.', '5521975111109', 'Rio de Janeiro', 'servicos', 'pixel-yellow');
SELECT public.seed_demo_store('22222222-2222-4222-8222-222222220010', '11111111-1111-4111-8111-111111110010', 'lavanderia-express', 'Lavanderia Express', 'Lavagem, passadoria e delivery de roupas.', '5521975111110', 'Niterói', 'servicos', 'pixel-green');

SELECT public.seed_demo_store('22222222-2222-4222-8222-222222220011', '11111111-1111-4111-8111-111111110011', 'farmacia-popular', 'Farmácia Popular', 'Medicamentos, higiene e perfumaria.', '5521975111111', 'Rio de Janeiro', 'saude-beleza', 'pixel-blue');
SELECT public.seed_demo_store('22222222-2222-4222-8222-222222220012', '11111111-1111-4111-8111-111111110012', 'salao-beleza-total', 'Salão Beleza Total', 'Corte, coloração, manicure e estética.', '5521975111112', 'Rio de Janeiro', 'saude-beleza', 'pixel-pink');

SELECT public.seed_demo_store('22222222-2222-4222-8222-222222220013', '11111111-1111-4111-8111-111111110013', 'casa-e-estilo', 'Casa & Estilo', 'Utensílios, decoração e organização.', '5521975111113', 'Rio de Janeiro', 'casa-decoracao', 'pixel-orange');
SELECT public.seed_demo_store('22222222-2222-4222-8222-222222220014', '11111111-1111-4111-8111-111111110014', 'moveis-noroeste', 'Móveis Noroeste', 'Móveis planejados e colchões.', '5521975111114', 'Duque de Caxias', 'casa-decoracao', 'pixel-purple');

SELECT public.seed_demo_store('22222222-2222-4222-8222-222222220015', '11111111-1111-4111-8111-111111110015', 'pet-love', 'Pet Love', 'Ração, brinquedos e acessórios para pets.', '5521975111115', 'Rio de Janeiro', 'pet-shop', 'pixel-green');
SELECT public.seed_demo_store('22222222-2222-4222-8222-222222220016', '11111111-1111-4111-8111-111111110016', 'mundo-animal', 'Mundo Animal', 'Banho, tosa e produtos para cães e gatos.', '5521975111116', 'Niterói', 'pet-shop', 'pixel-yellow');

-- Produtos demo (3 por loja)
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220001', 'Arroz 5kg', 'Arroz branco tipo 1.', 24.90);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220001', 'Feijão Carioca 1kg', 'Feijão selecionado.', 8.50);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220001', 'Leite Integral 1L', 'Leite UHT integral.', 5.20);

SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220002', 'Pão Francês (6un)', 'Pães frescos do forno.', 12.00);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220002', 'Bolo de Chocolate', 'Fatia generosa.', 9.90);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220002', 'Café Expresso', 'Café coado na hora.', 6.00);

SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220003', 'Refrigerante 2L', 'Diversos sabores.', 9.50);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220003', 'Água Mineral 1,5L', 'Pack com 6 unidades.', 18.00);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220003', 'Suco de Laranja 1L', 'Suco integral.', 11.90);

SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220004', 'Vinho Tinto Suave', 'Garrafa 750ml.', 39.90);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220004', 'Cerveja Artesanal', 'Long neck 355ml.', 14.50);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220004', 'Espumante Brut', 'Para celebrações.', 59.00);

SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220005', 'Vestido Floral M', 'Tecido leve de verão.', 129.90);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220005', 'Bolsa de Couro', 'Bolsa transversal.', 89.00);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220005', 'Sandália Rasteira', 'Confortável para o dia a dia.', 59.90);

SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220006', 'Camiseta Oversized', 'Algodão premium.', 79.90);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220006', 'Tênis Casual', 'Solado antiderrapante.', 199.00);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220006', 'Boné Street', 'Ajuste traseiro.', 49.90);

SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220007', 'Fone Bluetooth', 'Cancelamento de ruído.', 149.90);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220007', 'Carregador Turbo USB-C', 'Carga rápida 25W.', 59.00);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220007', 'Película de Vidro', 'Instalação inclusa.', 29.90);

SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220008', 'Smartphone Android', '128GB, tela 6.5".', 899.00);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220008', 'Capinha Silicone', 'Diversas cores.', 25.00);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220008', 'Power Bank 10000mAh', 'Duas saídas USB.', 79.90);

SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220009', 'Conserto Micro-ondas', 'Orçamento sem compromisso.', 80.00);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220009', 'Manutenção Ar Condicionado', 'Limpeza completa.', 150.00);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220009', 'Reparo Notebook', 'Diagnóstico em 24h.', 120.00);

SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220010', 'Lavagem Simples (kg)', 'Roupas do dia a dia.', 12.00);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220010', 'Passadoria (peça)', 'Camisas e calças.', 8.00);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220010', 'Higienização Edredom', 'Edredom casal.', 45.00);

SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220011', 'Vitamina C 1g', 'Suplemento 30 comprimidos.', 22.90);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220011', 'Protetor Solar FPS50', 'Toque seco 120ml.', 49.90);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220011', 'Shampoo Anticaspa', 'Uso diário 400ml.', 28.50);

SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220012', 'Corte Feminino', 'Lavagem inclusa.', 70.00);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220012', 'Manicure', 'Esmaltação tradicional.', 35.00);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220012', 'Hidratação Capilar', 'Tratamento completo.', 90.00);

SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220013', 'Jogo de Panelas', '5 peças antiaderente.', 189.00);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220013', 'Luminária de Mesa', 'LED regulável.', 79.90);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220013', 'Tapete Sala 2x1,5m', 'Antiderrapante.', 149.00);

SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220014', 'Guarda-roupa 3 Portas', 'MDF com espelho.', 899.00);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220014', 'Colchão Casal', 'Molas ensacadas.', 749.00);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220014', 'Mesa de Jantar 4 lugares', 'Madeira maciça.', 599.00);

SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220015', 'Ração Premium 10kg', 'Para cães adultos.', 129.90);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220015', 'Brinquedo Mordedor', 'Borracha atóxica.', 24.90);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220015', 'Coleira Ajustável', 'Tamanho M.', 34.90);

SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220016', 'Banho e Tosa Pequeno Porte', 'Shampoo hipoalergênico.', 65.00);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220016', 'Areia Sanitária 4kg', 'Controle de odores.', 29.90);
SELECT public.seed_demo_product('22222222-2222-4222-8222-222222220016', 'Arranhador para Gatos', 'Com bolinha.', 49.00);