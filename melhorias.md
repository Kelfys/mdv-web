# Melhorias — MaredeVendas

Backlog das melhorias que foram **revertidas** após o pacote grande (fases 1–3 + SW).  
Reaplicação: **com calma, uma por uma**, testando local e em produção antes da próxima.

---

## Resumo

| | |
|---|---|
| **HEAD atual (prod)** | verificar: `git log -1 --oneline` (main avança com deploys) |
| **Rollback de emergência** | `8bb11b1` (purge SW legado) — **não** é o HEAD; só se o site cair |
| **Total de itens (lista A–G)** | 35 |
| **Feitos** | 1 (`E9`) |
| **Em andamento** | 0 |
| **Pendentes** | 34 |
| **Modo de trabalho** | **1 código por vez** → testar → só então o próximo |
| **Próximo sugerido** | `C1` (medalhas de plano) — baixo risco, sem banco |
| **Evitar por ora** | `E6`, `E16` e **vários E de uma vez** |
| **Não urgente** | Seção **G** (dashboard produtos) — backlog de polish |
| **Última atualização** | 14/07/2026 (admin loja por e-mail + lojasfake + docs/Obsidian) |

---

## Como trabalhar (regra de ouro)

```
1. Escolher UM código (ex.: C1)
2. Implementar só esse item (diff mínimo)
3. npm test local
4. Deploy (push main) se combinado
5. Você testa em prod (Ctrl+Shift+R) + checklist abaixo
6. Marcar ✅ neste arquivo
7. Só então pedir o próximo código
```

| Fazer | Não fazer |
|-------|-----------|
| 1 item por sessão (ou 1 se for médio/alto risco) | Pacote E inteiro de uma vez |
| Testar local **e** produção | Empilhar 5 fixes em cima de SW |
| Atualizar a coluna **Status** aqui | Editar migration já aplicada no remoto |
| Ctrl+Shift+R após deploy | Reintroduzir PWA/SW cache-first sem acordo |

**Exceção:** se um item for minúsculo (só CSS) e o anterior passou, no máximo **2** de risco baixo na mesma rodada — e só se você pedir.

---

## Checklist após cada item

