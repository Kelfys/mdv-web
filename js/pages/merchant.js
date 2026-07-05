/**
 * Painel do lojista — produtos, pedidos e configurações da loja.
 */
import {
  fetchStoreByOwner, fetchMerchantProducts, fetchOrdersByStore,
  createProduct, updateProduct, deleteProduct, updateStore, fetchCategories,
} from '../api.js'
import { getUser } from '../state.js'
import { escapeHtml, formatCurrency, formatDate, showToast } from '../utils.js'
import { STORE_THEME_COLORS } from '../config.js'
import {
  planAllowsStoreBranding, FREE_PLAN_BRANDING_MESSAGE,
  FREE_PLAN_PRODUCT_IMAGE_LIMIT, FREE_PLAN_PRODUCT_IMAGE_MESSAGE,
  countProductsWithImages, freePlanProductImagesRemaining, canAddProductImage,
  planAllowsUnlimitedProductImages, getPlanById, formatPlanPrice,
} from '../plans.js'
import {
  STORE_BRANDING_UPLOAD_HINT, PRODUCT_IMAGE_UPLOAD_HINT,
  validateImageFile, STORAGE_BUCKETS,
} from '../uploads.js'
import { MERCHANT_PANEL, getMerchantMenuItem, merchantHref } from '../merchant-nav.js'

const ORDER_STATUS_LABELS = {
  pending: 'Pendente',
  sent: 'Enviado',
  viewed: 'Visualizado',
}

const LOW_STOCK_THRESHOLD = 3

function imagePreviewBlock(url, alt, variant = 'square') {
  if (!url) {
    return `<div class="admin-image-preview admin-image-preview--empty admin-image-preview--${variant}">Sem imagem</div>`
  }
  return `<img class="admin-image-preview admin-image-preview--${variant}" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" />`
}

function bindImagePreview(input, previewEl) {
  if (!input || !previewEl) return
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      previewEl.innerHTML = `<img class="admin-image-preview" src="${reader.result}" alt="Prévia" />`
    }
    reader.readAsDataURL(file)
  })
}

function guardMerchant(main) {
  const user = getUser()
  if (!user || user.role !== 'merchant') {
    main.innerHTML = `<div class="empty-state"><h2>Acesso restrito</h2><p><a href="#/lojista/entrar">Entrar como lojista</a></p></div>`
    return null
  }
  return user
}

