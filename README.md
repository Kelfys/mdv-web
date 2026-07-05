# MaredeVendas

Marketplace local de lojas — **HTML, CSS e JavaScript vanilla** com backend [Supabase](https://supabase.com). Clientes exploram lojas, montam o carrinho e finalizam o pedido pelo **WhatsApp**. Não há pagamento in-app.

**Site em produção:** https://kelfys.github.io/MaredeVendas-vanilla/

---

## Funcionalidades

| Papel | O que pode fazer |
|-------|------------------|
| **Visitante** | Ver lojas, buscar por nome/cidade, adicionar ao carrinho e pedir pelo WhatsApp |
| **Cliente** | Tudo do visitante + favoritar lojas, curtir/comentar produtos, dados pré-preenchidos no checkout |
| **Lojista** | Painel com produtos, pedidos e configurações da loja (após aprovação do admin) |
| **Admin** | Métricas da plataforma e aprovação/rejeição de cadastros de lojas |

---

## Stack

- **Frontend:** ES Modules nativos, roteamento por hash (`#/`), sem bundler
- **Backend:** Supabase (Auth, PostgreSQL, Row Level Security)
- **Deploy:** GitHub Pages via GitHub Actions
- **Fonte:** [Inter](https://fonts.google.com/specimen/Inter) (Google Fonts)

---

## Estrutura do projeto

```
maredevendas-vanilla/
├── index.html              # Shell HTML — ponto de entrada
├── css/styles.css          # Estilos globais e componentes
├── js/
│   ├── app.js              # Boot da aplicação e registro de rotas
│   ├── router.js           # Roteador SPA (hash-based)
│   ├── state.js            # Estado global (tema, auth, carrinho)
│   ├── config.js           # Credenciais Supabase e constantes
│   ├── db.js               # Cliente Supabase (singleton)
│   ├── api.js              # Camada de acesso a dados
│   ├── ui.js               # Componentes de UI reutilizáveis
│   ├── utils.js            # Formatação, escape HTML, ranking de produtos
│   ├── whatsapp.js         # Montagem de mensagem e link wa.me
│   └── pages/              # Uma página por rota
│       ├── home.js
│       ├── store-page.js
│       ├── auth.js
│       ├── merchant.js
│       ├── admin.js
│       ├── favorites.js
│       └── rules.js
├── supabase/
│   ├── setup.sql           # Instruções de setup
│   └── migrations/         # Migrations SQL (rodar em ordem numérica)
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
# Opção A — Python
python -m http.server 8080

# Opção B — Node (npx)
npx serve -l 8080
```

Acesse: http://localhost:8080

### 2. Configurar Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. No **SQL Editor**, execute cada arquivo em `supabase/migrations/` **na ordem numérica** (001 → 011)
3. Em **Authentication → URL Configuration**, adicione:
   - `http://localhost:8080`
   - URL de produção (ex.: `https://kelfys.github.io/MaredeVendas-vanilla/`)
4. Edite `js/config.js` com sua URL e chave anon/publishable:

```js
export const SUPABASE_URL = 'https://seu-projeto.supabase.co'
export const SUPABASE_ANON_KEY = 'sua-chave-anon'
```

> A chave anon é pública por design — o RLS no banco protege os dados. **Nunca** exponha a `service_role` key no frontend.

---

## Deploy

O deploy é automático via GitHub Actions ao fazer push na branch `main`.

**Deploy manual:**

```bash
gh workflow run deploy.yml
```

O workflow copia `index.html`, `css/`, `js/` e `favicon.svg` para `dist/` e publica no GitHub Pages.

---

## Rotas

| Rota | Página |
|------|--------|
| `#/` | Feed de lojas |
| `#/loja/:slug` | Página pública da loja |
| `#/conta/entrar` | Login do cliente |
| `#/conta/criar` | Cadastro do cliente |
| `#/lojista/entrar` | Login do lojista |
| `#/lojista/cadastro` | Cadastro de loja |
| `#/dashboard` | Painel do lojista |
| `#/admin` | Painel admin |
| `#/favoritos` | Lojas favoritas |
| `#/regras` | Regras da plataforma |

---

## Fluxo de pedido

1. Cliente navega até uma loja aprovada
2. Adiciona produtos ao carrinho (uma loja por vez)
3. Clica em "Finalizar Pedido" e preenche nome, telefone e endereço
4. O pedido é salvo no Supabase (`orders` + `order_items`)
5. WhatsApp abre com a mensagem formatada para o lojista

---

## Manutenção

### Adicionar uma nova página

1. Crie `js/pages/minha-pagina.js` com `export async function renderMinhaPagina(main) { ... }`
2. Importe e registre em `js/app.js`:

```js
import { renderMinhaPagina } from './pages/minha-pagina.js'
registerRoute('/minha-rota', renderMinhaPagina)
```

3. Adicione link no header em `js/ui.js` se necessário

### Adicionar endpoint de API

1. Crie a função em `js/api.js` usando `requireClient()`
2. Consuma na página correspondente em `js/pages/`

### Nova migration do banco

1. Crie `supabase/migrations/012_descricao.sql`
2. Execute no SQL Editor do Supabase
3. Atualize `api.js` e a UI conforme necessário

---

## Melhorias futuras

Ideias documentadas nos comentários do código:

- [ ] Migrar roteamento de hash para History API (`pushState`)
- [ ] Lazy-load de páginas com `import()` dinâmico
- [ ] Upload de imagens via Supabase Storage
- [ ] Paginação no feed de lojas e listagem de produtos
- [ ] Notificações em tempo real (Supabase Realtime) para novos pedidos
- [ ] Recuperação de senha e login social
- [ ] Integração de pagamento/assinatura (Stripe)
- [ ] Service Worker para cache offline
- [ ] Testes automatizados (Vitest + Playwright)

---

## Licença

Projeto privado — uso conforme acordado com os mantenedores.