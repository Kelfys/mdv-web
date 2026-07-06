/**
 * Painel do lojista — produtos, pedidos, anúncios e configurações da loja.
 */
import {
  fetchStoreByOwner, fetchMerchantProducts, fetchOrdersByStore,
  createProduct, updateProduct, deleteProduct, updateStore, fetchCategories,
  updatePassword, fetchMerchantOrdersAnalytics, fetchStoreViewStats,
  fetchReviewsByStore, fetchStoreAds, createStoreAd, updateOrderStatus,
  fetchProductPriceHistory, countUnreadMerchantOrders, subscribeToStoreOrders,
  createPlanChangeRequest, fetchStorePendingPlanChangeRequest,
} from '../api.js'
import { getUser, setMerchantNewOrdersCount } from '../state.js'
import {
  escapeHtml, formatCurrency, formatDate, formatDateTimeCsv,
  buildCsv, downloadTextFile, showToast,
} from '../utils.js'
import { STORE_THEME_COLORS } from '../config.js'
import {
  planAllowsStoreBranding, FREE_PLAN_BRANDING_MESSAGE,
  countProductsWithImages, canAddProductImage, canCreateProduct,
  planProductImageLimitMessage, planProductLimitMessage,
  formatProductLimitHint, formatProductImageLimitHint,
  getPlanById, formatPlanPrice,
  getPriceCooldownRemaining, formatPriceCooldownRemaining,
  getPlanPriceCooldownHours,
  renderSubscriptionPlanCards,
} from '../plans.js'
import {
  STORE_BRANDING_UPLOAD_HINT, PRODUCT_IMAGE_UPLOAD_HINT,
  validateImageFile, STORAGE_BUCKETS,
} from '../uploads.js'
import { MERCHANT_PANEL, getMerchantMenuItem, merchantHref } from '../merchant-nav.js'
import { renderOrdersChart, bindOrdersChart } from '../order-charts.js'
import { bindPaginatedSortableList } from '../list-utils.js'
import { routeHref } from '../router.js'
import {
  isService, getCatalogItemIcon, getCatalogItemLabel,
  catalogItemTypeFieldHtml, catalogStockFieldHtml, bindCatalogItemTypeForm, readCatalogItemForm,
} from '../catalog.js'
import {
  getPaymentMethodLabel, PAYMENT_METHODS, normalizeStorePaymentMethods,
} from '../payment.js'

const ORDER_STATUS_LABELS = {
  pending: 'Pendente',
  sent: 'Enviado',
  viewed: 'Visualizado',
}

const LOW_STOCK_THRESHOLD = 3
const PRODUCTS_PAGE_SIZE = 15
const ORDERS_PAGE_SIZE = 15

const PRODUCT_SORT_DEFAULTS = { name: 'asc', price: 'asc', stock: 'desc' }

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
    main.innerHTML = `<div class="empty-state"><h2>Acesso restrito</h2><p><a href="${routeHref('/conta/entrar')}">Entrar</a></p></div>`
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