function merchantPage(title, subtitle, content, actions = '') {
  return `
    <div class="admin-page merchant-page">
      <div class="admin-page__head">
        <div class="admin-page__head-main">
          <p class="admin-page__eyebrow">${escapeHtml(MERCHANT_PANEL.label)}</p>
          <h1 class="admin-page__title">${escapeHtml(title)}</h1>
          ${subtitle ? `<p class="admin-page__subtitle">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        ${actions ? `<div class="admin-page__actions">${actions}</div>` : ''}
      </div>
      <div class="admin-page__body admin-fade-in">${content}</div>
    </div>
  `
}

function merchantEmptyState(icon, title, text, actionHtml = '') {
  return `
    <div class="admin-empty">
      <span class="admin-empty__icon">${icon}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${text}</p>
      ${actionHtml}
    </div>`
}

function storeStatusBadge(status) {
  const map = {
    pending: '<span class="badge badge-pending">Aguardando aprovação</span>',
    approved: '<span class="badge badge-approved">Loja aprovada</span>',
    blocked: '<span class="badge badge-blocked">Loja bloqueada</span>',
  }
  return map[status] ?? escapeHtml(status)
}

function orderStatusBadge(status) {
  const map = {
    pending: '<span class="badge badge-order-pending">Pendente</span>',
    sent: '<span class="badge badge-order-sent">Enviado</span>',
    viewed: '<span class="badge badge-order-viewed">Visualizado</span>',
  }
  return map[status] ?? escapeHtml(status)
}

function storeStatusBanner(store) {
  const messages = {
    pending: 'Sua loja está em análise. Você já pode cadastrar produtos; a vitrine pública ficará visível após aprovação.',
    approved: 'Sua loja está ativa no marketplace.',
    blocked: 'Sua loja está bloqueada. Entre em contato com o suporte para mais informações.',
  }
  const tone = store.status === 'approved' ? 'approved' : store.status === 'blocked' ? 'blocked' : 'pending'
  return `
    <div class="merchant-status-banner merchant-status-banner--${tone}">
      <div class="merchant-status-banner__main">
        ${storeStatusBadge(store.status)}
        <p>${escapeHtml(messages[store.status] ?? '')}</p>
      </div>
      ${store.status === 'approved' ? `<a href="#/loja/${escapeHtml(store.slug)}" class="btn btn-outline btn-sm">Ver loja pública</a>` : ''}
    </div>`
}

function merchantMetrics({ products, orders, store }) {
  const activeProducts = products.filter((p) => p.active).length
  const revenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0)
  const plan = getPlanById(store.plan_id)

  return `
    <div class="metrics admin-metrics merchant-metrics">
      <a href="${merchantHref('produtos')}" class="metric-card metric-card--link">
        <div class="metric-card__value">${activeProducts}</div>
        <div class="metric-card__label">Produtos ativos</div>
      </a>
      <a href="${merchantHref('pedidos')}" class="metric-card metric-card--link">
        <div class="metric-card__value">${orders.length}</div>
        <div class="metric-card__label">Pedidos</div>
      </a>
      <div class="metric-card">
        <div class="metric-card__value">${formatCurrency(revenue)}</div>
        <div class="metric-card__label">Volume de pedidos</div>
      </div>
      <div class="metric-card">
        <div class="metric-card__value">${escapeHtml(plan.name)}</div>
        <div class="metric-card__label">${formatPlanPrice(plan.priceMonthly)}</div>
      </div>
    </div>`
}

function merchantQuickActions(store) {
  return `
    <div class="admin-quick-actions">
      <a href="${merchantHref('produtos')}" class="admin-quick-card">
        <span class="admin-quick-card__icon">📦</span>
        <strong>Produtos</strong>
        <span>Gerenciar catálogo</span>
      </a>
      <a href="${merchantHref('pedidos')}" class="admin-quick-card">
        <span class="admin-quick-card__icon">🛒</span>
        <strong>Pedidos</strong>
        <span>Ver solicitações</span>
      </a>
      <a href="${merchantHref('configuracoes')}" class="admin-quick-card">
        <span class="admin-quick-card__icon">⚙️</span>
        <strong>Configurações</strong>
        <span>Dados da loja</span>
      </a>
      ${store.status === 'approved' ? `
        <a href="#/loja/${escapeHtml(store.slug)}" class="admin-quick-card">
          <span class="admin-quick-card__icon">🏪</span>
          <strong>Vitrine</strong>
          <span>Ver como cliente</span>
        </a>` : `
        <span class="admin-quick-card admin-quick-card--muted">
          <span class="admin-quick-card__icon">🏪</span>
          <strong>Vitrine</strong>
          <span>Após aprovação</span>
        </span>`}
    </div>`
}

function renderRecentOrders(orders) {
  if (orders.length === 0) {
    return merchantEmptyState('🛒', 'Nenhum pedido ainda', 'Quando clientes pedirem pelo WhatsApp, os pedidos aparecerão aqui.')
  }

  return `
    <div class="table-wrap admin-orders-table">
      <table>
        <thead><tr><th>Data</th><th>Cliente</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>
          ${orders.slice(0, 5).map((o) => `
            <tr>
              <td>${formatDate(o.created_at)}</td>
              <td>${escapeHtml(o.customer_name)}</td>
              <td>${formatCurrency(o.total)}</td>
              <td>${orderStatusBadge(o.status)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`
}

function renderLowStockAlert(products) {
  const lowStock = products.filter((p) => p.active && p.stock <= LOW_STOCK_THRESHOLD)
  if (lowStock.length === 0) return ''

  return `
    <section class="admin-section">
      <div class="admin-section__head">
        <h2>Estoque baixo</h2>
        <a href="${merchantHref('produtos')}" class="btn btn-outline btn-sm">Ver produtos</a>
      </div>
      <div class="merchant-alert-list">
        ${lowStock.slice(0, 5).map((p) => `
          <div class="merchant-alert-item">
            <strong>${escapeHtml(p.name)}</strong>
            <span class="badge badge-pending">${p.stock} un.</span>
          </div>
        `).join('')}
      </div>
    </section>`
}

function productImageLimitHintHtml(store, products, product = null) {
  if (!store || planAllowsUnlimitedProductImages(store.plan_id)) return ''

  const withImages = countProductsWithImages(products)
  const remaining = freePlanProductImagesRemaining(store.plan_id, withImages)
  const allowed = canAddProductImage(store.plan_id, withImages, Boolean(product?.image))

  if (!allowed) {
    return `<p class="form-hint form-hint--info">${escapeHtml(FREE_PLAN_PRODUCT_IMAGE_MESSAGE)} <a href="#/regras">Ver planos</a></p>`
  }

  return `<p class="form-hint">Plano Gratuito: ${withImages}/${FREE_PLAN_PRODUCT_IMAGE_LIMIT} produtos com imagem${remaining > 0 ? ` — restam ${remaining}` : ''}</p>`
}

function renderProductTableRows(products, categories, store) {
  if (products.length === 0) return ''

  const withImages = countProductsWithImages(products)

  return products.map((p) => {
    const canAddImage = canAddProductImage(store.plan_id, withImages, Boolean(p.image))
    return `
      <tr
        data-product-row
        data-product-name="${escapeHtml(p.name.toLowerCase())}"
        data-product-active="${p.active ? '1' : '0'}"
      >
        <td>
          <div class="admin-table-thumb">
            ${p.image ? `<img src="${escapeHtml(p.image)}" alt="" />` : '<span>📦</span>'}
          </div>
          <strong>${escapeHtml(p.name)}</strong>
        </td>
        <td>${formatCurrency(p.price)}</td>
        <td>${p.stock <= LOW_STOCK_THRESHOLD ? `<span class="badge badge-pending">${p.stock}</span>` : p.stock}</td>
        <td>${p.active ? '<span class="badge badge-approved">Ativo</span>' : '<span class="badge badge-blocked">Inativo</span>'}</td>
        <td style="white-space:nowrap">
          <button type="button" class="btn btn-outline btn-sm" data-edit-product="${p.id}">Editar</button>
          <button type="button" class="btn btn-outline btn-sm" data-del-product="${p.id}">Excluir</button>
        </td>
      </tr>
      <tr class="admin-edit-row" id="edit-product-row-${p.id}" hidden>
        <td colspan="5">
          <form class="admin-edit-panel admin-form-grid" data-product-edit="${p.id}">
            <div class="form-group">
              <label class="form-label">Nome</label>
              <input class="form-input" name="name" value="${escapeHtml(p.name)}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Preço (R$)</label>
              <input class="form-input" name="price" type="number" step="0.01" min="0" value="${p.price}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Estoque</label>
              <input class="form-input" name="stock" type="number" min="0" value="${p.stock}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Categoria</label>
              <select class="form-input" name="category_id">
                <option value="">Sem categoria</option>
                ${categories.map((c) => `<option value="${c.id}" ${p.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Ativo</label>
              <select class="form-input" name="active">
                <option value="true" ${p.active ? 'selected' : ''}>Sim</option>
                <option value="false" ${!p.active ? 'selected' : ''}>Não</option>
              </select>
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">Descrição</label>
              <textarea class="form-input" name="description" rows="2">${escapeHtml(p.description ?? '')}</textarea>
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">Imagem</label>
              <div class="admin-image-field">
                <div data-preview-product="${p.id}">${imagePreviewBlock(p.image, p.name, 'square')}</div>
                ${productImageLimitHintHtml(store, products, p)}
                <input class="form-input" type="file" name="image" accept="image/*" ${canAddImage ? '' : 'disabled'} />
                ${canAddImage ? `<small class="form-hint">${PRODUCT_IMAGE_UPLOAD_HINT}</small>` : ''}
              </div>
            </div>
            <div class="admin-edit-panel__actions admin-form-grid__full">
              <button type="submit" class="btn btn-primary btn-sm">Salvar</button>
              <button type="button" class="btn btn-outline btn-sm" data-cancel-product="${p.id}">Cancelar</button>
            </div>
          </form>
        </td>
      </tr>`
  }).join('')
}

function renderOrderRows(orders) {
  return orders.map((o) => `
    <tr
      data-order-row
      data-order-search="${escapeHtml(`${o.customer_name} ${o.customer_phone}`.toLowerCase())}"
      data-order-status="${escapeHtml(o.status)}"
    >
      <td>${formatDate(o.created_at)}</td>
      <td><strong>${escapeHtml(o.customer_name)}</strong></td>
      <td>${escapeHtml(o.customer_phone)}</td>
      <td>${formatCurrency(o.total)}</td>
      <td>${orderStatusBadge(o.status)}</td>
    </tr>
  `).join('')
}

function merchantBrandingSection(store) {
  if (!planAllowsStoreBranding(store.plan_id)) {
    return `
      <section class="merchant-branding merchant-branding--locked">
        <h2 class="merchant-branding__title">Logo e banner</h2>
        <p class="form-hint form-hint--info">${escapeHtml(FREE_PLAN_BRANDING_MESSAGE)}</p>
        <p style="margin-top:0.75rem;font-size:0.875rem">
          <a href="#/regras">Ver planos e fazer upgrade</a>
        </p>
        ${store.logo || store.banner ? `
          <div class="merchant-branding__readonly" style="margin-top:1rem">
            <p style="font-size:0.8125rem;color:var(--text-secondary);margin-bottom:0.5rem">Imagens atuais (somente leitura no plano Gratuito):</p>
            <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-start">
              ${store.logo ? `<div>${imagePreviewBlock(store.logo, store.name, 'square')}</div>` : ''}
              ${store.banner ? `<div style="flex:1;min-width:12rem">${imagePreviewBlock(store.banner, store.name, 'banner')}</div>` : ''}
            </div>
          </div>` : ''}
      </section>`
  }

  return `
    <section class="merchant-branding">
      <h2 class="merchant-branding__title">Logo e banner</h2>
      <p style="font-size:0.8125rem;color:var(--text-secondary);margin-bottom:1rem">${STORE_BRANDING_UPLOAD_HINT}</p>
      <div class="form-group">
        <label class="form-label">Logo da loja</label>
        <div class="admin-image-field">
          <div data-preview-logo>${imagePreviewBlock(store.logo, store.name, 'square')}</div>
          <input class="form-input" type="file" name="logo" accept="image/*" />
        </div>
        ${store.logo ? '<label class="admin-check"><input type="checkbox" name="remove_logo" /> Remover logo atual</label>' : ''}
      </div>
      <div class="form-group">
        <label class="form-label">Banner da loja</label>
        <div class="admin-image-field">
          <div data-preview-banner>${imagePreviewBlock(store.banner, store.name, 'banner')}</div>
          <input class="form-input" type="file" name="banner" accept="image/*" />
        </div>
        ${store.banner ? '<label class="admin-check"><input type="checkbox" name="remove_banner" /> Remover banner atual</label>' : ''}
      </div>
    </section>`
}

function bindListFilters(main, {
  searchId, rowSelector, getSearchText, getFilterValue,
  chipSelector = '[data-filter]',
}) {
  const search = main.querySelector(`#${searchId}`)
  const chips = main.querySelectorAll(chipSelector)
  const rows = main.querySelectorAll(rowSelector)
  let activeFilter = 'all'

  const apply = () => {
    const term = search?.value.trim().toLowerCase() ?? ''
    rows.forEach((row) => {
      const matchesSearch = !term || getSearchText(row).includes(term)
      const matchesFilter = activeFilter === 'all' || getFilterValue(row) === activeFilter
      const visible = matchesSearch && matchesFilter
      row.hidden = !visible
      const editBtn = row.querySelector('[data-edit-product]')
      if (editBtn) {
        const editRow = main.querySelector(`#edit-product-row-${editBtn.dataset.editProduct}`)
        if (editRow && !visible) editRow.hidden = true
      }
    })
  }

  search?.addEventListener('input', apply)
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      activeFilter = chip.dataset.filter
      chips.forEach((c) => c.classList.toggle('active', c === chip))
      apply()
    })
  })
}

function bindOrderFilters(main) {
  const search = main.querySelector('#merchant-orders-search')
  const chips = main.querySelectorAll('[data-order-status]')
  const rows = main.querySelectorAll('[data-order-row]')
  let activeStatus = 'all'

  const apply = () => {
    const term = search?.value.trim().toLowerCase() ?? ''
    rows.forEach((row) => {
      const matchesSearch = !term || (row.dataset.orderSearch ?? '').includes(term)
      const matchesStatus = activeStatus === 'all' || row.dataset.orderStatus === activeStatus
      row.hidden = !(matchesSearch && matchesStatus)
    })
  }

  search?.addEventListener('input', apply)
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      activeStatus = chip.dataset.orderStatus
      chips.forEach((c) => c.classList.toggle('active', c === chip))
      apply()
    })
  })
}

