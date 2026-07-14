# MaredeVendas

Marketplace local de lojas — **HTML, CSS e JavaScript vanilla** com backend [Supabase](https://supabase.com). Clientes exploram lojas, montam o carrinho e finalizam o pedido pelo **WhatsApp**. Não há pagamento in-app.

**Site em produção:** https://maredevendas.com.br/  
**Espelho (GitHub Pages):** https://kelfys.github.io/MaredeVendas-vanilla/

---

## Funcionalidades

| Papel | O que pode fazer |
|-------|------------------|
| **Visitante** | Ver feed de lojas e produtos (**Para você** — anúncios Premium no mix), buscar, adicionar ao carrinho e pedir pelo WhatsApp |
| **Cliente** | Dashboard em **Minha conta** (`/favoritos`): favoritos, produtos curtidos, histórico de pedidos e perfil editável; curtir/comentar produtos; checkout com dados pré-preenchidos |
| **Lojista** | Painel com produtos, pedidos, anúncios e configurações (após aprovação do admin); **logo e banner** só em planos **pagos** (Plus/Premium); catálogo Gratuito = **1 item + 1 foto**; **anúncios no feed** só no plano **Premium** (2 inclusos/mês; extras **R$ 5** com aprovação staff) |
| **Moderador** | Aprovações (lojas, planos, **anúncios** e denúncias) e pedidos **do bairro atribuído**; lojas/produtos somente leitura na região |
| **Admin** | Métricas globais, gestão de **bairros**, moderadores por região, lojistas, **aprovação de anúncios**, **cor de alerta do logo** (`#/admin/conta`) e configuração |

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
├── strings-editor.html     # Editor visual dos textos (js/strings.js)
├── 404.html                # Fallback SPA para rotas diretas no GitHub Pages
├── css/styles.css          # Estilos globais e componentes
├── js/
│   ├── app.js              # Boot, registro de rotas e lazy-load de páginas
│   ├── strings.js          # Catálogo de textos da UI + t(), helpers i18n
│   ├── router.js           # Roteador SPA (History ou hash)
│   ├── state.js            # Estado global (tema, auth, carrinho)
│   ├── config.js           # Credenciais Supabase e constantes
│   ├── db.js               # Cliente Supabase (CDN ESM)
│   ├── api.js              # Camada de acesso a dados (erros em errors.*)
│   ├── feed.js             # Algoritmo do feed da home (lojas, produtos e anúncios no mix)
│   ├── plan-renewal.js     # Vencimento de plano (30 dias), aviso 72 h e downgrade ao Gratuito
│   ├── logo-accent.js      # Cor de alerta do “Maré” no logo (presets; admin em Conta)
│   ├── home-filters-scroll.js  # Esconde bairros/categorias da home ao rolar
│   ├── header-scroll.js    # Esconde o cabeçalho no mobile ao rolar
│   ├── scroll-to-top.js    # Botão flutuante ↑ (topo + atualizar página)
│   ├── payment.js          # Formas de pagamento no checkout
│   ├── ui.js               # Header (logo Maré de Vendas), carrinho, cards e checkout
│   ├── utils.js            # Formatação, escape HTML, validação de idade
│   ├── neighborhood.js     # Seleção de bairro no feed e escopo do moderador
│   ├── merchant-nav.js     # Menu do painel do lojista
│   ├── staff-nav.js        # Menu dos painéis admin e moderador
│   └── pages/              # Uma página por rota
├── supabase/migrations/    # Migrations SQL (001 → 057)
├── tools/                  # Scripts de DB (apply-sql, register-migration, db-push)
├── tests/                  # Testes unitários (Vitest)
└── .github/workflows/
    └── deploy.yml          # Pipeline de deploy para GitHub Pages
```

---

## Textos da interface (i18n)

Todos os rótulos, mensagens, placeholders e templates (WhatsApp, planos, regras) ficam em **`js/strings.js`**. O app não usa biblioteca de i18n — apenas o helper `t()` e o objeto `STRINGS`.

### Uso no código

```js
import { t, deliveryPeriodLabel, orderStatusLabel } from './strings.js'

t('nav.home')                              // "Início"
t('cart.itemsCount', { count: 3 })         // "Itens (3)"
deliveryPeriodLabel('manha')               // "Manhã"
```

- **UI** (`js/ui.js`, `js/pages/*`, `js/plans.js`, …): `t('secao.chave')` no HTML/innerHTML
- **Erros** (`js/api.js`, `js/utils.js`, `js/uploads.js`): chaves em `errors.*`
- **WhatsApp** (`js/whatsapp.js`): chaves em `whatsapp.*`
- Mensagens cruas do Supabase sem mapeamento em `formatAuthError()` continuam como `error.message`

### Editor visual

**`strings-editor.html`** — publicado junto com o site (ex.: `https://kelfys.github.io/MaredeVendas-vanilla/strings-editor.html`).

1. Buscar por chave ou valor
2. Editar textos (rascunho salvo em `localStorage`)
3. Baixar ou copiar o `strings.js` gerado
4. Substituir `js/strings.js` no repositório e fazer commit

Testes: `tests/strings.test.js` (resolve de chaves, placeholders, round-trip do editor).

### Nova string

1. Adicione a chave em `js/strings.js` dentro da seção adequada (`nav`, `errors`, `merchant`, …)
2. Use `t('secao.novaChave')` no código — não deixe texto PT solto no JS/HTML
3. Rode `npm test` e atualize o editor se necessário (ele importa o módulo atual)

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
npm run db:link
npm run db:push
```

**Sem login CLI:** copie `.env.example` → `.env.local`, preencha `DATABASE_URL` (senha do Postgres em Settings → Database) e rode:

```bash
npm run db:push:url
```

> Este projeto é **SPA vanilla** (`js/db.js` via CDN). Guias do dashboard para Next.js (`@supabase/ssr`), Prisma e `@supabase/server` **não se aplicam** aqui.

Ou execute cada arquivo em `supabase/migrations/` no **SQL Editor** (ordem numérica).

**Authentication → URL Configuration:**

| Campo | Valor |
|-------|--------|
| Site URL (prod) | `https://maredevendas.com.br` |
| Redirect URLs | `https://maredevendas.com.br/#/auth/callback` |
| | `https://maredevendas.com.br/` |
| | `https://www.maredevendas.com.br/#/auth/callback` |
| | `https://kelfys.github.io/MaredeVendas-vanilla/#/auth/callback` |
| | `https://kelfys.github.io/MaredeVendas-vanilla/` |
| Local | `http://localhost:8080` |

Aplicar no projeto remoto: `npx supabase config push` (valores em `supabase/config.toml`).

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

## Contas demo / seed

| Papel | Email | Senha | Plano / notas |
|-------|-------|-------|----------------|
| Cliente | `cliente@maredevendas.com` | `DemoCliente2026!` | — |
| Admin | `brunopdaraujo@gmail.com` | `MarecAdmin2026!` | global |
| Moderador | `moderador@maredevendas.com` | `DemoModerador2026!` | bairro ativo (ex.: Baixa do sapateiro) |
| **Lojas fake (seed)** | `lojasfake@gmail.com` | `LojasFake2026!` | dono de **todas** as lojas ads/seed |

O moderador demo: login em `#/moderador/entrar`.

### Lojas fake (`lojasfake@gmail.com`)

Para o marketplace parecer cheio sem misturar com usuários reais:

- Todas as lojas seed/ads ficam com **um único dono**
- Apagar esse perfil no admin (ou no SQL) remove as lojas em **cascade** (`owner_id ON DELETE CASCADE`)
- Scripts locais (pasta `scripts/`, **não versionada** — ver `.gitignore`):
  - `node scripts/seed-ads-free-stores.mjs` — cria lojas a partir de imagens
  - `node scripts/consolidate-fake-owner.mjs` — reatribui lojas fake ao dono único
  - `node scripts/cleanup-orphans.mjs` — audita/limpa lojistas sem loja, lojas/produtos órfãos

Contas `demo-gratuito@…` / `demo-plus@…` antigas **sem loja** foram removidas na limpeza de órfãos; use admin + e-mail real ou `lojasfake@` para demos.

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
   - `https://maredevendas.com.br`
   - `https://www.maredevendas.com.br`
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

- **Desktop:** `Criar loja` e `Entrar` (pills; Entrar só para visitantes)
- **Mobile:** `Criar loja` e `Entrar` no topo do menu hambúrguer (☰); carrinho 🛒 para clientes logados
- Logado: **👤 Minha conta** (cliente), painel do lojista/admin/moderador ou sair conforme o papel
- Painéis admin/moderador/lojista: link **← Voltar ao site** (feed)

### Scroll na interface

Comportamento ao rolar a página (listener `passive` em `window`):

| Recurso | Arquivo | Onde vale | Comportamento |
|---------|---------|-----------|---------------|
| **Header mobile** | `js/header-scroll.js` | Telas ≤767px | Cabeçalho some ao rolar para baixo e volta ao rolar para cima; não esconde com menu ☰ aberto |
| **Filtros da home** | `js/home-filters-scroll.js` | `#/` (bairros + categorias) | Chips somem ao rolar para baixo; a busca permanece fixa |
| **Chips bairro/categoria** | `js/pages/home.js` (`bindChipRowScroll`) | `#/` desktop e mobile | Arrastar / roda do mouse no desktop; toque no mobile; fade dinâmico nas pontas |
| **Botão ↑** | `js/scroll-to-top.js` | Global | Aparece após ~280px; clique sobe ao topo e chama `render()` (atualiza a rota) |

Classes CSS: `.header--scroll-hidden`, `.home-toolbar__filters--hidden`, `.scroll-to-top--visible`, `.category-scroll--dragging`.

Inicialização no boot (`app.js`); estados resetados a cada troca de rota (`router.js`).

### Logo e cor de alerta (admin)

O cabeçalho mostra **Maré** · **de** · **Vendas**:

| Parte | Cor |
|-------|-----|
| **Maré** | Muda com o **status de alerta** (admin) |
| **de** | Cor do texto (preto/cinza) |
| **Vendas** | Dourado fixo |

Admin → **Conta** (`#/admin/conta`) → **Cor de alerta do logo** → Aplicar no site.  
Valor público em `platform_settings.logo_accent` (migration `057`); presets: normal, promo, alerta (verde), urgente, info, rosa, preto.  
Arquivos: `js/logo-accent.js`, `css/styles.css` (`html[data-logo-accent]`), `js/app.js` (`loadLogoAccent`).

---

## Deploy

Deploy automático ao fazer push na `main` (após testes passarem no CI).

O workflow (`.github/workflows/deploy.yml`):

1. `npm ci` + `npm test` (Vitest)
2. Copia `index.html`, `strings-editor.html`, `css/`, `js/`, `favicon.svg` e `404.html` para `dist/`
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
| `/` | Feed de lojas e produtos (**Para você** — sem aba separada de anúncios) |
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

> Rotas sempre em hash: `https://maredevendas.com.br/#/conta/entrar` (ou `…github.io/MaredeVendas-vanilla/#/conta/entrar`). O `404.html` redireciona rotas diretas para `/#/rota`.

---

## Bairros e moderadores regionais

A plataforma é **multi-bairro**: um único site, várias regiões. O admin controla tudo; cada moderador opera só no bairro atribuído.

### Hierarquia

```
Admin (visão global)
  └── Bairros (regiões ativas no painel)
        └── Moderador regional (1 bairro ou todos)
              └── Lojas e pedidos daquele escopo
```

### Modelo de dados (migration `033`+)

| Tabela / coluna | Função |
|-----------------|--------|
| `neighborhoods` | Bairros/regiões (nome, slug, cidade, UF, ativo) |
| `stores.neighborhood_id` | Loja pertence a um bairro (obrigatório no cadastro) |
| `users.neighborhood_id` | Moderador vinculado a um bairro (ou null = todos, conforme fluxo atual) |
| `platform_settings` | Config pública da UI (ex.: `logo_accent`) — migration `057` |

Bairros são geridos em `#/admin/bairros` (criar, editar, ativar/desativar, excluir se vazio). O seed antigo da migration `033` (Copacabana, Ipanema, etc.) pode não refletir a produção atual.

### Marketplace (visitante / cliente)

- Na **home**, chips de bairro filtram lojas, produtos e anúncios (chip **Todos** lista todas as regiões)
- A escolha fica salva no navegador (`js/neighborhood.js`)
- Sem bairro selecionado, o primeiro bairro ativo é usado automaticamente
- Ao rolar o feed, bairros e categorias se recolhem (`home-filters-scroll.js`); no mobile o header também some (`header-scroll.js`)
- Produtos podem ser marcados como **Usado** no catálogo (`is_used`, migration `043`)

### Admin

| Aba | Rota | O que faz |
|-----|------|-----------|
| **Bairros** | `#/admin/bairros` | Criar região (nome, cidade, UF); ativar/desativar |
| **Moderadores** | `#/admin/moderadores` | Promover usuário existente **com bairro obrigatório**; alterar região depois; permissão de aprovar mudança de plano |
| **Lojas** | `#/admin/lojas` | Ver/editar bairro; **criar loja** informando o **e-mail** do dono (cliente → vira lojista; merchant precisa ainda não ter loja) |
| **Produtos** | `#/admin/produtos` | Sidebar de lojas (ordenação sem emoji) + catálogo; admin **sem cooldown** de preço |
| **Conta** | `#/admin/conta` | Senha, e-mail e **cor de alerta do logo** |

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

## Planos de assinatura (lojistas)

Limites e regras ficam em **`js/plans.js`** (`PLAN_LIMITS`, `canCreateProduct`, `canAddProductImage`, `planAllowsStoreLogo`, `planAllowsStoreBanner`). A API (`js/api.js`) e o painel do lojista bloqueiam cadastro/upload além do plano. Textos em `js/strings.js` (seção `plans.*`).

O plano **Gratuito** é ativado após aprovação do cadastro da loja. Planos pagos (Plus, Premium) são solicitados em **Dashboard → Planos** e confirmados pelo admin após comprovante.

### Plano Gratuito — limites

| Recurso | Limite |
|---------|--------|
| **Itens no catálogo** (produtos ou serviços) | **1** no total |
| **Imagens nos produtos** | **1 foto** no catálogo |
| **Logo** da loja (foto de perfil) | **Não** — só planos pagos (Plus/Premium) |
| **Banner** personalizado da vitrine | **Não** — apenas cor/tema padrão |
| **Alteração de preço** (lojista) | A cada **24 h** |
| **Alteração de preço** (admin) | **Sem espera** (bypass do cooldown) |
| **Anúncios no feed** | **Não** — exclusivo Premium |
| **Pedidos** | Via WhatsApp |
| **Ativar/ocultar** itens no catálogo | Sim |

Lojistas no Gratuito publicam **1 produto/serviço** com **1 foto**. Logo e banner exigem upgrade.

### Comparativo de catálogo (todos os planos)

| Plano | Itens | Fotos no catálogo | Logo | Banner | Anúncios no feed | Cooldown de preço (lojista) |
|-------|-------|-------------------|------|--------|------------------|-----------------------------|
| **Gratuito** | 1 | 1 | Não | Não | Não | 24 h |
| **Plus** | 6 | 6 | Sim | Sim | Não | 12 h |
| **Premium** | 30 | 30 | Sim | Sim | **2 inclusos/mês** (+ extras) | 6 h |

Detalhes de preços, destaques no feed e lista completa de benefícios: `#/regras` (seção planos) ou painel **Planos** do lojista.

### Anúncios no feed (`store_ads`)

Fluxo completo (migration `044_store_ads_approval_billing.sql`):

1. **Lojista Premium** envia anúncio em **Painel → Anúncios** → registro `pending` com **UUID** (toast exibe o ID).
2. **Slots inclusos:** até **2/mês calendário** (`is_extra = false`). Contagem só de inclusos, não extras.
3. **Acima do limite:** anúncio **extra** — taxa **R$ 5** (`STORE_AD_EXTRA_FEE`), checkbox de confirmação e link WhatsApp para comprovante; `fee_acknowledged` obrigatório na API.
4. **Admin e moderador** analisam na aba **Aprovações** (`#/admin/aprovacoes` ou `#/moderador/aprovacoes`): cards com ID, loja, mensagem, badge de taxa extra quando aplicável.
5. **Aprovação** define `approved_at` e `expires_at` = **+24 h** (`STORE_AD_DURATION_HOURS`). Só então o anúncio entra no **mix do feed** da home (`js/feed.js`).
6. **Rejeição** marca `rejected` — não aparece no feed.

| Papel | Onde age |
|-------|----------|
| Lojista | `js/pages/merchant.js` — `merchantAdsCreatePanel`, `bindAdForm` |
| Admin / moderador | `js/pages/admin.js` — `renderStoreAdApprovalCards`, `bindStoreAdApprovalActions` |
| API | `js/api.js` — `createStoreAd`, `fetchPendingStoreAds`, `approveStoreAd`, `rejectStoreAd` |
| Limites / taxa | `js/plans.js` — `STORE_AD_EXTRA_FEE`, `canCreateIncludedStoreAd`, `isExtraStoreAdSlot` |
| Banco | `store_ads` + RLS; função `store_ads_included_this_month()` |

Testes: `tests/api-premium-ads.test.js`, `tests/api-store-ad-approval.test.js`, `tests/plans.test.js`.

### Implementação (planos)

| Função | O que valida |
|--------|----------------|
| `planAllowsStoreLogo(planId)` | Logo só em planos **pagos** (não no Gratuito) |
| `planAllowsStoreBanner(planId)` | Banner só em planos pagos |
| `planAllowsProductImages(planId)` | Fotos no catálogo só se `productImages > 0` |
| `canCreateProduct(planId, count)` | Teto de itens no catálogo |
| `canAddProductImage(planId, …)` | Teto de imagens (Gratuito: 1 no catálogo) |
| `planAllowsStoreAds(planId)` | Anúncios no feed só no Premium |
| `canCreateIncludedStoreAd(planId, includedThisMonth)` | Slot incluso (< 2/mês) |
| `canCreateExtraStoreAd(planId)` | Permite extra pago no Premium |
| `isExtraStoreAdSlot(planId, includedThisMonth)` | `true` quando inclusos do mês esgotados |

Testes: `tests/plans.test.js`, `tests/api-premium-ads.test.js`, `tests/api-store-ad-approval.test.js`.

### Renovação de plano pago (migrations `045`, `046`)

| Recurso | Comportamento |
|---------|----------------|
| **Ciclo** | 30 dias por assinatura (`stores.subscription_expires_at`) |
| **Aviso ao lojista** | Banner com **72 h** de antecedência no painel |
| **Sem pagamento** | Downgrade automático ao **Gratuito**; só o **produto mais recente** permanece ativo |
| **WhatsApp (comprovante)** | Mensagem inclui **nome e ID da loja** (sem linha de email) |
| **Admin/moderador** | Seção **Planos a renovar** + pedidos com `merchant_note` identificando a loja |

Arquivos: `js/plan-renewal.js`, `js/api.js` (`downgradeExpiredStoreToFree`), `js/pages/merchant.js`, `js/pages/admin.js`.

Testes: `tests/plan-renewal.test.js`.

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
4. Textos da página em `js/strings.js` — use `t()`, não strings hardcoded

### Alterar textos da interface

1. Edite `js/strings.js` diretamente ou use `strings-editor.html` e baixe o arquivo
2. `npm test` (inclui `tests/strings.test.js`)
3. Commit — o deploy publica o módulo atualizado sem build extra

### Nova migration

1. Crie `supabase/migrations/034_descricao.sql` (próximo número sequencial)
2. `npx supabase db push` ou SQL Editor
3. Atualize `api.js` e a UI conforme necessário

**Últimas migrations:**

- `044_store_ads_approval_billing.sql` — anúncios: `is_extra`, `fee_amount`, `fee_acknowledged`, RLS staff, slots inclusos vs. extras
- `043_product_is_used.sql` — tag **Usado** em produtos
- `042_content_reports.sql` — denúncias de loja/produto
- `033_neighborhoods.sql` — bairros, escopo regional de moderadores e RLS

### Admin: criar loja por e-mail

Em `#/admin/lojas` → **+ Nova loja**:

1. Informe o **e-mail** de uma conta já cadastrada (`owner_email`)
2. API: `resolveOwnerForAdminStore` + `createStoreAsAdmin` em `js/api.js`
3. Se for **cliente**, o admin promove a **lojista** na hora
4. Se o lojista **já tem loja**, a criação é bloqueada (1 merchant = 1 loja no app)
5. Admin e moderador **não** podem ser donos de loja

Testes: `tests/api-resolve-owner-email.test.js`, `tests/api-fetch-merchants.test.js`.

**Scripts locais de DB** (`.env.local` com `DATABASE_URL`):

```bash
npm run db:push:url              # supabase db push
npm run db:push:url -- --include-all   # inclui migrations fora de ordem no remoto
node tools/apply-sql.mjs supabase/migrations/044_store_ads_approval_billing.sql
node tools/register-migration.mjs 044 store_ads_approval_billing
```

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