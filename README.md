# MaredeVendas

Marketplace local de lojas — **HTML, CSS e JavaScript vanilla** com backend [Supabase](https://supabase.com). Clientes exploram lojas, montam o carrinho e finalizam o pedido pelo **WhatsApp**. Não há pagamento in-app.

**Site em produção:** https://kelfys.github.io/MaredeVendas-vanilla/

---

## Funcionalidades

| Papel | O que pode fazer |
|-------|------------------|
| **Visitante** | Ver feed de lojas e produtos, buscar, adicionar ao carrinho e pedir pelo WhatsApp |
| **Cliente** | Favoritar lojas, curtir/comentar produtos, dados pré-preenchidos no checkout |
| **Lojista** | Painel com produtos, pedidos, anúncios e configurações (após aprovação do admin) |
| **Moderador** | Aprovações, lojas, produtos e pedidos (somente leitura em lojas/produtos) |
| **Admin** | Métricas, moderação, gestão de lojistas/moderadores e configuração da plataforma |

---

## Stack

- **Frontend:** ES Modules nativos, lazy-load de páginas, sem bundler
- **Roteamento:** History API em produção (GitHub Pages); hash (`#/`) em localhost na raiz
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
│   ├── merchant-nav.js     # Menu do painel do lojista
│   ├── staff-nav.js        # Menu dos painéis admin e moderador
│   └── pages/              # Uma página por rota
├── supabase/migrations/    # Migrations SQL (001 → 024)
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

- `http://localhost:8080`
- `https://kelfys.github.io/MaredeVendas-vanilla/`

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

---

## Autenticação

- **Login unificado** em `/conta/entrar` (e alias `/lojista/entrar`): mesma tela para cliente, lojista, admin e moderador
- Após login, redirecionamento automático por papel: `/favoritos`, `/dashboard`, `/admin` ou `/moderador`
- Parâmetro `?redirect=` funciona para clientes (ex.: voltar à loja após login)
- **Cadastro de cliente** em `/conta/criar` exige data de nascimento (18+), validada no front, API e banco
- **Cadastro de loja** em `/lojista/cadastro` (link na tela de login)
- Admin e moderador têm telas dedicadas em `/admin/entrar` e `/moderador/entrar` (com recuperação de senha)

### Navegação (header)

- **Desktop:** `Lojas · Regras · Entrar` no menu superior (sem botão Entrar nas ações do header)
- **Mobile:** `Lojas · Regras · 🔑 Entrar` no menu hambúrguer (☰)
- Logado: ícones de favoritos, painel ou sair conforme o papel

---

## Deploy

Deploy automático ao fazer push na `main`. O workflow:

1. Copia `index.html`, `css/`, `js/`, `favicon.svg` e `404.html` para `dist/`
2. Injeta `?v=<commit>` em `app.js` e `styles.css` (cache bust)
3. Publica na branch `gh-pages` via Peaceiris

**Deploy manual:**

```bash
gh workflow run deploy.yml
```

---

## Rotas principais

| Rota | Página |
|------|--------|
| `/` | Feed de lojas e produtos |
| `/loja/:slug` | Página pública da loja |
| `/conta/entrar` | Login unificado |
| `/conta/criar` | Cadastro do cliente (com data de nascimento) |
| `/lojista/cadastro` | Cadastro de loja |
| `/dashboard` | Painel do lojista |
| `/admin` | Painel admin |
| `/moderador` | Painel moderador |
| `/favoritos` | Lojas favoritas |
| `/regras` | Regras e planos |

> Em localhost as rotas usam hash (`#/conta/entrar`). Em produção (GitHub Pages) usam URLs limpas com base `/MaredeVendas-vanilla/`.

---

## Fluxo de pedido

1. Cliente navega até uma loja aprovada
2. Adiciona produtos ao carrinho (uma loja por vez)
3. Escolhe forma de pagamento e preenche nome, telefone e endereço
4. O pedido é salvo no Supabase (`orders` + `order_items`)
5. WhatsApp abre com a mensagem formatada para o lojista

---

## Manutenção

### Nova página

1. Crie `js/pages/minha-pagina.js` com `export async function renderMinhaPagina(main) { ... }`
2. Registre em `js/app.js` com `registerRoute`
3. Adicione link em `js/ui.js` se for rota pública

### Nova migration

1. Crie `supabase/migrations/025_descricao.sql`
2. `npx supabase db push` ou SQL Editor
3. Atualize `api.js` e a UI conforme necessário

---

## Melhorias futuras

- [ ] Notificações em tempo real (Supabase Realtime) para novos pedidos
- [ ] Integração de pagamento/assinatura (Stripe)
- [ ] Service Worker para cache offline
- [ ] Testes E2E automatizados no CI (Playwright)
- [ ] Paginação no feed e listagens longas

---

## Licença

Projeto privado — uso conforme acordado com os mantenedores.