function bindProductEdits(main, store) {
  main.querySelectorAll('[data-edit-product]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editProduct
      main.querySelectorAll('.admin-edit-row[id^="edit-product-row-"]').forEach((row) => {
        row.hidden = row.id !== `edit-product-row-${id}`
      })
      main.querySelector(`#edit-product-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  })

  main.querySelectorAll('[data-cancel-product]').forEach((btn) => {
    btn.addEventListener('click', () => {
      main.querySelector(`#edit-product-row-${btn.dataset.cancelProduct}`).hidden = true
    })
  })

  main.querySelectorAll('[data-product-edit]').forEach((form) => {
    const id = form.dataset.productEdit
    const imageInput = form.querySelector('input[name="image"]')
    bindImagePreview(imageInput, form.querySelector(`[data-preview-product="${id}"]`))

    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const submitBtn = form.querySelector('button[type="submit"]')
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Salvando...' }
      try {
        const imageFile = imageInput?.files?.[0]
        if (imageFile) {
          const err = validateImageFile(imageFile, STORAGE_BUCKETS.products)
          if (err) throw new Error(err)
        }
        await updateProduct(id, {
          name: form.name.value.trim(),
          description: form.description.value.trim(),
          price: parseFloat(form.price.value),
          stock: parseInt(form.stock.value, 10),
          category_id: form.category_id.value,
          active: form.active.value === 'true',
          image: imageFile,
        })
        showToast('Produto atualizado!')
        renderMerchantDashboard(main, 'products')
      } catch (err) {
        showToast(err.message)
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Salvar' }
      }
    })
  })

  main.querySelectorAll('[data-del-product]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este produto?')) return
      await deleteProduct(btn.dataset.delProduct)
      showToast('Produto excluído')
      renderMerchantDashboard(main, 'products')
    })
  })
}