- [ ] `npm test` passou
- [ ] Local `:8080` — fluxo do item OK
- [ ] Produção https://maredevendas.com.br — OK (Ctrl+Shift+R)
- [ ] Aba anônima também OK se mexeu em cache/SW/assets
- [ ] Status no `melhorias.md` → ✅ (ou 🔄 / ❌)
- [ ] Linha em [Diário](#diário) se algo importante mudou

---

## Índice

- [Como trabalhar](#como-trabalhar-regra-de-ouro)
- [Seed da conversa](#seed-da-conversa)
- [Como pedir](#como-pedir)
- [Fila sugerida (1 a 1)](#fila-sugerida-1-a-1)
- [Pacotes (referência — não aplicar de uma vez)](#pacotes-referência--não-aplicar-de-uma-vez)
- [A — Lojas e planos](#a--lojas-e-planos)
- [B — Anúncios no feed](#b--anúncios-no-feed)
- [C — Visual / UI](#c--visual--ui)
- [D — Uploads](#d--uploads)
- [E — Fases 1–3](#e--fases-13)
- [F — Segurança / conta (senha)](#f--segurança--conta-senha)
- [G — Dashboard de produtos](#g--dashboard-de-produtos)
- [Fora da lista (já no main)](#fora-da-lista-já-no-main)
- [Dependências](#dependências)
- [Histórico de commits (quando existia na árvore antiga)](#histórico-de-commits-quando-existia-na-árvore-antiga)
- [Erro "Erro ao carregar"](#erro-erro-ao-carregar)
- [Decisões](#decisões)
- [Diário](#diário)

---

## Seed da conversa

> Cole ao retomar com o assistente.

```
Leia melhorias.md.
Modo: UMA melhoria por vez. Não aplicar pacotes grandes.
Tarefa: aplicar só <CÓDIGO> (ex.: C1).
npm test. Deploy só se eu pedir.
Após feito: atualizar status no melhorias.md.
```

### Projeto

| | |
|---|---|
| **Nome** | MaredeVendas-vanilla |
| **Stack** | JavaScript vanilla (ES modules) + Supabase, sem bundler |
| **Repo** | `Kelfys/MaredeVendas-vanilla` |
| **Produção** | https://maredevendas.com.br |
| **GitHub Pages** | https://kelfys.github.io/MaredeVendas-vanilla/ |
| **HEAD** | verificar: `git log -1 --oneline` |
| **Rollback SW** | `8bb11b1` |

### O que aconteceu (cronologia)

1. **Fases 1–3** implementadas — pacote grande (wishlist, reviews, QR, PWA, etc.).
2. **Produção quebrou** — "Erro ao carregar" (SW cache-first + assets velhos).
3. **Revert** para `8bb11b1` — site voltou.
4. **Reaplicação em bloco** — quebrou de novo; revertido.
5. **`melhorias.md`** — backlog para escolha gradual.
6. **13/07/2026** — trabalho **1 a 1** acordado; main avançou com paginação feed (`E9`), tema amarelo, favicon SVG (sem reaplicar o pacote E).

### Diagnóstico do erro clássico

| | |
|---|---|
| **Mensagem** | Bootstrap `index.html` quando `import(app.js)` falha |
| **Não é** | "Erro ao conectar" da API da home |
| **Causa** | SW cache-first / HTML·JS velhos; ou CDN Supabase bloqueada |
| **Nunca** | Registrar `sw.js` + `sw.js?v=2` (dois workers) |

### Estado do banco

Remoto pode ter migrations **049–052+** mesmo com front sem features E.  
Antes de item com **Banco: Sim**:

```bash
npm run db:check
# ou dashboard Supabase
```

### Arquivos-chave

| Área | Arquivos |
|------|----------|
| Bootstrap / erro | `index.html`, `js/strings.js` |
| SW | `sw.js` (hoje: só limpa legado e desregistra) |
| Home / feed | `js/pages/home.js`, `js/feed.js`, `css/styles.css` |
| Loja | `js/pages/store-page.js`, `js/ui.js` |
| Uploads | `js/uploads.js` |
| Admin | `js/pages/admin.js`, `js/api.js` |
| Deploy | `.github/workflows/deploy.yml` |

### Comandos

```bash
npm start              # :8080
npm test               # Vitest (~194 no HEAD atual)
npm run db:push:url    # só migration nova pendente
```

---

## Como pedir

**Um por vez (preferido):**
```
C1
```

```
Aplicar só D1. npm test. Sem deploy até eu validar local.
```

```
Próximo da fila.
```

**Dois só se baixo risco e você autorizar:**
```
C1 e C2 — um commit cada se possível; testar entre os dois.
```

**Evitar:**
```
pacote E inteiro
tudo menos E6
```

---

## Fila sugerida (1 a 1)

Ordem segura para ir marcando ✅:

| # | Código | Risco | Banco | Notas |
|---|--------|-------|-------|-------|
| 1 | **C1** | Baixo | Não | Medalhas de plano |
| 2 | **C2** | Baixo | Não | Badges Plus/Premium |
| 3 | **B4** | Baixo | Não | Badge Patrocinado |
| 4 | **D1** | Baixo | Não | Dicas de dimensão |
| 5 | **D2** | Baixo | Não | Tamanho na tela ao enviar |
| 6 | **C3** | Baixo | Não | Carrinho cor WhatsApp |
| 7 | **C5** | Baixo | Não | Favoritar/compartilhar ícones |
| 8 | **C4** | Médio | Não | Página da loja (maior) |
| 9 | **B2** | Baixo | Não | Layout anúncio no grid |
| 10 | **B3** | Baixo | Não | CSS feed |
| 11 | **B1** | Médio | Sim (`050`?) | Produto no anúncio — checar schema |
| … | **E3** | Baixo | Não | QR Code |
| … | **F1** | Médio | Não* | Senha atual ao trocar (*Auth Supabase) |
| … | **F2** | Médio | Não* | E-mail ao trocar senha |
| … | **F3** | Médio | Não* | Encerrar outras sessões após troca |
| … | **E12**→**E13** | Médio | Sim | Log staff + tela |
| … | **E10** | Médio | Sim | Métricas bairro |
| — | **E6**, **E16** | Alto | Não | **Adiar** |
| — | **E1**, **E2**, **B5**, **B6** | Alto | Sim | Por último, um a um |

`E9` (paginação feed) → já **✅** no main.

---

## Pacotes (referência — **não** aplicar de uma vez)

Use só como **mapa mental**. Na prática: peça **um código** da coluna.

| Pacote | Códigos | Objetivo | Risco |
|--------|---------|----------|-------|
| Visual | C1 → C2 → B4 | Feed/badges | Baixo |
| Uploads | D1 → D2 | Dicas de imagem | Baixo |
| Página da loja | C5 → C3 → C4 | Loja | Baixo→Médio |
| Anúncios | B2 → B3 → B1 | Feed ads | Baixo→Médio |
| Evitar | E6, E16 | PWA/SW | **Alto** |

---

## A — Lojas e planos

| Código | Melhoria | Quem | Onde | Banco | Risco | Status |
|--------|----------|------|------|-------|-------|--------|
| **A1** | Lojas de teste por plano (Gratuito, Plus, Premium) | Admin / testes | Feed e painéis | Sim (`049`) | Baixo | ⬜ |

---

## B — Anúncios no feed

| Código | Melhoria | Quem | Onde | Banco | Risco | Status |
|--------|----------|------|------|-------|-------|--------|
| **B1** | Anunciar produto no feed (grid 2 mobile / 6 desktop) | Lojista | Home + `/dashboard/anuncios` | Sim (`050`) | Médio | ⬜ |
| **B2** | Anúncio ocupa 4 cards (mobile) e 6 (desktop) | Todos | Home `#/` | Não | Baixo | ⬜ |
| **B3** | Ajustes CSS do feed (grid, altura, sem sobreposição) | Todos | Home `#/` | Não | Baixo | ⬜ |
| **B4** | Badge "Patrocinado" (branco sobre dourado) | Todos | Home `#/` | Não | Baixo | ⬜ |
| **B5** | Destaque pago no feed (24h) | Lojista | Home + painel | Sim (`052`) | Alto | ⬜ |
| **B6** | Promo relâmpago com contagem regressiva | Lojista | Loja + feed | Sim (`051`) | Alto | ⬜ |

---

## C — Visual / UI

| Código | Melhoria | Quem | Onde | Banco | Risco | Status |
|--------|----------|------|------|-------|-------|--------|
| **C1** | Medalhas de plano (Gratuito / Plus / Premium) | Todos | Feed + `#/loja/:slug` | Não | Baixo | ⬜ |
| **C2** | Badges Plus bronze e Premium prata | Todos | Feed | Não | Baixo | ⬜ |
| **C3** | Carrinho e botão + na cor WhatsApp | Todos | Feed e loja | Não | Baixo | ⬜ |
| **C4** | Página da loja redesenhada (banner, perfil, botões) | Todos | `#/loja/:slug` | Não | Médio | ⬜ |
| **C5** | Favoritar e compartilhar só ícones | Todos | `#/loja/:slug` | Não | Baixo | ⬜ |

---

## D — Uploads

| Código | Melhoria | Quem | Onde | Banco | Risco | Status |
|--------|----------|------|------|-------|-------|--------|
| **D1** | Dicas de dimensão ideal (banner, logo, produto) | Lojista | `/dashboard` uploads | Não | Baixo | ⬜ |
| **D2** | Tamanho e peso na tela ao enviar imagem | Lojista | `/dashboard` uploads | Não | Baixo | ⬜ |

> **Ideia futura (não codificada):** compressão automática ≤ 1 MB — tratar como item novo (ex. **D3**) quando quiser.

---

## E — Fases 1–3

> **Nunca** reaplicar o bloco E inteiro de uma vez.

### Fase 1 — Cliente e lojista

| Código | Melhoria | Quem | Onde | Banco | Risco | Status |
|--------|----------|------|------|-------|-------|--------|
| **E1** | Wishlist / favoritos com notificações | Cliente | `#/favoritos` | Sim (`051`) | Alto | ⬜ |
| **E2** | Avaliações de loja (reviews) | Cliente / lojista | Loja + dashboard | Sim (`051`) | Alto | ⬜ |
| **E3** | QR Code da loja | Lojista | `/dashboard` | Não | Baixo | ⬜ |
| **E4** | Visualizações no painel lojista | Lojista | `/dashboard` | Sim (`051`) | Médio | ⬜ |
| **E5** | Cookies + página de privacidade | Todos | Banner + `#/privacidade` | Não | Médio | ⬜ |
| **E6** | PWA / manifest (instalar app) | Todos | `manifest.webmanifest` | Não | **Alto** | ⬜ |
| **E7** | Métricas de anúncios no painel | Lojista | `/dashboard/anuncios` | Sim (`051`) | Médio | ⬜ |

### Fase 2 — Marketplace

| Código | Melhoria | Quem | Onde | Banco | Risco | Status |
|--------|----------|------|------|-------|-------|--------|
| **E8** | Moderação em lote (aprovações) | Staff | `/admin/aprovacoes` | Não* | Médio | ⬜ |

\* Tabelas existentes; veio no pacote antigo `9c1cb38`.

### Fase 3 — Performance e admin

| Código | Melhoria | Quem | Onde | Banco | Risco | Status |
|--------|----------|------|------|-------|-------|--------|
| **E9** | Paginação do feed | Todos | Home `#/` | Não | Baixo | ✅ |
| **E10** | Métricas agregadas por bairro | Admin | `/admin` | Sim (`051`) | Médio | ⬜ |
| **E11** | Atualização parcial na loja (DOM) | Todos | `#/loja/:slug` | Não | Médio | ⬜ |
| **E12** | Log de ações do staff (expandido) | Admin | API + admin | Sim (`051`) | Médio | ⬜ |
| **E13** | Tela do log de ações | Admin | `#/admin/log` | Não** | Baixo | ⬜ |

\*\* Precisa de **E12** para dados.

### Infraestrutura

| Código | Item | O que faz | Risco | Status |
|--------|------|-----------|-------|--------|
| **E14** | Migrations `051` / `052` | Schema no Supabase | Médio | ⬜ verificar remoto |
| **E15** | Testes E2E (Playwright) | Smoke no CI | Baixo | ⬜ |
| **E16** | Service worker PWA cache-first | Offline — **já quebrou prod** | **Alto** | ⬜ / evitar |

**Nota E9:** no main atual existe paginação do feed (~44 cards/página, commits `e25daf4` / `b1687f2`). Considerar **feito**; se faltar UX ("Carregar mais" vs páginas), abrir ajuste pontual sem reabrir o pacote E.

---

## F — Segurança / conta (senha)

Contexto (14/07/2026): senhas só no **Supabase Auth** (vault `admin_user_passwords` removido).  
Hoje: `updatePassword` chama `auth.updateUser({ password })` **sem** pedir senha atual e **sem** e-mail de alerta; sessões antigas em outros aparelhos **podem continuar** até o token expirar.

| Código | Melhoria | Quem | Onde | Banco | Risco | Status |
|--------|----------|------|------|-------|-------|--------|
| **F1** | Exigir **senha atual** antes de definir a nova | Cliente / lojista / staff | Conta → alterar senha | Não* | Médio | ⬜ |
| **F2** | **E-mail de alerta** quando a senha for alterada | Todos com e-mail | Supabase Auth / template | Não* | Médio | ⬜ |
| **F3** | Após troca bem-sucedida: **encerrar outras sessões** (ou `signOut` global + relogin) | Todos | `updatePassword` + Auth | Não* | Médio | ⬜ |

\* Não é migration SQL do app; pode exigir config no **Dashboard Supabase** (Auth → e-mails, políticas de sessão) e/ou reauth com `signInWithPassword` da senha atual no front.

### Detalhe por item

| Código | Comportamento desejado | Arquivos prováveis |
|--------|------------------------|--------------------|
| **F1** | Form com “senha atual” + “nova” + “confirmar”; validar atual com `signInWithPassword` (e-mail da sessão) **antes** de `updateUser({ password })`. Bloqueia quem só tem a sessão aberta sem saber a senha. | `js/api.js` (`updatePassword`), `js/pages/favorites.js`, `js/pages/merchant.js`, admin conta se houver |
| **F2** | Notificar o e-mail da conta: “sua senha foi alterada em …”. Preferir template Auth do Supabase se existir; senão Edge Function / hook. Evita silêncio em takeover. | Dashboard Supabase + docs; opcional `js/api.js` |
| **F3** | Depois de trocar: invalidar refresh tokens de outros devices (`signOut({ scope: 'others' })` se disponível na versão do SDK) **ou** `signOut` completo e redirecionar ao login. Reduz sessão hijack residual. | `js/api.js` `updatePassword`, `js/state.js` |

### Ordem sugerida (F)

```
F1 → F3 → F2
```

`F1` e `F3` no front/SDK; `F2` depende mais de config Supabase.

### O que já está ok (não reabrir como bug)

- “Esqueci a senha” → `resetPasswordForEmail` + `#/auth/callback`
- Sem vault de senha em texto no Postgres (security P0)
- Admin do app **não** redefine senha de usuário pelo painel MaredeVendas

---

## G — Dashboard de produtos

> **Não urgente.** Levantado em 14/07/2026 ao visualizar os painéis.  
> Funciona em produção; itens abaixo são **polish / alinhamento UX**. Fazer só quando sobrar tempo — **não** puxar antes de C1/F1 se houver prioridade.

| Código | Melhoria | Quem | Onde | Banco | Risco | Status |
|--------|----------|------|------|-------|-------|--------|
| **G1** | Alinhar form de criar item (admin ↔ lojista): mesmos campos, ordem e hints | Staff / lojista | `#/admin/produtos`, `#/dashboard/produtos` | Não | Baixo | ⬜ |
| **G2** | Chips ativo/inativo na lista de produtos do **admin** (lojista já tem) | Admin | `#/admin/produtos/:storeId` | Não | Baixo | ⬜ |
| **G3** | Corrigir label do botão submit admin (`createItem` vs `createProduct` no finally) | Admin | `js/pages/admin.js` `bindProductForm` | Não | Baixo | ⬜ |
| **G4** | Revisar edição em linha na tabela (UX datada; painel lateral ou modal — opcional) | Staff / lojista | Produtos admin + lojista | Não | Médio | ⬜ |

### Contexto (mapa rápido)

| Painel | Rota | Arquivo | Estado atual |
|--------|------|---------|--------------|
| Admin / Moderador | `#/admin/produtos` · `#/admin/produtos/:storeId` | `js/pages/admin.js` | Sidebar lojas + catálogo da loja; engajamento só admin |
| Lojista | `#/dashboard/produtos` | `js/pages/merchant.js` | Form aberto, chips ativo/inativo, sort nome/preço/estoque |

**Já ok (não reabrir):**
- Limites de plano (itens + imagens) e tipo produto/serviço (`catalog.js`)
- Sidebar admin com busca loja/bairro/telefone (`fetchStoresAdminLite`)
- Paginação client-side (`bindPaginatedSortableList`)
- Moderador read-only em produtos

### Ordem sugerida (G) — quando for a vez

```
G3 → G2 → G1 → G4
```

`G3` é minúsculo; `G4` só se a edição em linha realmente incomodar.

---

## Fora da lista (já no main)

Trabalho recente **não** mapeado como A–E, mas está em produção:

| Commit / tema | O quê |
|---------------|--------|
| `e25daf4` … `b1687f2` | Paginação feed (+ ajustes) → cobre **E9** |
| `92167d2` | Paginação lista de lojas no admin |
| `af5dedd` | Tema claro amarelo (papel), botões na cor da loja, favicon SVG |
| `6f6d891` … `27f52c4` | Favicon / marca colorida |
| `597eb03` | Feed com engajamento real (lojas/produtos) |
| `7bd5677` / `9dc7049` | Banner free oculto + fix CSS logo ≠ banner |
| `3dba8f0` | Plano Gratuito: **1 produto + 1 foto** |
| `3a60ba7` | Categorias marketplace v2 (migration `056`) |
| `b5c9471` | Editor de textos (download com helpers completos) |
| `2a27991` | Admin criar loja: lojista responsável só sem loja (select) |
| `985adc0` | Admin criar loja por **e-mail** (`resolveOwnerForAdminStore`; sem select) |
| `9bb99a1` | Gratuito **sem logo**; admin **sem cooldown** de preço |
| `cfb8239` … `7b301b6` | Cor de alerta do logo (**Maré**): presets + admin Conta (`057`) |
| `651ece4` | Logo: Maré = alerta; de = texto; Vendas = dourado fixo |
| `fbed2c7` | Home: sem contagem de lojas/produtos no hero |
| `28fdccd` … `c3399bc` | Chips bairro/categoria: scroll/arraste desktop + clique |
| `90cdd97` … `6cb8682` | Chips mobile sem corte de botões |
| `fb04d75` | Sidebar produtos: ordenação sem emoji + scroll à loja ativa |
| *(dados)* | Dono único seed: `lojasfake@gmail.com` · limpeza órfãos seed · 20 lojas ads |

---

## Dependências

```
E1, E2, E4, E7, E10, E12, B5, B6  →  E14 (migrations) — confirmar no remoto
E13                               →  E12
B1                                →  migration 050?
B5                                →  052
C4                                →  melhor depois de C1/C5
E6 + E16                          →  NUNCA sem acordo e estratégia de cache
F3                                →  melhor depois de F1 (mesmo fluxo updatePassword)
F2                                →  independente; config Supabase Auth
```

---

## Histórico de commits (quando existia na árvore antiga)

Referência da época em que o pacote existia (muitos commits **não** estão no main atual):

| Commit | Códigos | Descrição |
|--------|---------|-----------|
| `1a4e584` | A1 | Lojas de teste por plano |
| `70b029d` | B1 | Anunciar produto no feed |
| `f0c523b` | D1 | Dicas de dimensão |
| `90bfc0d` | D2 | Dicas com tamanho na tela |
| `9f2cae5` | B2 | Anúncio grande no grid |
| `5090ef3` | B4 | Badge patrocinado |
| `4fbf49a` | C2 | Badges prata/bronze |
| `4f56fd3` | C1 | Medalhas de plano |
| `9c1cb38` | E* | Fases 1–3 (pacote que quebrou) |
| `8bb11b1` | — | Rollback SW estável |
| `e25daf4` | E9≈ | Paginação feed (main atual) |
| `af5dedd` | — | Tema amarelo + botões loja + favicon SVG |

---

## Erro "Erro ao carregar"

| | |
|---|---|
| **Sintoma** | Bootstrap falha ao importar `app.js` |
| **Causa** | SW antigo / cache de assets |
| **Rollback** | `8bb11b1` se emergência |
| **Pós-deploy** | Ctrl+Shift+R |

**Checklist pós-deploy (mínimo):**
- [ ] Home `#/` abre
- [ ] Login funciona
- [ ] Painel sem spinner infinito
- [ ] Aba anônima OK

---

## Decisões

| Data | Decisão |
|------|---------|
| 10/07/2026 | Site quebrou após fases 1–3 + SW cache-first |
| 10/07/2026 | Revertido para `8bb11b1` |
| 10/07/2026 | Criado este arquivo para escolha gradual |
| 13/07/2026 | **Modo 1 a 1:** uma melhoria por vez, testar, só então a próxima |
| 13/07/2026 | Pacotes = referência de ordem; **não** implementar o pacote inteiro de uma vez |
| 13/07/2026 | `E9` marcado ✅ (paginação feed no main) |
| 13/07/2026 | Evitar E6/E16; emergência SW = `8bb11b1` |
| 14/07/2026 | Incluída seção **F** (segurança de senha: F1 senha atual, F2 e-mail, F3 outras sessões) |
| 14/07/2026 | Plano free = 1 item + 1 foto; categorias marketplace `056`; editor de textos atualizado |
| 14/07/2026 | Seção **G** (dashboard produtos: G1–G4) — polish, **não urgente** |
| 14/07/2026 | Deploy `2a27991`: lojista responsável só sem loja no admin |
| 14/07/2026 | **Gratuito sem logo** (só planos pagos); admin muda preço **sem cooldown** |
| 14/07/2026 | **Logo accent** público: admin Conta → status (normal/promo/alerta/…); migration `057` |
| 14/07/2026 | Logo tipografia: **Maré** (alerta) + **de** (texto) + **Vendas** (dourado) |
| 14/07/2026 | Home: sem stats de lojas/produtos no hero; chips com scroll/arraste (desktop/mobile) |
| 14/07/2026 | Produção: removidos bairros Centro/Copacabana/Ipanema/Leblon/Tijuca (lojas redistribuídas) |
| 14/07/2026 | Admin criar loja por **e-mail** (não select); customer → merchant na hora |
| 14/07/2026 | Lojas fake sob `lojasfake@gmail.com`; limpeza de lojistas seed órfãos |

---

## Diário

### 2026-07-14
- Seção **F — Segurança / conta (senha)** adicionada (`F1`, `F2`, `F3`).
- Contexto: se alguém troca a senha (sessão aberta / e-mail / Auth), senha antiga falha no login; sessão residual e falta de alerta são lacunas a cobrir com F1–F3.
- Também em produção (fora A–E): engajamento no feed, banner free, free 1+1, categorias v2, editor de textos.
- Visualizado dashboard de produtos (admin + lojista): funciona; polish → seção **G** (`G1`–`G4`), sem prazo.
- Deploy: `2a27991` (select lojista responsável só sem loja) → depois `985adc0` (**e-mail** do lojista, sem select).
- **Planos:** free sem upload de logo; admin bypass cooldown de preço (`9bb99a1`).
- **Logo accent:** `platform_settings` + seletor em `#/admin/conta`; cores em “Maré” (`cfb8239`…`651ece4`).
- **Home UX:** hero sem contagens; chips bairro/categoria scrolláveis e clicáveis no desktop; fix corte mobile.
- **Dados:** seed lojas ads; renome orgânico; bairros zona sul removidos; redistribuição para região ativa.
- **Admin produtos:** ordenação sidebar ignora emoji; scroll até loja ativa (`fb04d75`).
- **Admin lojas:** campo e-mail do dono (`resolveOwnerForAdminStore`); testes `api-resolve-owner-email`.
- **Seed/limpeza:** `lojasfake@gmail.com` dono de ~20 lojas ads; `cleanup-orphans` removeu 11 merchants seed sem loja; scripts em `scripts/` (gitignored).
- **Docs:** `README.md` + `melhorias.md` + Obsidian roadmap de aprendizado.
- **Aprendizado (triggers):** `054` bloqueia troca de `owner_id` sem admin Auth; script desliga trigger só na sessão SQL.

### 2026-07-13
- Arquivo atualizado para fluxo **1 código → testar → próximo**.
- Feito na lista: **E9**.
- Próximo sugerido: **C1**.

```markdown
### YYYY-MM-DD
- Código: 
- Commit: 
- Teste local: sim/não
- Prod OK: sim/não
- Próximo: 
```

---

## Legenda

| Símbolo | Status |
|---------|--------|
| ⬜ | Pendente |
| 🔄 | Em andamento |
| ✅ | Feito e validado |
| ❌ | Descartado |

| Risco | Significado |
|-------|-------------|
| **Baixo** | CSS/textos — ideal para 1 a 1 |
| **Médio** | Vários arquivos — testar bem em prod |
| **Alto** | Banco / muitos módulos / SW — um por vez, com calma |

---

*Modo: 1 por vez · Rollback SW: `8bb11b1` · HEAD: `git log -1` · MaredeVendas vanilla*