function adStatusBadge(status) {
  const map = {
    pending: '<span class="badge badge-pending">Aguardando aprovação</span>',
    approved: '<span class="badge badge-approved">Ativo</span>',
    rejected: '<span class="badge badge-blocked">Rejeitado</span>',
    expired: '<span class="badge badge-order-pending">Expirado</span>',
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
      ${store.status === 'approved' ? `<a href="${routeHref(`/loja/${store.slug}`)}" class="btn btn-outline btn-sm">Ver loja pública</a>` : ''}
    </div>`
}

function merchantMetrics({ products, orders, store, viewStats }) {
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
        <div class="metric-card__value">${viewStats?.total ?? 0}</div>
        <div class="metric-card__label">Visualizações${viewStats?.week ? ` · ${viewStats.week} na semana` : ''}</div>
      </div>
      <a href="${merchantHref('planos')}" class="metric-card metric-card--link">
        <div class="metric-card__value">${escapeHtml(plan.name)}</div>
        <div class="metric-card__label">${formatPlanPrice(plan.priceMonthly)} · Ver planos</div>
      </a>
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
      <a href="${merchantHref('anuncios')}" class="admin-quick-card">
        <span class="admin-quick-card__icon">📣</span>
        <strong>Anúncios</strong>
        <span>Divulgar no feed</span>
      </a>
      <a href="${merchantHref('planos')}" class="admin-quick-card">
        <span class="admin-quick-card__icon">💎</span>
        <strong>Planos</strong>
        <span>Assinar ou renovar</span>
      </a>
      <a href="${merchantHref('configuracoes')}" class="admin-quick-card">
        <span class="admin-quick-card__icon">⚙️</span>
        <strong>Configurações</strong>
        <span>Dados da loja</span>
      </a>
      ${store.status === 'approved' ? `
        <a href="${routeHref(`/loja/${store.slug}`)}" class="admin-quick-card">
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

function merchantOnboardingChecklist(store, products) {
  const activeCount = products.filter((p) => p.active).length
  const items = [
    {
      done: Boolean(store.whatsapp?.trim()),
      label: 'WhatsApp preenchido',
      action: `<a href="${merchantHref('configuracoes')}" class="btn btn-outline btn-sm">Configurar</a>`,
    },
    {
      done: activeCount >= 3,
      label: 'Pelo menos 3 itens ativos no catálogo',
      action: `<a href="${merchantHref('produtos')}" class="btn btn-outline btn-sm">Cadastrar</a>`,
    },
    {
      done: store.status === 'approved',
      label: 'Loja aprovada pelo admin',
      action: store.status === 'pending'
        ? '<span class="badge badge-pending">Em análise</span>'
        : '',
    },
  ]

  const doneCount = items.filter((i) => i.done).length
  if (doneCount === items.length) return ''

  return `
    <section class="admin-section">
      <div class="admin-section__head">
        <h2>Primeiros passos</h2>
        <span class="admin-stat-chip admin-stat-chip--sent">${doneCount}/${items.length} concluídos</span>
      </div>
      <div class="merchant-alert-list">
        ${items.map((item) => `
          <div class="merchant-alert-item">
            <strong>${item.done ? '✅' : '⭕'} ${escapeHtml(item.label)}</strong>
            ${!item.done ? item.action : '<span class="badge badge-approved">Concluído</span>'}
          </div>
        `).join('')}
      </div>
    </section>`
}

function renderRecentOrders(orders) {
  if (orders.length === 0) {
    return merchantEmptyState('🛒', 'Nenhum pedido ainda', 'Quando clientes pedirem pelo WhatsApp, os pedidos aparecerão aqui.')
  }

  return `
    <div class="table-wrap admin-orders-table">
      <table>
        <thead><tr><th>Data</th><th>Cliente</th><th>Pagamento</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>
          ${orders.slice(0, 5).map((o) => `
            <tr>
              <td>${formatDate(o.created_at)}</td>
              <td>${escapeHtml(o.customer_name)}</td>
              <td>${escapeHtml(o.payment_method ? getPaymentMethodLabel(o.payment_method) : '—')}</td>
              <td>${formatCurrency(o.total)}</td>
              <td>${orderStatusBadge(o.status)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`
}

function renderLowStockAlert(products) {
  const lowStock = products.filter((p) => p.active && !isService(p) && (p.stock ?? 0) <= LOW_STOCK_THRESHOLD)
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

function renderReviewsSection(reviews) {
  if (reviews.length === 0) {
    return `
      <section class="admin-section">
        <div class="admin-section__head"><h2>Avaliações</h2></div>
        ${merchantEmptyState('⭐', 'Nenhuma avaliação', 'Quando clientes avaliarem sua loja, as notas aparecerão aqui.')}
      </section>`
  }

  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length

  return `
    <section class="admin-section">
      <div class="admin-section__head">
        <h2>Avaliações</h2>
        <span class="stars">★ ${avgRating.toFixed(1)} · ${reviews.length} avaliação${reviews.length === 1 ? '' : 'ões'}</span>
      </div>
      <div class="merchant-alert-list">
        ${reviews.slice(0, 3).map((r) => `
          <div class="merchant-alert-item" style="align-items:flex-start;flex-direction:column;gap:0.375rem">
            <div style="display:flex;justify-content:space-between;width:100%;gap:0.75rem">
              <strong>${escapeHtml(r.user?.name ?? 'Anônimo')}</strong>
              <span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
            </div>
            ${r.comment ? `<p style="font-size:0.8125rem;color:var(--text-secondary);margin:0">${escapeHtml(r.comment)}</p>` : ''}
            <small style="font-size:0.75rem;color:var(--text-muted)">${formatDate(r.created_at)}</small>
          </div>
        `).join('')}
      </div>
    </section>`
}

function renderAdsSummary(ads) {
  const active = ads.filter((a) => a.status === 'approved').length
  const pending = ads.filter((a) => a.status === 'pending').length

  return `
    <section class="admin-section">
      <div class="admin-section__head">
        <h2>Anúncios</h2>
        <a href="${merchantHref('anuncios')}" class="btn btn-outline btn-sm">Gerenciar</a>
      </div>
      ${ads.length === 0
        ? merchantEmptyState('📣', 'Nenhum anúncio', 'Crie anúncios para aparecer no feed principal do marketplace.')
        : `
          <div class="admin-stat-chips">
            <span class="admin-stat-chip admin-stat-chip--approved">${active} ativo${active === 1 ? '' : 's'}</span>
            <span class="admin-stat-chip admin-stat-chip--pending">${pending} pendente${pending === 1 ? '' : 's'}</span>
            <span class="admin-stat-chip admin-stat-chip--sent">${ads.length} no total</span>
          </div>`}
    </section>`
}

function priceCooldownHintHtml(planId, product) {
  const changedAt = product.price_changed_at ?? product.created_at
  const cooldown = getPriceCooldownRemaining(planId, changedAt)
  const hours = getPlanPriceCooldownHours(planId)

  if (cooldown.allowed) {
    if (hours === null) return ''
    return `<small class="form-hint">No seu plano, o preço pode ser alterado a cada ${hours}h.</small>`
  }

  return `<small class="form-hint form-hint--info">Aguarde ${formatPriceCooldownRemaining(cooldown.remainingMs)} para alterar o preço novamente.</small>`
}

function renderPriceHistoryHtml(history) {
  if (!history.length) {
    return '<p class="form-hint">Nenhuma alteração de preço registrada.</p>'
  }

  return `
    <div class="table-wrap" style="margin-top:0.25rem">
      <table>
        <thead><tr><th>Data</th><th>De</th><th>Para</th></tr></thead>
        <tbody>
          ${history.map((entry) => `
            <tr>
              <td>${formatDate(entry.changed_at)}</td>
              <td>${formatCurrency(entry.old_price)}</td>
              <td><strong>${formatCurrency(entry.new_price)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`
}

function productImageLimitHintHtml(store, products, product = null) {
  if (!store) return ''

  const withImages = countProductsWithImages(products)
  const allowed = canAddProductImage(store.plan_id, withImages, Boolean(product?.image))

  if (!allowed) {
    return `<p class="form-hint form-hint--info">${escapeHtml(planProductImageLimitMessage(store.plan_id))} <a href="${routeHref('/regras')}">Ver planos</a></p>`
  }

  return `<p class="form-hint">${escapeHtml(formatProductImageLimitHint(store.plan_id, withImages))}</p>`
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
        data-product-price="${p.price}"
        data-product-stock="${isService(p) ? '' : (p.stock ?? 0)}"
        data-product-active="${p.active ? '1' : '0'}"
      >
        <td>
          <div class="admin-table-thumb">
            ${p.image ? `<img src="${escapeHtml(p.image)}" alt="" />` : `<span>${getCatalogItemIcon(p)}</span>`}
          </div>
          <strong>${escapeHtml(p.name)}</strong>
          <br><small class="form-hint">${escapeHtml(getCatalogItemLabel(p))}</small>
        </td>
        <td>${formatCurrency(p.price)}</td>
        <td>${isService(p) ? '—' : ((p.stock ?? 0) <= LOW_STOCK_THRESHOLD ? `<span class="badge badge-pending">${p.stock}</span>` : p.stock)}</td>
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
            ${catalogItemTypeFieldHtml(p.item_type)}
            <div class="form-group">
              <label class="form-label">Preço (R$)</label>
              <input class="form-input" name="price" type="number" step="0.01" min="0" value="${p.price}" required />
              ${priceCooldownHintHtml(store.plan_id, p)}
            </div>
            ${catalogStockFieldHtml(p.stock ?? 0, p.item_type)}
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
            <div class="form-group admin-form-grid__full" data-price-history-panel="${p.id}">
              <label class="form-label">Histórico de preços</label>
              <p class="form-hint">Carregando histórico...</p>
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
      data-order-id="${escapeHtml(o.id)}"
      data-order-status="${escapeHtml(o.status)}"
      data-order-created="${escapeHtml(o.created_at)}"
      data-order-search="${escapeHtml(`${o.customer_name} ${o.customer_phone}`.toLowerCase())}"
    >
      <td>${formatDate(o.created_at)}</td>
      <td><strong>${escapeHtml(o.customer_name)}</strong></td>
      <td>${escapeHtml(o.customer_phone)}</td>
      <td>${escapeHtml(o.payment_method ? getPaymentMethodLabel(o.payment_method) : '—')}</td>
      <td>${formatCurrency(o.total)}</td>
      <td>${orderStatusBadge(o.status)}</td>
      <td style="white-space:nowrap">
        ${o.status === 'sent'
          ? `<button type="button" class="btn btn-outline btn-sm" data-mark-viewed="${escapeHtml(o.id)}">Marcar como visto</button>`
          : '—'}
      </td>
    </tr>
  `).join('')
}

function renderStoreAdRows(ads) {
  return ads.map((ad) => `
    <div class="admin-list-card">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.375rem">
          <strong>${escapeHtml(ad.title)}</strong>
          ${adStatusBadge(ad.status)}
        </div>
        <p>${escapeHtml(ad.message)}</p>
        <p class="admin-list-card__meta">
          Criado em ${formatDate(ad.created_at)}
          ${ad.expires_at ? ` · Expira em ${formatDate(ad.expires_at)}` : ''}
        </p>
      </div>
      ${ad.image_url ? `<div class="admin-table-thumb" style="width:3rem;height:3rem;flex-shrink:0"><img src="${escapeHtml(ad.image_url)}" alt="" /></div>` : ''}
    </div>
  `).join('')
}

function merchantBrandingSection(store) {
  if (!planAllowsStoreBranding(store.plan_id)) {
    return `
      <section class="merchant-branding merchant-branding--locked">
        <h2 class="merchant-branding__title">Logo e banner</h2>
        <p class="form-hint form-hint--info">${escapeHtml(FREE_PLAN_BRANDING_MESSAGE)}</p>
        <p style="margin-top:0.75rem;font-size:0.875rem">
          <a href="${routeHref('/regras')}">Ver planos e fazer upgrade</a>
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

async function renderMerchantPlansPanel(store) {
  const plan = getPlanById(store.plan_id)
  const pendingRequest = await fetchStorePendingPlanChangeRequest(store.id)
  const pendingBanner = pendingRequest
    ? `<div class="alert alert-info" style="margin-bottom:1rem">
        Pedido de mudança para <strong>${escapeHtml(getPlanById(pendingRequest.requested_plan_id).name)}</strong>
        aguardando aprovação desde ${formatDate(pendingRequest.created_at)}.
      </div>`
    : ''

  return `
    ${pendingBanner}
    <div class="merchant-plans-current">
      <div>
        <p class="merchant-plans-current__eyebrow">Plano ativo</p>
        <h2>${escapeHtml(plan.name)} · ${escapeHtml(formatPlanPrice(plan.priceMonthly))}</h2>
        <p class="form-hint">Loja: ${escapeHtml(store.name)}</p>
      </div>
      ${store.status === 'approved' ? `<span class="badge badge-approved">Loja aprovada</span>` : storeStatusBadge(store.status)}
    </div>
    <div class="plan-grid">${renderSubscriptionPlanCards({ currentPlanId: store.plan_id, requestMode: true })}</div>
    <div class="plan-payment-info">
      <p><strong>Como assinar ou renovar:</strong></p>
      <ol>
        <li>Realize o pagamento do plano escolhido.</li>
        <li>Clique em <strong>Solicitar</strong> no card do plano para enviar o pedido ao administrador.</li>
        <li>Use o botão do WhatsApp para enviar o comprovante com o nome da loja e o email cadastrado.</li>
        <li>Após aprovação, o plano é ativado automaticamente na sua conta.</li>
      </ol>
      <p class="form-hint">Dúvidas sobre limites e benefícios? <a href="${routeHref('/regras')}">Leia as regras e planos</a>.</p>
    </div>`
}

function bindPlanRequestActions(main, store) {
  main.querySelectorAll('[data-request-plan]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const planId = btn.dataset.requestPlan
      const plan = getPlanById(planId)
      const actionLabel = planId === store.plan_id ? 'renovação' : `upgrade para ${plan.name}`
      if (!confirm(`Enviar pedido de ${actionLabel}?`)) return

      const originalText = btn.textContent
      btn.disabled = true
      btn.textContent = 'Enviando...'
      try {
        await createPlanChangeRequest(store.id, planId)
        showToast('Pedido enviado! Aguarde aprovação do administrador.')
        renderMerchantDashboard(main, 'plans')
      } catch (err) {
        showToast(err.message)
        btn.disabled = false
        btn.textContent = originalText
      }
    })
  })
}

function renderSettingsPreviewCard(store, plan) {
  const theme = STORE_THEME_COLORS.find((c) => c.id === store.theme_color)
  return `
    <div class="merchant-store-card" id="merchant-settings-preview">
      <div
        class="merchant-store-card__swatch"
        data-preview-swatch
        style="background:linear-gradient(135deg, ${theme?.gradientFrom ?? '#448AFF'}, ${theme?.gradientTo ?? '#1565C0'})"
      ></div>
      <h3 data-preview-name>${escapeHtml(store.name)}</h3>
      <p>${escapeHtml(store.city ?? '')}${store.state ? ` · ${escapeHtml(store.state)}` : ''}</p>
      <div style="margin-top:0.75rem">${storeStatusBadge(store.status)}</div>
      <p class="merchant-store-card__plan">Plano ${escapeHtml(plan.name)} · ${formatPlanPrice(plan.priceMonthly)}</p>
      ${store.status === 'approved' ? `<a href="${routeHref(`/loja/${store.slug}`)}" class="btn btn-outline btn-sm" style="margin-top:0.75rem">Ver vitrine</a>` : ''}
      <a
        href="${merchantHref('planos')}"
        class="btn btn-green btn-sm"
        style="margin-top:0.75rem;display:block;text-align:center"
      >${plan.id === 'premium' ? 'Ver planos' : 'Assinar ou fazer upgrade'}</a>
    </div>`
}

function sortProductRows(rows, sortField, sortDirection) {
  return [...rows].sort((a, b) => {
    let diff = 0
    if (sortField === 'name') {
      diff = (a.dataset.productName ?? '').localeCompare(b.dataset.productName ?? '', 'pt-BR')
    } else if (sortField === 'price') {
      diff = Number(a.dataset.productPrice) - Number(b.dataset.productPrice)
    } else if (sortField === 'stock') {
      diff = Number(a.dataset.productStock) - Number(b.dataset.productStock)
    }
    return sortDirection === 'asc' ? diff : -diff
  })
}

function updateProductSortButtons(main, sortField, sortDirection) {
  main.querySelectorAll('[data-sort-field]').forEach((button) => {
    const field = button.dataset.sortField
    const isActive = field === sortField
    button.classList.toggle('active', isActive)
    const icon = button.querySelector('.admin-table-sort__icon')
    if (!icon) return
    if (!isActive) {
      icon.textContent = ''
      return
    }
    icon.textContent = sortDirection === 'asc' ? '↑' : '↓'
  })
}

function sortOrderRowsByDate(rows, direction = 'desc') {
  return [...rows].sort((a, b) => {
    const diff = new Date(a.dataset.orderCreated).getTime() - new Date(b.dataset.orderCreated).getTime()
    return direction === 'asc' ? diff : -diff
  })
}

function updateMerchantOrdersSortButton(main, _sortField, sortDirection) {
  const button = main.querySelector('#merchant-orders-sort')
  if (!button) return
  button.classList.toggle('active', true)
  const icon = button.querySelector('.admin-table-sort__icon')
  if (icon) icon.textContent = sortDirection === 'asc' ? '↑' : '↓'
  button.setAttribute(
    'aria-label',
    sortDirection === 'asc' ? 'Ordenar por data, mais antigos primeiro' : 'Ordenar por data, mais recentes primeiro',
  )
}

function ordersToCsv(orders) {
  const headers = ['Data', 'Cliente', 'Telefone', 'Endereço', 'Pagamento', 'Total (R$)', 'Status', 'ID']
  const rows = orders.map((o) => [
    formatDateTimeCsv(o.created_at),
    o.customer_name,
    o.customer_phone,
    o.customer_address ?? '',
    o.payment_method ? getPaymentMethodLabel(o.payment_method) : '',
    Number(o.total).toFixed(2),
    ORDER_STATUS_LABELS[o.status] ?? o.status,
    o.id,
  ])
  return buildCsv(headers, rows)
}

function exportOrdersCsv(main, orders) {
  const btn = main.querySelector('#merchant-orders-export')
  if (!btn) return

  btn.addEventListener('click', () => {
    const orderMap = new Map(orders.map((o) => [o.id, o]))
    const toExport = [...main.querySelectorAll('[data-order-row]')]
      .filter((row) => row.dataset.listMatch === '1')
      .map((row) => orderMap.get(row.dataset.orderId))
      .filter(Boolean)

    if (toExport.length === 0) {
      showToast('Nenhum pedido para exportar')
      return
    }

    const date = new Date().toISOString().slice(0, 10)
    downloadTextFile(`pedidos-loja-${date}.csv`, ordersToCsv(toExport))
    showToast(`${toExport.length} pedido(s) exportado(s)`)
  })
}

function closeProductEditRows(main) {
  main.querySelectorAll('.admin-edit-row[id^="edit-product-row-"]').forEach((row) => {
    row.hidden = true
  })
}

function bindProductEdits(main, store) {
  main.querySelectorAll('[data-edit-product]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.editProduct
      main.querySelectorAll('.admin-edit-row[id^="edit-product-row-"]').forEach((row) => {
        row.hidden = row.id !== `edit-product-row-${id}`
      })

      const historyPanel = main.querySelector(`[data-price-history-panel="${id}"]`)
      if (historyPanel) {
        historyPanel.innerHTML = `
          <label class="form-label">Histórico de preços</label>
          <p class="form-hint">Carregando histórico...</p>`
        try {
          const history = await fetchProductPriceHistory(id)
          historyPanel.innerHTML = `
            <label class="form-label">Histórico de preços</label>
            ${renderPriceHistoryHtml(history)}`
        } catch (err) {
          historyPanel.innerHTML = `
            <label class="form-label">Histórico de preços</label>
            <p class="form-hint form-hint--info">${escapeHtml(err.message)}</p>`
        }
      }

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
    bindCatalogItemTypeForm(form)

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
        const catalogFields = readCatalogItemForm(form)
        await updateProduct(id, {
          name: form.name.value.trim(),
          description: form.description.value.trim(),
          price: parseFloat(form.price.value),
          item_type: catalogFields.item_type,
          stock: catalogFields.stock,
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
  bindCatalogItemTypeForm(productForm)

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
      const catalogFields = readCatalogItemForm(f)
      await createProduct(store.id, {
        name: f.name.value.trim(),
        description: f.description.value.trim(),
        price: parseFloat(f.price.value),
        item_type: catalogFields.item_type,
        stock: catalogFields.stock,
        category_id: f.category_id.value,
        active: true,
        image: imageFile,
      })
      showToast('Item cadastrado!')
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
  const previewName = main.querySelector('[data-preview-name]')
  const previewSwatch = main.querySelector('[data-preview-swatch]')

  const updatePreview = () => {
    if (previewName && form?.name) {
      previewName.textContent = form.name.value.trim() || store.name
    }
    if (previewSwatch && form?.theme_color) {
      const theme = STORE_THEME_COLORS.find((c) => c.id === form.theme_color.value)
      if (theme) {
        previewSwatch.style.background = `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`
      }
    }
  }

  form?.name?.addEventListener('input', updatePreview)
  form?.theme_color?.addEventListener('change', updatePreview)

  form?.querySelectorAll('.merchant-payment-toggle input').forEach((input) => {
    input.addEventListener('change', () => {
      form.querySelectorAll('.merchant-payment-toggle').forEach((label) => {
        label.classList.toggle('active', label.querySelector('input')?.checked)
      })
    })
  })

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
      const paymentMethods = [...f.querySelectorAll('input[name="payment_methods"]:checked')].map((el) => el.value)
      if (paymentMethods.length === 0) {
        throw new Error('Selecione pelo menos uma forma de pagamento.')
      }

      const payload = {
        name: f.name.value.trim(),
        whatsapp: f.whatsapp.value.trim(),
        description: f.description.value.trim(),
        category_id: f.category_id.value,
        theme_color: f.theme_color.value,
        opening_hours: f.opening_hours.value.trim(),
        payment_methods: paymentMethods,
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
      } else {
        updatePreview()
      }
    } catch (err) {
      main.querySelector('#settings-msg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Salvar alterações' }
    }
  })
}

function bindAdForm(main, store) {
  const form = main.querySelector('#ad-form')
  bindImagePreview(form?.querySelector('input[name="image"]'), main.querySelector('[data-preview-ad-create]'))

  form?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const f = e.target
    const msgEl = main.querySelector('#ad-msg')
    const submitBtn = f.querySelector('button[type="submit"]')
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Enviando...' }
    try {
      const imageFile = f.image?.files?.[0]
      if (imageFile) {
        const err = validateImageFile(imageFile, STORAGE_BUCKETS.products)
        if (err) throw new Error(err)
      }
      await createStoreAd(store.id, {
        title: f.title.value,
        message: f.message.value,
        image: imageFile,
      })
      showToast('Anúncio enviado para aprovação!')
      renderMerchantDashboard(main, 'ads')
    } catch (err) {
      msgEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Criar anúncio' }
    }
  })
}

function bindPasswordForm(main) {
  main.querySelector('#merchant-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const msgEl = main.querySelector('#merchant-password-msg')
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

function bindMarkViewedActions(main, store) {
  main.querySelectorAll('[data-mark-viewed]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true
      try {
        await updateOrderStatus(btn.dataset.markViewed, 'viewed')
        const count = await countUnreadMerchantOrders(store.id)
        setMerchantNewOrdersCount(count)
        refreshHeader()
        showToast('Pedido marcado como visualizado')
        renderMerchantDashboard(main, 'orders')
      } catch (err) {
        showToast(err.message)
        btn.disabled = false
      }
    })
  })
}