function bindProductForm(main, store) {
  const productForm = main.querySelector('#product-form')
  bindImagePreview(
    productForm?.querySelector('input[name="image"]'),
    main.querySelector('[data-preview-product-create]'),
  )

  productForm?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const f = e.target
    const submitBtn = f.querySelector('button[type="submit"]')
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Salvando...' }
    try {
      const imageFile = f.image?.files?.[0]
      if (imageFile) {
        const err = validateImageFile(imageFile, STORAGE_BUCKETS.products)
        if (err) throw new Error(err)
      }
      await createProduct(store.id, {
        name: f.name.value.trim(),
        description: f.description.value.trim(),
        price: parseFloat(f.price.value),
        stock: parseInt(f.stock.value, 10),
        category_id: f.category_id.value,
        active: true,
        image: imageFile,
      })
      showToast('Produto criado!')
      renderMerchantDashboard(main, 'products')
    } catch (err) {
      main.querySelector('#product-msg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Salvar produto' }
    }
  })
}

function bindSettingsForm(main, store) {
  const form = main.querySelector('#settings-form')
  if (planAllowsStoreBranding(store.plan_id)) {
    bindImagePreview(form.querySelector('input[name="logo"]'), form.querySelector('[data-preview-logo]'))
    bindImagePreview(form.querySelector('input[name="banner"]'), form.querySelector('[data-preview-banner]'))
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const f = e.target
    const submitBtn = f.querySelector('button[type="submit"]')
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Salvando...' }
    try {
      const payload = {
        name: f.name.value.trim(),
        whatsapp: f.whatsapp.value.trim(),
        description: f.description.value.trim(),
        category_id: f.category_id.value,
        theme_color: f.theme_color.value,
        opening_hours: f.opening_hours.value.trim(),
      }

      if (planAllowsStoreBranding(store.plan_id)) {
        const logoFile = f.logo?.files?.[0]
        const bannerFile = f.banner?.files?.[0]
        if (logoFile) payload.logo = logoFile
        if (bannerFile) payload.banner = bannerFile
        if (!logoFile && f.remove_logo?.checked) payload.remove_logo = true
        if (!bannerFile && f.remove_banner?.checked) payload.remove_banner = true
      }

      await updateStore(store.id, payload)
      showToast('Configurações salvas!')
      if (planAllowsStoreBranding(store.plan_id) && (payload.logo || payload.banner || payload.remove_logo || payload.remove_banner)) {
        renderMerchantDashboard(main, 'settings')
      }
    } catch (err) {
      main.querySelector('#settings-msg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Salvar alterações' }
    }
  })
}

