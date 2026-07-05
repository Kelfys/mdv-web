/**
 * Painel administrativo — conteúdo dinâmico; navegação no ícone ⚙️ do header.
 */
import {
  fetchAdminMetrics, fetchPendingStoreApprovals,
  approveStoreRegistration, rejectStoreRegistration,
  updatePassword, fetchMerchants, fetchAllStoresAdmin,
  fetchAdminProducts, createStoreAsAdmin, createProduct, deleteProduct,
  fetchCategories,
} from '../api.js'
import { getUser } from '../state.js'
import { navigate } from '../router.js'
import { escapeHtml, formatDate, formatCurrency, showToast } from '../utils.js'
import { STORE_THEME_COLORS } from '../config.js'
import { getAdminMenuItem } from '../admin-nav.js'

function guardAdmin(main) {
  const user = getUser()
  if (!user || user.role !== 'admin') {
    main.innerHTML = `<div class="empty-state"><h2>Acesso restrito</h2><p><a href="#/admin/entrar">Entrar como admin</a></p></div>`
    return null
  }
  return user
}

function adminPage(title, subtitle, content) {
  return `
    <div class="admin-page">
      <div class="admin-page__head">
        <div>
          <h1 class="admin-page__title">${escapeHtml(title)}</h1>
          ${subtitle ? `<p class="admin-page__subtitle">${escapeHtml(subtitle)}</p>` : ''}
        </div>
      </div>
      <div class="admin-page__body admin-fade-in">${content}</div>
    </div>
  `
}

function statusBadge(status) {
  const map = {
    pending: '<span class="badge badge-pending">Pendente</span>',
    approved: '<span class="badge badge-approved">Aprovada</span>',
    blocked: '<span class="badge badge-blocked">Bloqueada</span>',
  }
  return map[status] ?? escapeHtml(status)
}

function quickActions() {
  return `
    <div class="admin-quick-actions">
      <a href="#/admin/lojas" class="admin-quick-card">
        <span class="admin-quick-card__icon">🏪</span>
        <strong>Nova loja</strong>
        <span>Cadastrar vitrine</span>
      </a>
      <a href="#/admin/produtos" class="admin-quick-card">
        <span class="admin-quick-card__icon">📦</span>
        <strong>Novo produto</strong>
        <span>Adicionar ao catálogo</span>
      </a>
      <a href="#/admin/aprovacoes" class="admin-quick-card">
        <span class="admin-quick-card__icon">✅</span>
        <strong>Aprovações</strong>
        <span>Revisar cadastros</span>
      </a>
      <a href="#/" class="admin-quick-card admin-quick-card--muted">
        <span class="admin-quick-card__icon">🌐</span>
        <strong>Ver site</strong>
        <span>Abrir marketplace</span>
      </a>
    </div>
  `
}

function metricCards(metrics, pendingCount) {
  const items = [
    { label: 'Lojas', value: metrics.totalStores, href: '#/admin/lojas' },
    { label: 'Produtos', value: metrics.totalProducts, href: '#/admin/produtos' },
    { label: 'Pedidos', value: metrics.totalOrders, href: null },
    { label: 'Visualizações', value: metrics.totalViews, href: null },
    { label: 'Pendentes', value: pendingCount, href: '#/admin/aprovacoes', highlight: pendingCount > 0 },
  ]

  return `
    <div class="metrics admin-metrics">
      ${items.map((m) => `
        ${m.href
          ? `<a href="${m.href}" class="metric-card metric-card--link ${m.highlight ? 'metric-card--alert' : ''}">
              <div class="metric-card__value">${m.value}</div>
              <div class="metric-card__label">${m.label}</div>
            </a>`
          : `<div class="metric-card">
              <div class="metric-card__value">${m.value}</div>
              <div class="metric-card__label">${m.label}</div>
            </div>`}
      `).join('')}
    </div>
  `
}

