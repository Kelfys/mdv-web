# MaredeVendas

Marketplace local de lojas — **HTML, CSS e JavaScript vanilla** com backend [Supabase](https://supabase.com). Clientes exploram lojas, montam o carrinho e finalizam o pedido pelo **WhatsApp**. Não há pagamento in-app.

**Site em produção:** https://kelfys.github.io/MaredeVendas-vanilla/

---

## Funcionalidades

| Papel | O que pode fazer |
|-------|------------------|
| **Visitante** | Ver feed de lojas e produtos (abas **Para você** e **Anúncios**), buscar, adicionar ao carrinho e pedir pelo WhatsApp |
| **Cliente** | Dashboard em **Minha conta** (`/favoritos`): favoritos, produtos curtidos, histórico de pedidos e perfil editável; curtir/comentar produtos; checkout com dados pré-preenchidos |
| **Lojista** | Painel com produtos, pedidos, anúncios e configurações (após aprovação do admin); **logo da loja** em qualquer plano; **banner personalizado** só em planos pagos |
| **Moderador** | Aprovações e pedidos **do bairro atribuído**; lojas/produtos somente leitura na região |
| **Admin** | Métricas globais, gestão de **bairros**, moderadores por região, lojistas e configuração |

---

## Stack

- **Frontend:** ES Modules nativos, lazy-load de páginas, sem bundler
- **Roteamento:** Hash (`#/rota`) em produção e local — único modo confiável no GitHub Pages
- **Backend:** Supabase (Auth, PostgreSQL, Storage, Row Level Security)
- **Deploy:** GitHub Pages via `peaceiris/actions-gh-pages` (branch `gh-pages`)
- **Testes:** Vitest (`npm test`)
- **Fonte:** [Inter](https://fonts.google.com/specimen/Inter) (Google Fonts)

---

## Estrutura do projeto

```
maredevendas-vanilla/
├── index.html              # Shell HTML — cache bust em app.js/styles.css no deploy
├── 404.html                # Fallback SPA para rotas diretas no GitHub Pages
├── css/styles.css          # Estilos globais e componentes
├── js/
│   ├── app.js              # Boot, registro de rotas e lazy-load de páginas
│   ├── router.js           # Roteador SPA (History ou hash)
│   ├── state.js            # Estado global (tema, auth, carrinho)
│   ├── config.js           # Credenciais Supabase e constantes
│   ├── db.js               # Cliente Supabase (CDN ESM)
│   ├── api.js              # Camada de acesso a dados
│   ├── feed.js             # Algoritmo do feed da home
│   ├── payment.js          # Formas de pagamento no checkout
│   ├── ui.js               # Header, carrinho, cards e checkout
│   ├── utils.js            # Formatação, escape HTML, validação de idade
│   ├── neighborhood.js     # Seleção de bairro no feed e escopo do moderador
│   ├── merchant-nav.js     # Menu do painel do lojista
│   ├── staff-nav.js        # Menu dos painéis admin e moderador
│   └── pages/              # Uma página por rota
├── supabase/migrations/    # Migrations SQL (001 → 033)
├── tests/                  # Testes unitários (Vitest)
└── .github/workflows/
    └── deploy.yml          # Pipeline de deploy para GitHub Pages
```

---

## Desenvolvimento local

### Pré-requisitos

- Navegador moderno com suporte a ES Modules
- Servidor HTTP local (módulos não funcionam com `file://`)
- Projeto Supabase configurado

### 1. Subir servidor local

```bash
python -m http.server 8080
# ou: npx serve -l 8080
```

Acesse: http://localhost:8080

### 2. Configurar Supabase

**Projeto:** `ulpjsxmilumqedkkfuqw` — https://ulpjsxmilumqedkkfuqw.supabase.co

```bash
npx supabase login
npx supabase link --project-ref ulpjsxmilumqedkkfuqw
npx supabase db push
```

Ou execute cada arquivo em `supabase/migrations/` no **SQL Editor** (ordem numérica).

**Authentication → URL Configuration:**

| Campo | Valor |
|-------|--------|
| Site URL (prod) | `https://kelfys.github.io/MaredeVendas-vanilla/` |
| Redirect URLs | `https://kelfys.github.io/MaredeVendas-vanilla/#/auth/callback` |
| | `https://kelfys.github.io/MaredeVendas-vanilla/` |
| Local | `http://localhost:8080` |

Credenciais em `js/config.js` (chave **publishable** / anon — pública por design):

```js
export const SUPABASE_URL = 'https://ulpjsxmilumqedkkfuqw.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_...'
```

**Nunca** commite `service_role` nem secret keys.

### 3. Testes

```bash
npm test
```

---

## Contas demo (produção / migrations 012, 021, 023, 024)

| Papel | Email | Senha |
|-------|-------|-------|
| Cliente | `cliente@maredevendas.com` | `DemoCliente2026!` |
| Lojista | `demo-pet-2@maredevendas.com` | `DemoLojista2026!` |
| Admin | `brunopdaraujo@gmail.com` | `MarecAdmin2026!` |
| Moderador | `moderador@maredevendas.com` | `DemoModerador2026!` |

O moderador demo está vinculado ao bairro **Copacabana** (migration `033`). Login em `#/moderador/entrar`.

---

## Autenticação

- **Login unificado** em `/conta/entrar` (e alias `/lojista/entrar`): mesma tela para cliente, lojista, admin e moderador
- Após login, redirecionamento automático por papel: `/favoritos`, `/dashboard`, `/admin` ou `/moderador`
- Parâmetro `?redirect=` funciona para clientes (ex.: voltar à loja após login)
- **Esqueci minha senha** na tela de login (email do formulário → link por email)
- **Cadastro de cliente** em `/conta/criar` exige data de nascimento (18+), validada no front, API e banco
- **Cadastro de loja** em `/lojista/cadastro` (link na tela de login)
- Admin e moderador têm telas dedicadas em `/admin/entrar` e `/moderador/entrar` (com recuperação de senha)

### Login com Google (opcional)

Botões na UI em `/conta/entrar`, `/conta/criar` e `/lojista/cadastro`. **Requer configuração manual no Supabase** — o código já está pronto; sem isso aparece `provider is not enabled`.

#### 1. Google Cloud Console

1. **APIs & Services → Credentials → OAuth client ID** (Web application)
2. **Authorized JavaScript origins:**
   - `https://kelfys.github.io`
   - `https://ulpjsxmilumqedkkfuqw.supabase.co`
3. **Authorized redirect URIs** (apenas Supabase, não o GitHub Pages):
   - `https://ulpjsxmilumqedkkfuqw.supabase.co/auth/v1/callback`

#### 2. Supabase Dashboard

1. **Authentication → Providers → Google:** Enable + Client ID + Client Secret → Save
2. **Authentication → URL Configuration:** Site URL e Redirect URLs (tabela acima)

#### 3. Fluxo no app

1. Usuário clica no botão Google → `signInWithGoogle()` em `js/api.js`
2. Google redireciona com `?code=` → `handleAuthCallback()` em `js/app.js`
3. Rota `#/auth/callback` envia para `oauth-next` (ex.: `/favoritos` ou `/lojista/cadastro`)
4. Cadastro de loja com Google: `completeOAuthSignup()` promove `customer` → `merchant`

### Navegação (header)

- **Desktop:** `Início · Entrar` (pills no menu; Entrar só para visitantes)
- **Mobile:** `Início` e `Entrar` no topo do menu hambúrguer (☰)
- Logado: **👤 Minha conta** (cliente), painel do lojista/admin/moderador ou sair conforme o papel
- Painéis admin/moderador/lojista: link **← Voltar ao site** (feed)

---

## Deploy

Deploy automático ao fazer push na `main` (após testes passarem no CI).

O workflow (`.github/workflows/deploy.yml`):

1. `npm ci` + `npm test` (Vitest)
2. Copia `index.html`, `css/`, `js/`, `favicon.svg` e `404.html` para `dist/`
3. Injeta `?v=<commit>` em todos os `.js` e em `styles.css` (cache bust)
4. Gera shells SPA por rota (`copy-spa-shells.sh`) para deep links no GitHub Pages
5. Publica na branch `gh-pages` via Peaceiris

**Deploy manual:**

```bash
gh workflow run deploy.yml
```

---

## Rotas principais

| Rota | Página |
|------|--------|
| `/` | Feed de lojas e produtos (abas **Para você** / **Anúncios**) |
| `/loja/:slug` | Página pública da loja |
| `/conta/entrar` | Login unificado |
| `/conta/criar` | Cadastro do cliente (com data de nascimento) |
| `/lojista/cadastro` | Cadastro de loja |
| `/dashboard` | Painel do lojista |
| `/admin/entrar` | Login admin |
| `/admin` | Painel admin |
| `/admin/bairros` | Gestão de bairros/regiões (só admin) |
| `/admin/moderadores` | Promover moderadores e atribuir bairro |
| `/moderador/entrar` | Login moderador |
| `/moderador` | Painel moderador (escopo regional) |
| `/moderador/aprovacoes` | Aprovar lojas e planos do bairro |
| `/moderador/lojas` | Lojas do bairro (somente leitura) |
| `/moderador/produtos` | Produtos do bairro (somente leitura) |
| `/moderador/pedidos` | Pedidos das lojas do bairro |
| `/moderador/conta` | Perfil e região atribuída |
| `/favoritos` | Dashboard do cliente (favoritos, curtidos, pedidos, perfil) |
| `/regras` | Regras e planos |
| `/auth/callback` | Retorno OAuth Google / recovery de senha |

> Rotas sempre em hash: `https://kelfys.github.io/MaredeVendas-vanilla/#/conta/entrar`. O `404.html` redireciona rotas diretas para `/#/rota`.

---

## Bairros e moderadores regionais

A plataforma é **multi-bairro**: um único site, várias regiões. O admin controla tudo; cada moderador opera só no bairro atribuído.

### Hierarquia

```
Admin (visão global)
  └── Bairros (Copacabana, Ipanema, …)
        └── Moderador regional (1 bairro)
              └── Lojas e pedidos daquele bairro
```

### Modelo de dados (migration `033`)

| Tabela / coluna | Função |
|-----------------|--------|
| `neighborhoods` | Bairros/regiões (nome, slug, cidade, UF, ativo) |
| `stores.neighborhood_id` | Loja pertence a um bairro (obrigatório no cadastro) |
| `users.neighborhood_id` | Moderador vinculado a um bairro |

Bairros demo no Rio (seed na migration): **Copacabana**, **Ipanema**, **Leblon**, **Centro**, **Tijuca**. Lojas antigas foram vinculadas a Copacabana.

### Marketplace (visitante / cliente)

- Na **home**, chips de bairro filtram lojas, produtos e anúncios
- A escolha fica salva no navegador (`js/neighborhood.js`)
- Sem bairro selecionado, o primeiro bairro ativo é usado automaticamente

### Admin

| Aba | Rota | O que faz |
|-----|------|-----------|
| **Bairros** | `#/admin/bairros` | Criar região (nome, cidade, UF); ativar/desativar |
| **Moderadores** | `#/admin/moderadores` | Promover usuário existente **com bairro obrigatório**; alterar região depois; permissão de aprovar mudança de plano |
| **Lojas** | `#/admin/lojas` | Ver/editar bairro de cada loja |

### Moderador regional

- Login: `#/moderador/entrar`
- Painel mostra a **região atribuída** no topo e em **Minha conta**
- **Aprovações:** só cadastros de loja e pedidos de plano de lojas do seu bairro
- **Lojas / Produtos:** somente leitura, já filtrados pela região
- **Pedidos:** só pedidos de lojas do bairro
- Segurança reforçada por **RLS** no Supabase (`moderator_neighborhood_id()`)

Moderadores com permissão **“Pode aprovar planos”** (checkbox no admin) analisam mudanças de plano **apenas das lojas do bairro deles**.

### Cadastro de loja

Em `#/lojista/cadastro`, o lojista escolhe **Bairro / região** antes de enviar. A aprovação cai na fila do moderador daquele bairro.

### Promover um moderador (admin)

1. O usuário precisa existir (cadastro em `/conta/criar` ou login Google)
2. Admin → **Moderadores** (`#/admin/moderadores`)
3. Informar email, escolher **bairro** e marcar “Pode aprovar planos” se necessário
4. O moderador passa a ver só lojas, produtos, pedidos e aprovações daquele bairro

### Arquivos relevantes

- `supabase/migrations/033_neighborhoods.sql` — schema, seed e políticas RLS
- `js/neighborhood.js` — seleção no feed e `getStaffNeighborhoodScope()`
- `js/api.js` — `fetchNeighborhoods`, `createNeighborhood`, `promoteUserToModerator(email, neighborhoodId)`
- `js/pages/admin.js` — abas Bairros e Moderadores
- `js/pages/home.js` — seletor de bairro no feed
- `js/staff-nav.js` — menu dos painéis admin e moderador
- `tests/neighborhood.test.js` — testes de escopo e persistência do bairro

---

## Imagens da loja (por plano)

| Recurso | Gratuito | Starter / Plus / Premium |
|---------|----------|---------------------------|
| **Logo** (foto de perfil) | Sim | Sim |
| **Banner** personalizado | Não (cor/tema padrão) | Sim |

Regras em `js/plans.js` (`planAllowsStoreLogo`, `planAllowsStoreBanner`). Upload validado em `js/api.js`; UI em **Dashboard → Configurações** e no painel admin.

---

## Fluxo de pedido

1. Cliente navega até uma loja aprovada
2. Adiciona produtos ao carrinho (uma loja por vez)
3. Escolhe forma de pagamento e preenche nome, telefone e endereço
4. O pedido é salvo no Supabase (`orders` + `order_items`); se o cliente estiver logado, `orders.user_id` vincula o pedido à conta (migration `032`)
5. WhatsApp abre com a mensagem formatada para o lojista
6. Cliente logado vê o histórico em **Minha conta → Pedidos** (pedidos anteriores à migration `032` não têm `user_id`)

---

## Manutenção

### Nova página

1. Crie `js/pages/minha-pagina.js` com `export async function renderMinhaPagina(main) { ... }`
2. Registre em `js/app.js` com `registerRoute`
3. Adicione link em `js/ui.js` se for rota pública

### Nova migration

1. Crie `supabase/migrations/034_descricao.sql` (próximo número sequencial)
2. `npx supabase db push` ou SQL Editor
3. Atualize `api.js` e a UI conforme necessário

**Últimas migrations:**

- `033_neighborhoods.sql` — bairros, escopo regional de moderadores e RLS
- `032_customer_orders.sql` — `user_id` em pedidos e histórico do cliente

---

## Melhorias futuras

- [ ] Ativar Google OAuth em produção (Supabase Providers — ver seção acima)
- [ ] Notificações em tempo real (Supabase Realtime) para novos pedidos
- [ ] Integração de pagamento/assinatura (Stripe)
- [ ] Service Worker para cache offline
- [ ] Testes E2E automatizados no CI (Playwright)
- [ ] Paginação no feed e listagens longas

---

## Licença

Projeto privado — uso conforme acordado com os mantenedores.