function refreshHeader() {
  import('../ui.js').then(({ renderHeader }) => renderHeader()).catch(() => {})
}

function buildOrdersSubscription(store, tab, main) {
  return subscribeToStoreOrders(store.id, async () => {
    const count = await countUnreadMerchantOrders(store.id)
    setMerchantNewOrdersCount(count)
    refreshHeader()
    showToast('Novo pedido recebido!')
    renderMerchantDashboard(main, tab)
  })
}

export async function renderMerchantDashboard(main, tab = 'overview') {
  const user = guardMerchant(main)
  if (!user) return

  const store = await fetchStoreByOwner(user.id)
  if (!store) {
    main.innerHTML = merchantPage(
      'Sua loja',
      'Cadastre sua loja para começar a vender',
      merchantEmptyState('🏪', 'Nenhuma loja cadastrada', 'Complete o cadastro para acessar o painel.', `<a href="${routeHref('/lojista/cadastro')}" class="btn btn-primary btn-sm">Cadastrar loja</a>`),
    )
    return
  }

  const unreadCount = await countUnreadMerchantOrders(store.id)
  setMerchantNewOrdersCount(unreadCount)
  refreshHeader()

  const menuItem = getMerchantMenuItem(tab)

  if (tab === 'overview') {
    const [
      products, orders, orderAnalytics, viewStats, reviews, ads,
    ] = await Promise.all([
      fetchMerchantProducts(store.id),
      fetchOrdersByStore(store.id),
      fetchMerchantOrdersAnalytics(store.id),
      fetchStoreViewStats(store.id),
      fetchReviewsByStore(store.id),
      fetchStoreAds(store.id),
    ])

    const chartSeries = orderAnalytics.timeline
    main.innerHTML = merchantPage(
      menuItem.label,
      store.name,
      `
        ${storeStatusBanner(store)}
        ${merchantMetrics({ products, orders, store, viewStats })}
        ${merchantQuickActions(store)}
        ${merchantOnboardingChecklist(store, products)}
        ${renderOrdersChart(chartSeries, { period: '7d', metric: 'orders', compact: true, chartId: 'merchant-overview-chart' })}
        ${renderLowStockAlert(products)}
        <section class="admin-section">
          <div class="admin-section__head">
            <h2>Pedidos recentes</h2>
            <a href="${merchantHref('pedidos')}" class="btn btn-outline btn-sm">Ver todos</a>
          </div>
          ${renderRecentOrders(orders)}
        </section>
        ${renderReviewsSection(reviews)}
        ${renderAdsSummary(ads)}
      `,
    )

    return buildOrdersSubscription(store, 'overview', main)
  }

  if (tab === 'products') {
    const [products, categories] = await Promise.all([
      fetchMerchantProducts(store.id),
      fetchCategories(),
    ])
    const withImages = countProductsWithImages(products)
    const canAddImage = canAddProductImage(store.plan_id, withImages)
    const canCreate = canCreateProduct(store.plan_id, products.length)
    const imageLimitHint = canAddImage
      ? `<p class="form-hint">${escapeHtml(formatProductImageLimitHint(store.plan_id, withImages))}</p>`
      : `<p class="form-hint form-hint--info">${escapeHtml(planProductImageLimitMessage(store.plan_id))} <a href="${routeHref('/regras')}">Ver planos</a></p>`
    const productLimitHint = canCreate
      ? `<p class="form-hint">${escapeHtml(formatProductLimitHint(store.plan_id, products.length))}</p>`
      : `<p class="form-hint form-hint--info">${escapeHtml(planProductLimitMessage(store.plan_id))} <a href="${routeHref('/regras')}">Ver planos</a></p>`

    main.innerHTML = merchantPage(
      menuItem.label,
      `${products.length} item${products.length === 1 ? '' : 's'} no catálogo`,
      `
        <div id="product-msg"></div>
        ${canCreate ? `
        <details class="admin-form-panel" open>
          <summary>Novo item do catálogo</summary>
          ${productLimitHint}
          <form id="product-form" class="admin-form-grid" style="margin-top:1rem">
            ${catalogItemTypeFieldHtml('product')}
            <div class="form-group admin-form-grid__full">
              <label class="form-label">Nome</label>
              <input class="form-input" name="name" placeholder="Nome do produto ou serviço" required />
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">Descrição</label>
              <textarea class="form-input" name="description" placeholder="Descrição" rows="2"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Preço (R$)</label>
              <input class="form-input" name="price" type="number" step="0.01" min="0" required />
            </div>
            ${catalogStockFieldHtml(0, 'product')}
            <div class="form-group admin-form-grid__full">
              <label class="form-label">Categoria</label>
              <select class="form-input" name="category_id">
                <option value="">Sem categoria</option>
                ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">Imagem</label>
              <div class="admin-image-field">
                <div data-preview-product-create>${imagePreviewBlock(null, 'Novo produto', 'square')}</div>
                ${imageLimitHint}
                <input class="form-input" type="file" name="image" accept="image/*" ${canAddImage ? '' : 'disabled'} />
                ${canAddImage ? `<small class="form-hint">${PRODUCT_IMAGE_UPLOAD_HINT}</small>` : ''}
              </div>
            </div>
            <div class="admin-form-grid__full">
              <button type="submit" class="btn btn-primary btn-sm">Salvar item</button>
            </div>
          </form>
        </details>
        ` : `
        <div class="admin-form-panel" style="padding:1rem">
          ${productLimitHint}
        </div>`}

        <section class="admin-section">
          <div class="admin-section__head">
            <h2>Catálogo</h2>
            <span class="admin-stat-chip admin-stat-chip--sent">${products.filter((p) => p.active).length} ativos</span>
          </div>
          ${products.length === 0
            ? merchantEmptyState('📦', 'Catálogo vazio', 'Cadastre seu primeiro produto ou serviço usando o formulário acima.')
            : `
              <div class="admin-filter-bar admin-filter-bar--compact">
                <input type="search" class="form-input admin-filter-bar__search" id="merchant-products-search" placeholder="Buscar no catálogo..." autocomplete="off" />
                <div class="admin-filter-chips" role="group">
                  <button type="button" class="admin-filter-chip active" data-filter="all">Todos</button>
                  <button type="button" class="admin-filter-chip" data-filter="1">Ativos</button>
                  <button type="button" class="admin-filter-chip" data-filter="0">Inativos</button>
                </div>
              </div>
              <div class="table-wrap" id="merchant-products-table">
                <table>
                  <thead><tr>
                    <th class="admin-table-sortable">
                      <button type="button" class="admin-table-sort active" data-sort-field="name" aria-label="Ordenar por nome">
                        Item <span class="admin-table-sort__icon" aria-hidden="true">↑</span>
                      </button>
                    </th>
                    <th class="admin-table-sortable">
                      <button type="button" class="admin-table-sort" data-sort-field="price" aria-label="Ordenar por preço">
                        Preço <span class="admin-table-sort__icon" aria-hidden="true"></span>
                      </button>
                    </th>
                    <th class="admin-table-sortable">
                      <button type="button" class="admin-table-sort" data-sort-field="stock" aria-label="Ordenar por estoque">
                        Estoque <span class="admin-table-sort__icon" aria-hidden="true"></span>
                      </button>
                    </th>
                    <th>Status</th>
                    <th></th>
                  </tr></thead>
                  <tbody id="merchant-products-tbody">
                    ${renderProductTableRows(products, categories, store)}
                    <tr data-products-empty hidden>
                      <td colspan="5">${merchantEmptyState('🔍', 'Nenhum resultado', 'Nenhum produto corresponde aos filtros selecionados.')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div id="merchant-products-pagination-wrap"></div>`}
        </section>
      `,
    )

    bindProductForm(main, store)
    bindProductEdits(main, store)

    if (products.length > 0) {
      bindPaginatedSortableList(main, {
        searchId: 'merchant-products-search',
        rowSelector: '[data-product-row]',
        tbodyId: 'merchant-products-tbody',
        emptyRowSelector: '[data-products-empty]',
        paginationWrapId: 'merchant-products-pagination-wrap',
        sortButtonsSelector: '[data-sort-field]',
        pageSize: PRODUCTS_PAGE_SIZE,
        defaultSortField: 'name',
        defaultSortDirection: 'asc',
        sortDefaults: PRODUCT_SORT_DEFAULTS,
        getSearchText: (row) => row.dataset.productName ?? '',
        getFilterValue: (row) => row.dataset.productActive ?? '',
        sortRow: sortProductRows,
        scrollTarget: main.querySelector('#merchant-products-table'),
        onSortButtonUpdate: updateProductSortButtons,
      })

      main.querySelectorAll('[data-filter]').forEach((chip) => {
        chip.addEventListener('click', () => closeProductEditRows(main))
      })
      main.querySelector('#merchant-products-search')?.addEventListener('input', () => closeProductEditRows(main))
    }
    return
  }

  if (tab === 'orders') {
    const [orders, orderAnalytics] = await Promise.all([
      fetchOrdersByStore(store.id),
      fetchMerchantOrdersAnalytics(store.id),
    ])
    const metrics = orderAnalytics.metrics
    const revenue = metrics.totalRevenue

    main.innerHTML = merchantPage(
      menuItem.label,
      `${metrics.totalOrders} pedido${metrics.totalOrders === 1 ? '' : 's'} · ${formatCurrency(revenue)} em volume`,
      `
        ${metrics.totalOrders > 0 ? `
          <div class="admin-stat-chips" style="margin-bottom:1rem">
            <span class="admin-stat-chip admin-stat-chip--sent">${metrics.byStatus.sent ?? 0} enviados</span>
            <span class="admin-stat-chip admin-stat-chip--viewed">${metrics.byStatus.viewed ?? 0} visualizados</span>
            <span class="admin-stat-chip admin-stat-chip--pending">${metrics.byStatus.pending ?? 0} pendentes</span>
          </div>` : ''}
        ${orders.length === 0
          ? merchantEmptyState('🛒', 'Nenhum pedido', 'Os pedidos feitos pelo WhatsApp aparecerão aqui automaticamente.')
          : `
            <div class="admin-orders-toolbar">
              <div class="admin-filter-bar admin-filter-bar--compact" style="margin:0;flex:1">
                <input type="search" class="form-input admin-filter-bar__search" id="merchant-orders-search" placeholder="Buscar cliente ou telefone..." autocomplete="off" />
                <div class="admin-filter-chips" role="group">
                  <button type="button" class="admin-filter-chip active" data-order-status="all">Todos</button>
                  <button type="button" class="admin-filter-chip" data-order-status="sent">Enviados</button>
                  <button type="button" class="admin-filter-chip" data-order-status="viewed">Visualizados</button>
                  <button type="button" class="admin-filter-chip" data-order-status="pending">Pendentes</button>
                </div>
              </div>
              <button type="button" class="btn btn-outline btn-sm" id="merchant-orders-export">⬇ Exportar CSV</button>
            </div>
            <div class="table-wrap admin-orders-table" style="margin-top:1rem" id="merchant-orders-table">
              <table>
                <thead><tr>
                  <th class="admin-table-sortable">
                    <button type="button" class="admin-table-sort active" id="merchant-orders-sort" data-sort-field="date" aria-label="Ordenar por data, mais recentes primeiro">
                      Data <span class="admin-table-sort__icon" aria-hidden="true">↓</span>
                    </button>
                  </th>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th>Pagamento</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th></th>
                </tr></thead>
                <tbody id="merchant-orders-tbody">
                  ${renderOrderRows(orders)}
                  <tr data-orders-empty hidden>
                    <td colspan="7">${merchantEmptyState('🔍', 'Nenhum resultado', 'Nenhum pedido corresponde aos filtros selecionados.')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div id="merchant-orders-pagination-wrap"></div>`}
      `,
      orders.length > 0
        ? '<span class="admin-export-hint">Exporta todos os pedidos filtrados (todas as páginas)</span>'
        : '',
    )

    if (orders.length > 0) {
      bindPaginatedSortableList(main, {
        searchId: 'merchant-orders-search',
        rowSelector: '[data-order-row]',
        tbodyId: 'merchant-orders-tbody',
        emptyRowSelector: '[data-orders-empty]',
        paginationWrapId: 'merchant-orders-pagination-wrap',
        sortButtonsSelector: '#merchant-orders-sort',
        pageSize: ORDERS_PAGE_SIZE,
        defaultSortField: 'date',
        defaultSortDirection: 'desc',
        sortDefaults: { date: 'desc' },
        getSearchText: (row) => row.dataset.orderSearch ?? '',
        getFilterValue: (row) => row.dataset.orderStatus ?? '',
        chipSelector: '[data-order-status]',
        sortRow: (rows, _field, direction) => sortOrderRowsByDate(rows, direction),
        scrollTarget: main.querySelector('#merchant-orders-table'),
        onSortButtonUpdate: updateMerchantOrdersSortButton,
      })
      exportOrdersCsv(main, orders)
      bindMarkViewedActions(main, store)
    }

    return buildOrdersSubscription(store, 'orders', main)
  }

  if (tab === 'ads') {
    const ads = await fetchStoreAds(store.id)
    const canCreate = store.status === 'approved'

    main.innerHTML = merchantPage(
      menuItem.label,
      canCreate ? 'Divulgue sua loja no feed principal' : 'Disponível após aprovação da loja',
      `
        <div id="ad-msg"></div>
        ${!canCreate ? `
          <div class="alert alert-error" style="margin-bottom:1rem">
            Sua loja precisa estar aprovada e com assinatura ativa para criar anúncios.
          </div>` : `
          <details class="admin-form-panel" open>
            <summary>Novo anúncio</summary>
            <form id="ad-form" class="admin-form-grid" style="margin-top:1rem">
              <div class="form-group admin-form-grid__full">
                <label class="form-label">Título</label>
                <input class="form-input" name="title" placeholder="Ex: Promoção de fim de semana" minlength="3" maxlength="80" required />
              </div>
              <div class="form-group admin-form-grid__full">
                <label class="form-label">Mensagem</label>
                <textarea class="form-input" name="message" placeholder="Descreva a oferta ou novidade (10–280 caracteres)" minlength="10" maxlength="280" rows="3" required></textarea>
              </div>
              <div class="form-group admin-form-grid__full">
                <label class="form-label">Imagem (opcional)</label>
                <div class="admin-image-field">
                  <div data-preview-ad-create>${imagePreviewBlock(null, 'Anúncio', 'banner')}</div>
                  <input class="form-input" type="file" name="image" accept="image/*" />
                  <small class="form-hint">${PRODUCT_IMAGE_UPLOAD_HINT}</small>
                </div>
              </div>
              <div class="admin-form-grid__full">
                <button type="submit" class="btn btn-primary btn-sm">Criar anúncio</button>
              </div>
            </form>
            <p class="form-hint" style="margin-top:0.75rem">Anúncios passam por aprovação do admin e ficam ativos por 24h após aprovação.</p>
          </details>`}
        <section class="admin-section">
          <div class="admin-section__head">
            <h2>Seus anúncios</h2>
            <span class="admin-stat-chip admin-stat-chip--sent">${ads.length} cadastrado${ads.length === 1 ? '' : 's'}</span>
          </div>
          ${ads.length === 0
            ? merchantEmptyState('📣', 'Nenhum anúncio', canCreate ? 'Crie seu primeiro anúncio usando o formulário acima.' : 'Aguarde a aprovação da loja para começar.')
            : `<div style="display:flex;flex-direction:column;gap:0.75rem">${renderStoreAdRows(ads)}</div>`}
        </section>
      `,
    )

    if (canCreate) bindAdForm(main, store)
    return
  }

  if (tab === 'plans') {
    main.innerHTML = merchantPage(
      menuItem.label,
      'Assine ou renove o plano da sua loja ou serviço',
      await renderMerchantPlansPanel(store),
    )
    bindPlanRequestActions(main, store)
    return
  }

  if (tab === 'settings') {
    const categories = await fetchCategories()
    const plan = getPlanById(store.plan_id)

    main.innerHTML = merchantPage(
      menuItem.label,
      'Dados e aparência da sua loja',
      `
        <div id="settings-msg"></div>
        <div class="merchant-settings-layout">
          <aside class="merchant-settings-aside">
            ${renderSettingsPreviewCard(store, plan)}
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
            <section class="merchant-settings-section">
              <h2>Formas de pagamento</h2>
              <p class="form-hint">Escolha quais opções o cliente vê ao finalizar o pedido no carrinho.</p>
              <div class="merchant-payment-toggles" id="merchant-payment-toggles">
                ${PAYMENT_METHODS.map((method) => {
                  const enabled = normalizeStorePaymentMethods(store.payment_methods).includes(method.id)
                  return `
                    <label class="merchant-payment-toggle ${enabled ? 'active' : ''}">
                      <input type="checkbox" name="payment_methods" value="${escapeHtml(method.id)}" ${enabled ? 'checked' : ''} />
                      <span class="merchant-payment-toggle__icon" aria-hidden="true">${method.icon}</span>
                      <span class="merchant-payment-toggle__text">
                        <strong>${escapeHtml(method.label)}</strong>
                        <small>${escapeHtml(method.hint)}</small>
                      </span>
                    </label>
                  `
                }).join('')}
              </div>
            </section>
            ${merchantBrandingSection(store)}
            <button type="submit" class="btn btn-primary">Salvar alterações</button>
          </form>
        </div>
      `,
    )

    bindSettingsForm(main, store)
    return
  }

  if (tab === 'account') {
    main.innerHTML = merchantPage(
      menuItem.label,
      'Altere sua senha de acesso ao painel',
      `
        <div class="admin-account-card">
          <p class="admin-account-card__email"><span>Conta</span> ${escapeHtml(user.email)}</p>
          <form id="merchant-password-form" class="admin-password-form">
            <div class="form-group">
              <label class="form-label">Nova senha</label>
              <input class="form-input" type="password" name="password" required minlength="6" autocomplete="new-password" />
            </div>
            <div class="form-group">
              <label class="form-label">Confirmar nova senha</label>
              <input class="form-input" type="password" name="confirm" required minlength="6" autocomplete="new-password" />
            </div>
            <div id="merchant-password-msg"></div>
            <button type="submit" class="btn btn-primary btn-sm">Alterar senha</button>
          </form>
        </div>
      `,
    )

    bindPasswordForm(main)
    return
  }
}