export async function renderAdminDashboard(main, tab = 'overview') {
  const user = guardAdmin(main)
  if (!user) return

  const menuItem = getAdminMenuItem(tab)

  if (tab === 'overview') {
    const [metrics, pending] = await Promise.all([
      fetchAdminMetrics(),
      fetchPendingStoreApprovals(),
    ])

    const pendingPreview = pending.slice(0, 3)

    main.innerHTML = adminPage(
      menuItem.label,
      'Resumo da plataforma e atalhos rápidos',
      `
        ${quickActions()}
        ${metricCards(metrics, pending.length)}
        <section class="admin-section">
          <div class="admin-section__head">
            <h2>Aprovações recentes</h2>
            ${pending.length > 0 ? `<a href="#/admin/aprovacoes" class="btn btn-outline btn-sm">Ver todas (${pending.length})</a>` : ''}
          </div>
          ${pendingPreview.length === 0
            ? '<div class="empty-state"><p>Nenhuma loja aguardando aprovação.</p></div>'
            : `<div class="admin-cards-list">
                ${pendingPreview.map((s) => `
                  <article class="admin-list-card">
                    <div>
                      <strong>${escapeHtml(s.name)}</strong>
                      <p>${escapeHtml(s.city)}, ${escapeHtml(s.state)} · ${formatDate(s.created_at)}</p>
                    </div>
                    <div class="admin-list-card__actions">
                      <button type="button" class="btn btn-primary btn-sm" data-approve="${s.id}">Aprovar</button>
                      <button type="button" class="btn btn-outline btn-sm" data-reject="${s.id}">Rejeitar</button>
                    </div>
                  </article>
                `).join('')}
              </div>`}
        </section>
      `
    )

    bindApprovalActions(main, 'overview')
    return
  }

  if (tab === 'approvals') {
    const pending = await fetchPendingStoreApprovals()

    main.innerHTML = adminPage(
      menuItem.label,
      `${pending.length} loja(s) aguardando sua revisão`,
      pending.length === 0
        ? '<div class="empty-state"><p>Nenhuma loja aguardando aprovação.</p></div>'
        : `<div class="table-wrap"><table>
            <thead><tr><th>Loja</th><th>Lojista</th><th>Cidade</th><th>Data</th><th>Ações</th></tr></thead>
            <tbody>
              ${pending.map((s) => `
                <tr>
                  <td><strong>${escapeHtml(s.name)}</strong><br><small>${escapeHtml(s.whatsapp)}</small></td>
                  <td>${escapeHtml(s.owner?.name ?? '—')}<br><small>${escapeHtml(s.owner?.email ?? '')}</small></td>
                  <td>${escapeHtml(s.city)}, ${escapeHtml(s.state)}</td>
                  <td>${formatDate(s.created_at)}</td>
                  <td style="white-space:nowrap">
                    <button type="button" class="btn btn-primary btn-sm" data-approve="${s.id}">Aprovar</button>
                    <button type="button" class="btn btn-outline btn-sm" data-reject="${s.id}">Rejeitar</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>`
    )

    bindApprovalActions(main, 'approvals')
    return
  }

  if (tab === 'stores') {
    const [stores, merchants, categories] = await Promise.all([
      fetchAllStoresAdmin(),
      fetchMerchants(),
      fetchCategories(),
    ])

    main.innerHTML = adminPage(
      menuItem.label,
      `${stores.length} loja(s) cadastradas`,
      `
        <div id="admin-store-msg"></div>
        ${merchants.length === 0
          ? '<div class="empty-state" style="margin-bottom:1rem"><p>Nenhum lojista cadastrado. Crie contas em <a href="#/lojista/cadastro">Área do Lojista</a> primeiro.</p></div>'
          : ''}
        <details class="admin-form-panel" open ${merchants.length === 0 ? 'style="opacity:0.6;pointer-events:none"' : ''}>
          <summary>+ Nova loja</summary>
          <form id="admin-store-form" class="admin-form-grid">
            <div class="form-group">
              <label class="form-label">Lojista responsável</label>
              <select class="form-input" name="owner_id" required>
                <option value="">Selecione...</option>
                ${merchants.map((m) => `<option value="${m.id}">${escapeHtml(m.name)} (${escapeHtml(m.email)})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Nome da loja</label>
              <input class="form-input" name="name" required />
            </div>
            <div class="form-group">
              <label class="form-label">Categoria</label>
              <select class="form-input" name="category_id" required>
                ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">WhatsApp</label>
              <input class="form-input" name="whatsapp" required placeholder="5521999999999" />
            </div>
            <div class="form-group">
              <label class="form-label">Cidade</label>
              <input class="form-input" name="city" required />
            </div>
            <div class="form-group">
              <label class="form-label">UF</label>
              <input class="form-input" name="state" required maxlength="2" value="RJ" />
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">Descrição</label>
              <textarea class="form-input" name="description" rows="2"></textarea>
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">Endereço</label>
              <input class="form-input" name="address" />
            </div>
            <div class="form-group">
              <label class="form-label">Horário</label>
              <input class="form-input" name="opening_hours" placeholder="Seg–Sáb 8h–20h" />
            </div>
            <div class="form-group">
              <label class="form-label">Cor do tema</label>
              <select class="form-input" name="theme_color">
                ${STORE_THEME_COLORS.map((c) => `<option value="${c.id}">${c.id}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Plano</label>
              <select class="form-input" name="plan_id">
                <option value="free">Gratuito</option>
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="admin-check">
                <input type="checkbox" name="approved" checked />
                Publicar loja imediatamente (aprovada e ativa)
              </label>
            </div>
            <div class="admin-form-grid__full">
              <button type="submit" class="btn btn-primary">Criar loja</button>
            </div>
          </form>
        </details>
        <div class="table-wrap" style="margin-top:1.5rem">
          <table>
            <thead><tr><th>Loja</th><th>Lojista</th><th>Cidade</th><th>Status</th><th>Plano</th><th></th></tr></thead>
            <tbody>
              ${stores.length === 0 ? '<tr><td colspan="6">Nenhuma loja</td></tr>' : stores.map((s) => `
                <tr>
                  <td><strong>${escapeHtml(s.name)}</strong><br><small>/${escapeHtml(s.slug)}</small></td>
                  <td>${escapeHtml(s.owner?.name ?? '—')}<br><small>${escapeHtml(s.owner?.email ?? '')}</small></td>
                  <td>${escapeHtml(s.city)}, ${escapeHtml(s.state)}</td>
                  <td>${statusBadge(s.status)}</td>
                  <td>${escapeHtml(s.plan_id)}</td>
                  <td>${s.status === 'approved' ? `<a href="#/loja/${escapeHtml(s.slug)}" class="btn btn-outline btn-sm">Ver</a>` : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
    )

    bindStoreForm(main)
    return
  }

  if (tab === 'products') {
    const [products, stores, categories] = await Promise.all([
      fetchAdminProducts(),
      fetchAllStoresAdmin(),
      fetchCategories(),
    ])

    const approvedStores = stores.filter((s) => s.status === 'approved')

    main.innerHTML = adminPage(
      menuItem.label,
      `${products.length} produto(s) no marketplace`,
      `
        <div id="admin-product-msg"></div>
        <details class="admin-form-panel" open>
          <summary>+ Novo produto</summary>
          <form id="admin-product-form" class="admin-form-grid">
            <div class="form-group admin-form-grid__full">
              <label class="form-label">Loja</label>
              <select class="form-input" name="store_id" required>
                <option value="">Selecione a loja...</option>
                ${approvedStores.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Nome</label>
              <input class="form-input" name="name" required />
            </div>
            <div class="form-group">
              <label class="form-label">Preço (R$)</label>
              <input class="form-input" name="price" type="number" step="0.01" min="0" required />
            </div>
            <div class="form-group">
              <label class="form-label">Estoque</label>
              <input class="form-input" name="stock" type="number" min="0" value="10" required />
            </div>
            <div class="form-group">
              <label class="form-label">Categoria</label>
              <select class="form-input" name="category_id">
                <option value="">Sem categoria</option>
                ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">Descrição</label>
              <textarea class="form-input" name="description" rows="2"></textarea>
            </div>
            <div class="admin-form-grid__full">
              <button type="submit" class="btn btn-primary">Criar produto</button>
            </div>
          </form>
        </details>
        <div class="table-wrap" style="margin-top:1.5rem">
          <table>
            <thead><tr><th>Produto</th><th>Loja</th><th>Preço</th><th>Estoque</th><th>Ativo</th><th></th></tr></thead>
            <tbody>
              ${products.length === 0 ? '<tr><td colspan="6">Nenhum produto</td></tr>' : products.map((p) => `
                <tr>
                  <td>${escapeHtml(p.name)}</td>
                  <td>${escapeHtml(p.store?.name ?? '—')}</td>
                  <td>${formatCurrency(p.price)}</td>
                  <td>${p.stock}</td>
                  <td>${p.active ? '✓' : '✗'}</td>
                  <td><button type="button" class="btn btn-outline btn-sm" data-del-product="${p.id}">Excluir</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
    )

    bindProductForm(main)
    return
  }

  if (tab === 'account') {
    main.innerHTML = adminPage(
      menuItem.label,
      `Conta: ${user.email}`,
      `
        <form id="admin-password-form" class="admin-password-form">
          <div class="form-group">
            <label class="form-label">Nova senha</label>
            <input class="form-input" type="password" name="password" required minlength="6" autocomplete="new-password" />
          </div>
          <div class="form-group">
            <label class="form-label">Confirmar nova senha</label>
            <input class="form-input" type="password" name="confirm" required minlength="6" autocomplete="new-password" />
          </div>
          <div id="admin-password-msg"></div>
          <button type="submit" class="btn btn-primary btn-sm">Alterar senha</button>
        </form>
      `
    )

    bindPasswordForm(main)
  }
}

function bindStoreForm(main) {
  main.querySelector('#admin-store-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const f = e.target
    const msgEl = main.querySelector('#admin-store-msg')
    try {
      const store = await createStoreAsAdmin({
        owner_id: f.owner_id.value,
        name: f.name.value.trim(),
        category_id: f.category_id.value,
        whatsapp: f.whatsapp.value.trim(),
        city: f.city.value.trim(),
        state: f.state.value.trim().toUpperCase(),
        description: f.description.value.trim(),
        address: f.address.value.trim(),
        opening_hours: f.opening_hours.value.trim(),
        theme_color: f.theme_color.value,
        plan_id: f.plan_id.value,
        approved: f.approved.checked,
      })
      showToast(`Loja "${store.name}" criada!`)
      navigate('/admin/lojas')
    } catch (err) {
      msgEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    }
  })
}

function bindProductForm(main) {
  main.querySelector('#admin-product-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const f = e.target
    const msgEl = main.querySelector('#admin-product-msg')
    try {
      await createProduct(f.store_id.value, {
        name: f.name.value.trim(),
        description: f.description.value.trim(),
        price: parseFloat(f.price.value),
        stock: parseInt(f.stock.value, 10),
        category_id: f.category_id.value,
        active: true,
      })
      showToast('Produto criado!')
      navigate('/admin/produtos')
    } catch (err) {
      msgEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    }
  })

  main.querySelectorAll('[data-del-product]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este produto?')) return
      await deleteProduct(btn.dataset.delProduct)
      showToast('Produto excluído')
      renderAdminDashboard(main, 'products')
    })
  })
}

function bindPasswordForm(main) {
  main.querySelector('#admin-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const msgEl = main.querySelector('#admin-password-msg')
    const password = form.password.value
    const confirm = form.confirm.value

    if (password !== confirm) {
      msgEl.innerHTML = '<div class="alert alert-error">As senhas não coincidem.</div>'
      return
    }

    const submitBtn = form.querySelector('button[type="submit"]')
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Salvando...' }

    try {
      await updatePassword(password)
      form.reset()
      msgEl.innerHTML = '<div class="alert alert-success">Senha alterada com sucesso.</div>'
      showToast('Senha atualizada!')
    } catch (err) {
      msgEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Alterar senha' }
    }
  })
}

function bindApprovalActions(main, tab) {
  main.querySelectorAll('[data-approve]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await approveStoreRegistration(btn.dataset.approve)
      showToast('Loja aprovada!')
      renderAdminDashboard(main, tab)
    })
  })

  main.querySelectorAll('[data-reject]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Rejeitar esta loja?')) return
      await rejectStoreRegistration(btn.dataset.reject)
      showToast('Loja rejeitada')
      renderAdminDashboard(main, tab)
    })
  })
}