function refreshHeader() {
  import('../ui.js').then(({ renderHeader }) => renderHeader()).catch(() => {})
}

export async function renderMerchantDashboard(main, tab = 'overview') {
  const user = guardMerchant(main)
  if (!user) return

  const store = await fetchStoreByOwner(user.id)
  if (!store) {
    main.innerHTML = merchantPage(
      'Sua loja',
      'Cadastre sua loja para começar a vender',
      merchantEmptyState('🏪', 'Nenhuma loja cadastrada', 'Complete o cadastro para acessar o painel.', '<a href="#/lojista/cadastro" class="btn btn-primary btn-sm">Cadastrar loja</a>'),
    )
    return
  }

  refreshHeader()
  const menuItem = getMerchantMenuItem(tab)

  if (tab === 'overview') {
    const [products, orders] = await Promise.all([
      fetchMerchantProducts(store.id),
      fetchOrdersByStore(store.id),
    ])

    main.innerHTML = merchantPage(
      menuItem.label,
      store.name,
      `
        ${storeStatusBanner(store)}
        ${merchantMetrics({ products, orders, store })}
        ${merchantQuickActions(store)}
        ${renderLowStockAlert(products)}
        <section class="admin-section">
          <div class="admin-section__head">
            <h2>Pedidos recentes</h2>
            <a href="${merchantHref('pedidos')}" class="btn btn-outline btn-sm">Ver todos</a>
          </div>
          ${renderRecentOrders(orders)}
        </section>
      `,
    )
    return
  }

  if (tab === 'products') {
    const [products, categories] = await Promise.all([
      fetchMerchantProducts(store.id),
      fetchCategories(),
    ])
    const withImages = countProductsWithImages(products)
    const canAddImage = canAddProductImage(store.plan_id, withImages)
    const remaining = freePlanProductImagesRemaining(store.plan_id, withImages)
    const imageLimitHint = !planAllowsUnlimitedProductImages(store.plan_id)
      ? (canAddImage
        ? `<p class="form-hint">Plano Gratuito: ${withImages}/${FREE_PLAN_PRODUCT_IMAGE_LIMIT} produtos com imagem${remaining > 0 ? ` — restam ${remaining}` : ''}</p>`
        : `<p class="form-hint form-hint--info">${escapeHtml(FREE_PLAN_PRODUCT_IMAGE_MESSAGE)} <a href="#/regras">Ver planos</a></p>`)
      : ''

    main.innerHTML = merchantPage(
      menuItem.label,
      `${products.length} produto${products.length === 1 ? '' : 's'} cadastrado${products.length === 1 ? '' : 's'}`,
      `
        <div id="product-msg"></div>
        <details class="admin-form-panel" open>
          <summary>Novo produto</summary>
          <form id="product-form" class="admin-form-grid" style="margin-top:1rem">
            <div class="form-group admin-form-grid__full">
              <label class="form-label">Nome</label>
              <input class="form-input" name="name" placeholder="Nome do produto" required />
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">Descrição</label>
              <textarea class="form-input" name="description" placeholder="Descrição" rows="2"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Preço (R$)</label>
              <input class="form-input" name="price" type="number" step="0.01" min="0" required />
            </div>
            <div class="form-group">
              <label class="form-label">Estoque</label>
              <input class="form-input" name="stock" type="number" min="0" required />
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">Categoria</label>
              <select class="form-input" name="category_id">
                <option value="">Sem categoria</option>
                ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">Imagem do produto</label>
              <div class="admin-image-field">
                <div data-preview-product-create>${imagePreviewBlock(null, 'Novo produto', 'square')}</div>
                ${imageLimitHint}
                <input class="form-input" type="file" name="image" accept="image/*" ${canAddImage ? '' : 'disabled'} />
                ${canAddImage ? `<small class="form-hint">${PRODUCT_IMAGE_UPLOAD_HINT}</small>` : ''}
              </div>
            </div>
            <div class="admin-form-grid__full">
              <button type="submit" class="btn btn-primary btn-sm">Salvar produto</button>
            </div>
          </form>
        </details>

        <section class="admin-section">
          <div class="admin-section__head">
            <h2>Catálogo</h2>
            <span class="admin-stat-chip admin-stat-chip--sent">${products.filter((p) => p.active).length} ativos</span>
          </div>
          ${products.length === 0
            ? merchantEmptyState('📦', 'Nenhum produto', 'Cadastre seu primeiro produto usando o formulário acima.')
            : `
              <div class="admin-filter-bar admin-filter-bar--compact">
                <input type="search" class="form-input admin-filter-bar__search" id="merchant-products-search" placeholder="Buscar produto..." autocomplete="off" />
                <div class="admin-filter-chips" role="group">
                  <button type="button" class="admin-filter-chip active" data-filter="all">Todos</button>
                  <button type="button" class="admin-filter-chip" data-filter="1">Ativos</button>
                  <button type="button" class="admin-filter-chip" data-filter="0">Inativos</button>
                </div>
              </div>
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Produto</th><th>Preço</th><th>Estoque</th><th>Status</th><th></th></tr></thead>
                  <tbody>${renderProductTableRows(products, categories, store)}</tbody>
                </table>
              </div>`}
        </section>
      `,
    )

    bindProductForm(main, store)
    bindProductEdits(main, store)
    bindListFilters(main, {
      searchId: 'merchant-products-search',
      rowSelector: '[data-product-row]',
      getSearchText: (row) => row.dataset.productName ?? '',
      getFilterValue: (row) => row.dataset.productActive ?? '',
    })
    return
  }

  if (tab === 'orders') {
    const orders = await fetchOrdersByStore(store.id)
    const revenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0)
    const statusCounts = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1
      return acc
    }, {})

    main.innerHTML = merchantPage(
      menuItem.label,
      `${orders.length} pedido${orders.length === 1 ? '' : 's'} · ${formatCurrency(revenue)} em volume`,
      `
        ${orders.length > 0 ? `
          <div class="admin-stat-chips" style="margin-bottom:1rem">
            <span class="admin-stat-chip admin-stat-chip--sent">${statusCounts.sent ?? 0} enviados</span>
            <span class="admin-stat-chip admin-stat-chip--viewed">${statusCounts.viewed ?? 0} visualizados</span>
            <span class="admin-stat-chip admin-stat-chip--pending">${statusCounts.pending ?? 0} pendentes</span>
          </div>` : ''}
        ${orders.length === 0
          ? merchantEmptyState('🛒', 'Nenhum pedido', 'Os pedidos feitos pelo WhatsApp aparecerão aqui automaticamente.')
          : `
            <div class="admin-filter-bar admin-filter-bar--compact">
              <input type="search" class="form-input admin-filter-bar__search" id="merchant-orders-search" placeholder="Buscar cliente ou telefone..." autocomplete="off" />
              <div class="admin-filter-chips" role="group">
                <button type="button" class="admin-filter-chip active" data-order-status="all">Todos</button>
                <button type="button" class="admin-filter-chip" data-order-status="sent">Enviados</button>
                <button type="button" class="admin-filter-chip" data-order-status="viewed">Visualizados</button>
                <button type="button" class="admin-filter-chip" data-order-status="pending">Pendentes</button>
              </div>
            </div>
            <div class="table-wrap admin-orders-table">
              <table>
                <thead><tr><th>Data</th><th>Cliente</th><th>Telefone</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>${renderOrderRows(orders)}</tbody>
              </table>
            </div>`}
      `,
    )

    if (orders.length > 0) bindOrderFilters(main)
    return
  }

  if (tab === 'settings') {
    const categories = await fetchCategories()
    const plan = getPlanById(store.plan_id)
    const theme = STORE_THEME_COLORS.find((c) => c.id === store.theme_color)

    main.innerHTML = merchantPage(
      menuItem.label,
      'Dados e aparência da sua loja',
      `
        <div id="settings-msg"></div>
        <div class="merchant-settings-layout">
          <aside class="merchant-settings-aside">
            <div class="merchant-store-card">
              <div class="merchant-store-card__swatch" style="background:linear-gradient(135deg, ${theme?.gradientFrom ?? '#448AFF'}, ${theme?.gradientTo ?? '#1565C0'})"></div>
              <h3>${escapeHtml(store.name)}</h3>
              <p>${escapeHtml(store.city ?? '')}${store.state ? ` · ${escapeHtml(store.state)}` : ''}</p>
              <div style="margin-top:0.75rem">${storeStatusBadge(store.status)}</div>
              <p class="merchant-store-card__plan">Plano ${escapeHtml(plan.name)} · ${formatPlanPrice(plan.priceMonthly)}</p>
              ${store.status === 'approved' ? `<a href="#/loja/${escapeHtml(store.slug)}" class="btn btn-outline btn-sm" style="margin-top:0.75rem">Ver vitrine</a>` : ''}
            </div>
          </aside>
          <form id="settings-form" class="merchant-settings-form merchant-settings-main">
            <section class="merchant-settings-section">
              <h2>Informações da loja</h2>
              <div class="admin-form-grid">
                <div class="form-group admin-form-grid__full">
                  <label class="form-label">Nome</label>
                  <input class="form-input" name="name" value="${escapeHtml(store.name)}" required />
                </div>
                <div class="form-group">
                  <label class="form-label">WhatsApp</label>
                  <input class="form-input" name="whatsapp" value="${escapeHtml(store.whatsapp)}" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Horário</label>
                  <input class="form-input" name="opening_hours" value="${escapeHtml(store.opening_hours ?? '')}" placeholder="Ex: Seg–Sex 9h–18h" />
                </div>
                <div class="form-group admin-form-grid__full">
                  <label class="form-label">Descrição</label>
                  <textarea class="form-input" name="description" rows="3">${escapeHtml(store.description ?? '')}</textarea>
                </div>
                <div class="form-group">
                  <label class="form-label">Categoria</label>
                  <select class="form-input" name="category_id">
                    ${categories.map((c) => `<option value="${c.id}" ${store.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Cor do tema</label>
                  <select class="form-input" name="theme_color">
                    ${STORE_THEME_COLORS.map((c) => `<option value="${c.id}" ${store.theme_color === c.id ? 'selected' : ''}>${c.id}</option>`).join('')}
                  </select>
                </div>
              </div>
            </section>
            ${merchantBrandingSection(store)}
            <button type="submit" class="btn btn-primary">Salvar alterações</button>
          </form>
        </div>
      `,
    )

    bindSettingsForm(main, store)
  }
}