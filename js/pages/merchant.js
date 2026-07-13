/**
 * Painel do lojista — produtos, pedidos, anúncios e configurações da loja.
 */
import {
  fetchStoreByOwner, fetchMerchantProducts, fetchOrdersByStore,
  createProduct, updateProduct, deleteProduct, updateStore, fetchCategories, fetchNeighborhoods,
  updatePassword, fetchMerchantOrdersAnalytics, fetchStoreViewStats,
  fetchReviewsByStore, fetchStoreAds, createStoreAd, updateOrderStatus,
  fetchProductPriceHistory, countUnreadMerchantOrders, subscribeToStoreOrders,
  fetchStoreEngagementStats,
  createPlanChangeRequest, fetchStorePendingPlanChangeRequest,
} from '../api.js'
import { getUser, loadUser, setMerchantNewOrdersCount } from '../state.js'
import {
  escapeHtml, formatCurrency, formatDate, formatDateTimeCsv,
  buildCsv, downloadTextFile, showToast,
} from '../utils.js'
import { STORE_THEME_COLORS } from '../config.js'
import {
  planAllowsStoreBanner, FREE_PLAN_BANNER_MESSAGE,
  countProductsWithImages, canAddProductImage, canCreateProduct,
  planProductImageLimitMessage, planProductLimitMessage,
  formatProductLimitHint, formatProductImageLimitHint,
  planAllowsStoreAds, canCreateIncludedStoreAd, canCreateExtraStoreAd,
  countIncludedStoreAdsThisMonth, isExtraStoreAdSlot,
  formatStoreAdLimitHint, formatStoreAdExtraFeeHint, getPlanMonthlyAdLimit,
  STORE_AD_EXTRA_FEE, STORE_AD_DURATION_HOURS, buildExtraAdPaymentUrl,
  getPlanById, formatPlanPrice,
  getPriceCooldownRemaining, formatPriceCooldownRemaining,
  getPlanPriceCooldownHours,
  renderSubscriptionPlanCards,
} from '../plans.js'
import {
  getPlanRenewalState,
  formatRenewalRemaining,
  storeNeedsRenewalAttention,
  storeWasDowngradedToFree,
} from '../plan-renewal.js'
import {
  STORE_LOGO_UPLOAD_HINT, STORE_BANNER_UPLOAD_HINT, PRODUCT_IMAGE_UPLOAD_HINT,
  validateImageFile, STORAGE_BUCKETS,
} from '../uploads.js'
import { MERCHANT_PANEL, getMerchantMenuItem, merchantHref } from '../merchant-nav.js'
import { bindNeighborhoodLocationFields, formatNeighborhoodLabel } from '../neighborhood.js'
import { renderOrdersChart, bindOrdersChart } from '../order-charts.js'
import { renderEngagementStats } from '../ui.js'
import { bindPaginatedSortableList } from '../list-utils.js'
import { routeHref, render } from '../router.js'
import {
  isService, getCatalogItemIcon, getCatalogItemLabel, isUsedProduct,
  catalogItemTypeFieldHtml, catalogStockFieldHtml, catalogUsedFieldHtml,
  bindCatalogItemTypeForm, readCatalogItemForm, readCatalogUsedFromForm,
} from '../catalog.js'
import {
  getPaymentMethodLabel, PAYMENT_METHODS, normalizeStorePaymentMethods,
} from '../payment.js'
import { t } from '../strings.js'
import { bindPasswordToggles } from '../password-field.js'

const LOW_STOCK_THRESHOLD = 3
const PRODUCTS_PAGE_SIZE = 15
const ORDERS_PAGE_SIZE = 15

const PRODUCT_SORT_DEFAULTS = { name: 'asc', price: 'asc', stock: 'desc' }

function orderStatusLabel(status) {
  const map = {
    pending: t('orderStatus.pending'),
    sent: t('orderStatus.sent'),
    viewed: t('orderStatus.viewed'),
  }
  return map[status] ?? status
}

function imagePreviewBlock(url, alt, variant = 'square') {
  if (!url) {
    return `<div class="admin-image-preview admin-image-preview--empty admin-image-preview--${variant}">${t('app.noImage')}</div>`
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
      previewEl.innerHTML = `<img class="admin-image-preview" src="${reader.result}" alt="${escapeHtml(t('common.preview'))}" />`
    }
    reader.readAsDataURL(file)
  })
}

/** Aguarda loadUser() antes de negar acesso — corrige race no boot pós-login. */
async function guardMerchant(main) {
  let user = getUser()
  if (!user) user = await loadUser()
  if (!user || user.role !== 'merchant') {
    main.innerHTML = `<div class="empty-state"><h2>${t('merchant.restrictedAccess')}</h2><p><a href="${routeHref('/lojista/entrar')}">${t('nav.login')}</a></p></div>`
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
    pending: `<span class="badge badge-pending">${t('merchant.statusPending')}</span>`,
    approved: `<span class="badge badge-approved">${t('merchant.statusApproved')}</span>`,
    blocked: `<span class="badge badge-blocked">${t('merchant.statusBlocked')}</span>`,
  }
  return map[status] ?? escapeHtml(status)
}

function orderStatusBadge(status) {
  const map = {
    pending: `<span class="badge badge-order-pending">${t('orderStatus.pending')}</span>`,
    sent: `<span class="badge badge-order-sent">${t('orderStatus.sent')}</span>`,
    viewed: `<span class="badge badge-order-viewed">${t('orderStatus.viewed')}</span>`,
  }
  return map[status] ?? escapeHtml(status)
}

function adStatusBadge(status) {
  const map = {
    pending: `<span class="badge badge-pending">${t('adStatus.pending')}</span>`,
    approved: `<span class="badge badge-approved">${t('adStatus.approved')}</span>`,
    rejected: `<span class="badge badge-blocked">${t('adStatus.rejected')}</span>`,
    expired: `<span class="badge badge-order-pending">${t('adStatus.expired')}</span>`,
  }
  return map[status] ?? escapeHtml(status)
}

function storeStatusBanner(store) {
  const messages = {
    pending: t('merchant.statusPendingBanner'),
    approved: t('merchant.statusApprovedBanner'),
    blocked: t('merchant.statusBlockedBanner'),
  }
  const tone = store.status === 'approved' ? 'approved' : store.status === 'blocked' ? 'blocked' : 'pending'
  return `
    <div class="merchant-status-banner merchant-status-banner--${tone}">
      <div class="merchant-status-banner__main">
        ${storeStatusBadge(store.status)}
        <p>${escapeHtml(messages[store.status] ?? '')}</p>
      </div>
      ${store.status === 'approved' ? `<a href="${routeHref(`/loja/${store.slug}`)}" class="btn btn-outline btn-sm">${t('merchant.viewPublicStore')}</a>` : ''}
    </div>`
}

function planRenewalBanner(store, { pendingRenewal = false } = {}) {
  if (pendingRenewal || !storeNeedsRenewalAttention(store)) return ''

  const renewal = getPlanRenewalState(store)
  const isExpired = renewal.status === 'expired'
  const remaining = formatRenewalRemaining(renewal.msRemaining)
  const expiresLabel = formatDate(renewal.expiresAt)

  return `
    <div class="merchant-status-banner merchant-status-banner--${isExpired ? 'blocked' : 'pending'}">
      <div class="merchant-status-banner__main">
        <strong>${escapeHtml(isExpired ? t('merchant.planRenewalExpiredTitle') : t('merchant.planRenewalWarningTitle'))}</strong>
        <p>${isExpired
          ? t('merchant.planRenewalExpiredBody', {
            planName: renewal.planName,
            date: expiresLabel,
          })
          : `${t('merchant.planRenewalWarningBody', {
            planName: renewal.planName,
            remaining,
            date: expiresLabel,
          })} ${t('merchant.planRenewalWarningHint')}`}</p>
      </div>
      <a href="${merchantHref('planos')}" class="btn btn-primary btn-sm">${t('merchant.planRenewalCta')}</a>
    </div>`
}

function planDowngradeBanner(store, products) {
  if (!storeWasDowngradedToFree(store, products)) return ''

  return `
    <div class="merchant-status-banner merchant-status-banner--pending">
      <div class="merchant-status-banner__main">
        <strong>${escapeHtml(t('merchant.planDowngradedTitle'))}</strong>
        <p>${t('merchant.planDowngradedBody')}</p>
      </div>
      <a href="${merchantHref('planos')}" class="btn btn-primary btn-sm">${t('merchant.planRenewalCta')}</a>
    </div>`
}

function merchantMetrics({ products, orders, store, viewStats, engagementStats }) {
  const activeProducts = products.filter((p) => p.active).length
  const revenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0)
  const plan = getPlanById(store.plan_id)
  const favoritesCount = engagementStats?.favoritesCount ?? 0
  const likesCount = engagementStats?.likesCount ?? 0

  return `
    <div class="metrics admin-metrics merchant-metrics">
      <a href="${merchantHref('produtos')}" class="metric-card metric-card--link">
        <div class="metric-card__value">${activeProducts}</div>
        <div class="metric-card__label">${t('merchant.activeProducts')}</div>
      </a>
      <a href="${merchantHref('pedidos')}" class="metric-card metric-card--link">
        <div class="metric-card__value">${orders.length}</div>
        <div class="metric-card__label">${t('merchant.orders')}</div>
      </a>
      <div class="metric-card">
        <div class="metric-card__value">${formatCurrency(revenue)}</div>
        <div class="metric-card__label">${t('merchant.orderVolume')}</div>
      </div>
      <div class="metric-card">
        <div class="metric-card__value">${viewStats?.total ?? 0}</div>
        <div class="metric-card__label">${t('merchant.views')}${viewStats?.week ? t('merchant.viewsThisWeek', { count: viewStats.week }) : ''}</div>
      </div>
      <div class="metric-card">
        <div class="metric-card__value">${favoritesCount}</div>
        <div class="metric-card__label">${t('merchant.storeFavorites')}</div>
      </div>
      <div class="metric-card">
        <div class="metric-card__value">${likesCount}</div>
        <div class="metric-card__label">${t('merchant.storeLikes')}</div>
      </div>
      <a href="${merchantHref('planos')}" class="metric-card metric-card--link">
        <div class="metric-card__value">${escapeHtml(plan.name)}</div>
        <div class="metric-card__label">${t('merchant.planPriceLabel', { price: formatPlanPrice(plan.priceMonthly) })}</div>
      </a>
    </div>`
}

function renderMerchantEngagementPreview(store, engagementStats) {
  return `
    <section class="admin-section merchant-engagement-preview">
      <div class="admin-section__head">
        <h2>${t('store.engagementTitle')}</h2>
        <a href="${routeHref(`/loja/${store.slug}`)}" class="btn btn-ghost btn-sm">${t('merchant.viewPublicStore')}</a>
      </div>
      <p class="form-hint">${t('store.engagementHint')}</p>
      ${renderEngagementStats({ ...engagementStats, mode: 'store' })}
    </section>`
}

function merchantQuickActions(store) {
  return `
    <div class="admin-quick-actions">
      <a href="${merchantHref('produtos')}" class="admin-quick-card">
        <span class="admin-quick-card__icon">📦</span>
        <strong>${t('merchant.productsTitle')}</strong>
        <span>${t('merchant.manageCatalog')}</span>
      </a>
      <a href="${merchantHref('pedidos')}" class="admin-quick-card">
        <span class="admin-quick-card__icon">🛒</span>
        <strong>${t('merchant.orders')}</strong>
        <span>${t('merchant.viewRequests')}</span>
      </a>
      <a href="${merchantHref('anuncios')}" class="admin-quick-card">
        <span class="admin-quick-card__icon">📣</span>
        <strong>${t('merchant.adsTitle')}</strong>
        <span>${t('merchant.promoteInFeed')}</span>
      </a>
      <a href="${merchantHref('planos')}" class="admin-quick-card">
        <span class="admin-quick-card__icon">💎</span>
        <strong>${t('merchant.plansTitle')}</strong>
        <span>${t('merchant.subscribeOrRenew')}</span>
      </a>
      <a href="${merchantHref('configuracoes')}" class="admin-quick-card">
        <span class="admin-quick-card__icon">⚙️</span>
        <strong>${t('merchant.settingsTitle')}</strong>
        <span>${t('merchant.storeData')}</span>
      </a>
      ${store.status === 'approved' ? `
        <a href="${routeHref(`/loja/${store.slug}`)}" class="admin-quick-card">
          <span class="admin-quick-card__icon">🏪</span>
          <strong>${t('merchant.storefront')}</strong>
          <span>${t('merchant.viewAsCustomer')}</span>
        </a>` : `
        <span class="admin-quick-card admin-quick-card--muted">
          <span class="admin-quick-card__icon">🏪</span>
          <strong>${t('merchant.storefront')}</strong>
          <span>${t('merchant.afterApproval')}</span>
        </span>`}
    </div>`
}

function merchantOnboardingChecklist(store, products) {
  const activeCount = products.filter((p) => p.active).length
  const items = [
    {
      done: Boolean(store.whatsapp?.trim()),
      label: t('merchant.whatsappFilled'),
      action: `<a href="${merchantHref('configuracoes')}" class="btn btn-outline btn-sm">${t('common.configure')}</a>`,
    },
    {
      done: activeCount >= 3,
      label: t('merchant.threeActiveItems'),
      action: `<a href="${merchantHref('produtos')}" class="btn btn-outline btn-sm">${t('common.register')}</a>`,
    },
    {
      done: store.status === 'approved',
      label: t('merchant.storeApprovedByAdmin'),
      action: store.status === 'pending'
        ? `<span class="badge badge-pending">${t('merchant.underReview')}</span>`
        : '',
    },
  ]

  const doneCount = items.filter((i) => i.done).length
  if (doneCount === items.length) return ''

  return `
    <section class="admin-section">
      <div class="admin-section__head">
        <h2>${t('merchant.firstSteps')}</h2>
        <span class="admin-stat-chip admin-stat-chip--sent">${t('merchant.stepsCompleted', { done: doneCount, total: items.length })}</span>
      </div>
      <div class="merchant-alert-list">
        ${items.map((item) => `
          <div class="merchant-alert-item">
            <strong>${item.done ? '✅' : '⭕'} ${escapeHtml(item.label)}</strong>
            ${!item.done ? item.action : `<span class="badge badge-approved">${t('common.completed')}</span>`}
          </div>
        `).join('')}
      </div>
    </section>`
}

function renderRecentOrders(orders) {
  if (orders.length === 0) {
    return merchantEmptyState('🛒', t('customer.noOrdersTitle'), t('merchant.noOrdersYetBody'))
  }

  return `
    <div class="table-wrap admin-orders-table admin-table--stack">
      <table>
        <thead><tr><th>${t('common.date')}</th><th>${t('common.customer')}</th><th>${t('common.payment')}</th><th>${t('common.total')}</th><th>${t('labels.status')}</th></tr></thead>
        <tbody>
          ${orders.slice(0, 5).map((o) => `
            <tr>
              <td data-label="${escapeHtml(t('common.date'))}">${formatDate(o.created_at)}</td>
              <td class="admin-table__primary" data-label="">${escapeHtml(o.customer_name)}</td>
              <td data-label="${escapeHtml(t('common.payment'))}">${escapeHtml(o.payment_method ? getPaymentMethodLabel(o.payment_method) : t('app.dashPlaceholder'))}</td>
              <td data-label="${escapeHtml(t('common.total'))}">${formatCurrency(o.total)}</td>
              <td data-label="${escapeHtml(t('labels.status'))}">${orderStatusBadge(o.status)}</td>
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
        <h2>${t('merchant.lowStock')}</h2>
        <a href="${merchantHref('produtos')}" class="btn btn-outline btn-sm">${t('common.viewProducts')}</a>
      </div>
      <div class="merchant-alert-list">
        ${lowStock.slice(0, 5).map((p) => `
          <div class="merchant-alert-item">
            <strong>${escapeHtml(p.name)}</strong>
            <span class="badge badge-pending">${t('merchant.unitsShort', { count: p.stock })}</span>
          </div>
        `).join('')}
      </div>
    </section>`
}

function renderReviewsSection(reviews) {
  if (reviews.length === 0) {
    return `
      <section class="admin-section">
        <div class="admin-section__head"><h2>${t('merchant.reviews')}</h2></div>
        ${merchantEmptyState('⭐', t('merchant.noReviewsTitle'), t('merchant.noReviewsBody'))}
      </section>`
  }

  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length

  return `
    <section class="admin-section">
      <div class="admin-section__head">
        <h2>${t('merchant.reviews')}</h2>
        <span class="stars">★ ${avgRating.toFixed(1)} · ${reviews.length} ${reviews.length === 1 ? t('merchant.ratingSingular') : t('merchant.ratingPlural')}</span>
      </div>
      <div class="merchant-alert-list">
        ${reviews.slice(0, 3).map((r) => `
          <div class="merchant-alert-item" style="align-items:flex-start;flex-direction:column;gap:0.375rem">
            <div style="display:flex;justify-content:space-between;width:100%;gap:0.75rem">
              <strong>${escapeHtml(r.user?.name ?? t('common.anonymous'))}</strong>
              <span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
            </div>
            ${r.comment ? `<p style="font-size:0.8125rem;color:var(--text-secondary);margin:0">${escapeHtml(r.comment)}</p>` : ''}
            <small style="font-size:0.75rem;color:var(--text-muted)">${formatDate(r.created_at)}</small>
          </div>
        `).join('')}
      </div>
    </section>`
}

/** Resumo de anúncios no overview; exibe limite Premium ou aviso de upgrade. */
function renderAdsSummary(ads, store) {
  const active = ads.filter((a) => a.status === 'approved').length
  const pending = ads.filter((a) => a.status === 'pending').length
  const planId = store?.plan_id ?? 'free'
  const premiumHint = planAllowsStoreAds(planId)
    ? `<p class="form-hint">${escapeHtml(formatStoreAdLimitHint(planId, countIncludedStoreAdsThisMonth(ads)))}</p>`
    : `<p class="form-hint form-hint--info">${escapeHtml(t('merchant.adsPremiumRequired'))}</p>`

  return `
    <section class="admin-section">
      <div class="admin-section__head">
        <h2>${t('merchant.adsTitle')}</h2>
        <a href="${merchantHref('anuncios')}" class="btn btn-outline btn-sm">${t('common.manage')}</a>
      </div>
      ${premiumHint}
      ${ads.length === 0
        ? merchantEmptyState('📣', t('merchant.noAdsTitle'), planAllowsStoreAds(planId) ? t('merchant.noAdsBody') : t('merchant.adsPremiumRequired'))
        : `
          <div class="admin-stat-chips">
            <span class="admin-stat-chip admin-stat-chip--approved">${active === 1 ? t('merchant.adActiveOne', { count: active }) : t('merchant.adActiveMany', { count: active })}</span>
            <span class="admin-stat-chip admin-stat-chip--pending">${pending === 1 ? t('merchant.adPendingOne', { count: pending }) : t('merchant.adPendingMany', { count: pending })}</span>
            <span class="admin-stat-chip admin-stat-chip--sent">${t('merchant.adsTotal', { count: ads.length })}</span>
          </div>`}
    </section>`
}

/**
 * Formulário de novo anúncio (aba Anúncios do lojista).
 * Bloqueios: loja não aprovada, plano não Premium, limite incluso esgotado sem slot extra.
 * Após 2 inclusos/mês: checkbox de taxa R$ 5 + link WhatsApp; createStoreAd exige feeAcknowledged.
 * Toast pós-envio mostra o UUID (merchant.adCreatedWithId).
 */
function merchantAdsCreatePanel(store, ads) {
  const planId = store.plan_id ?? 'free'
  const approved = store.status === 'approved' && ['active', 'trialing'].includes(store.subscription_status)
  const includedThisMonth = countIncludedStoreAdsThisMonth(ads)
  const extraSlot = isExtraStoreAdSlot(planId, includedThisMonth)
  const canCreate = canCreateIncludedStoreAd(planId, includedThisMonth) || (extraSlot && canCreateExtraStoreAd(planId))

  if (!approved) {
    return `<div class="alert alert-error" style="margin-bottom:1rem">${t('merchant.adsApprovalRequired')}</div>`
  }
  if (!planAllowsStoreAds(planId)) {
    return `
      <div class="alert alert-info" style="margin-bottom:1rem">${t('merchant.adsPremiumRequired')}</div>
      <p style="margin-bottom:1rem"><a href="${merchantHref('planos')}" class="btn btn-outline btn-sm">${t('merchant.viewPlansUpgrade')}</a></p>`
  }
  if (!canCreate) {
    return `<div class="alert alert-info" style="margin-bottom:1rem">${escapeHtml(t('errors.storeAdsMonthlyLimit', { limit: getPlanMonthlyAdLimit(planId) }))}</div>`
  }

  const extraFeeBlock = extraSlot ? `
    <div class="alert alert-info admin-form-grid__full" style="margin:0">
      <p>${escapeHtml(t('merchant.extraAdFeeNote', {
        limit: getPlanMonthlyAdLimit(planId),
        fee: formatCurrency(STORE_AD_EXTRA_FEE),
        hours: STORE_AD_DURATION_HOURS,
      }))}</p>
      <p class="form-hint" style="margin-top:0.5rem">${escapeHtml(formatStoreAdExtraFeeHint())}</p>
    </div>
    <label class="admin-check admin-form-grid__full">
      <input type="checkbox" name="fee_acknowledged" required />
      <span>${escapeHtml(t('merchant.extraAdFeeAck', { fee: formatCurrency(STORE_AD_EXTRA_FEE) }))}</span>
    </label>
    <p class="form-hint admin-form-grid__full">${escapeHtml(t('merchant.extraAdPayAfterCreate'))}</p>` : ''

  return `
    <details class="admin-form-panel" open>
      <summary>${t('merchant.newAd')}</summary>
      <form id="ad-form" class="admin-form-grid" style="margin-top:1rem">
        <div class="form-group admin-form-grid__full">
          <label class="form-label">${t('common.title')}</label>
          <input class="form-input" name="title" placeholder="${t('merchant.adTitlePlaceholder')}" minlength="3" maxlength="80" required />
        </div>
        <div class="form-group admin-form-grid__full">
          <label class="form-label">${t('common.message')}</label>
          <textarea class="form-input" name="message" placeholder="${t('merchant.adMessagePlaceholder')}" minlength="10" maxlength="280" rows="3" required></textarea>
        </div>
        <div class="form-group admin-form-grid__full">
          <label class="form-label">${t('merchant.adImageOptional')}</label>
          <div class="admin-image-field">
            <div data-preview-ad-create>${imagePreviewBlock(null, t('merchant.adPreview'), 'banner')}</div>
            <input class="form-input" type="file" name="image" accept="image/*" />
            <small class="form-hint">${PRODUCT_IMAGE_UPLOAD_HINT}</small>
          </div>
        </div>
        ${extraFeeBlock}
        <div class="admin-form-grid__full">
          <button type="submit" class="btn btn-primary btn-sm">${t('merchant.createAd')}</button>
        </div>
      </form>
      <p class="form-hint" style="margin-top:0.75rem">${t('merchant.adsApprovalNote')}</p>
      <p class="form-hint">${escapeHtml(formatStoreAdLimitHint(planId, includedThisMonth))}</p>
      ${extraSlot ? `<p class="form-hint">${escapeHtml(formatStoreAdExtraFeeHint())}</p>` : ''}
    </details>`
}

function priceCooldownHintHtml(planId, product) {
  const changedAt = product.price_changed_at ?? product.created_at
  const cooldown = getPriceCooldownRemaining(planId, changedAt)
  const hours = getPlanPriceCooldownHours(planId)

  if (cooldown.allowed) {
    if (hours === null) return ''
    return `<small class="form-hint">${t('merchant.priceChangeInterval', { hours })}</small>`
  }

  return `<small class="form-hint form-hint--info">${t('merchant.priceCooldownWait', { remaining: formatPriceCooldownRemaining(cooldown.remainingMs) })}</small>`
}

function renderPriceHistoryHtml(history) {
  if (!history.length) {
    return `<p class="form-hint">${t('merchant.noPriceChanges')}</p>`
  }

  return `
    <div class="table-wrap" style="margin-top:0.25rem">
      <table>
        <thead><tr><th>${t('common.date')}</th><th>${t('common.from')}</th><th>${t('common.to')}</th></tr></thead>
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
    return `<p class="form-hint form-hint--info">${escapeHtml(planProductImageLimitMessage(store.plan_id))} <a href="${routeHref('/conta/entrar?sec=planos')}">${t('merchant.viewPlansLink')}</a></p>`
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
        <td class="admin-table__primary" data-label="">
          <div class="admin-table-thumb">
            ${p.image ? `<img src="${escapeHtml(p.image)}" alt="" />` : `<span>${getCatalogItemIcon(p)}</span>`}
          </div>
          <strong>${escapeHtml(p.name)}</strong>
          <br><small class="form-hint">${escapeHtml(getCatalogItemLabel(p))}${isUsedProduct(p) ? ` · ${t('catalog.used')}` : ''}</small>
        </td>
        <td data-label="${escapeHtml(t('common.price'))}">${formatCurrency(p.price)}</td>
        <td data-label="${escapeHtml(t('common.stock'))}">${isService(p) ? t('app.dashPlaceholder') : ((p.stock ?? 0) <= LOW_STOCK_THRESHOLD ? `<span class="badge badge-pending">${p.stock}</span>` : p.stock)}</td>
        <td data-label="${escapeHtml(t('labels.status'))}">${p.active ? `<span class="badge badge-approved">${t('common.active')}</span>` : `<span class="badge badge-blocked">${t('common.inactive')}</span>`}</td>
        <td class="admin-table__actions" data-label="">
          <button type="button" class="btn btn-outline btn-sm" data-edit-product="${p.id}">${t('labels.edit')}</button>
          <button type="button" class="btn btn-outline btn-sm" data-del-product="${p.id}">${t('labels.delete')}</button>
        </td>
      </tr>
      <tr class="admin-edit-row" id="edit-product-row-${p.id}" hidden>
        <td colspan="5">
          <form class="admin-edit-panel admin-form-grid" data-product-edit="${p.id}">
            <div class="form-group">
              <label class="form-label">${t('labels.name')}</label>
              <input class="form-input" name="name" value="${escapeHtml(p.name)}" required />
            </div>
            ${catalogItemTypeFieldHtml(p.item_type)}
            <div class="form-group">
              <label class="form-label">${t('common.priceWithCurrency')}</label>
              <input class="form-input" name="price" type="number" step="0.01" min="0" value="${p.price}" required />
              ${priceCooldownHintHtml(store.plan_id, p)}
            </div>
            ${catalogStockFieldHtml(p.stock ?? 0, p.item_type)}
            ${catalogUsedFieldHtml(p.is_used)}
            <div class="form-group">
              <label class="form-label">${t('labels.category')}</label>
              <select class="form-input" name="category_id">
                <option value="">${t('common.noCategory')}</option>
                ${categories.map((c) => `<option value="${c.id}" ${p.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">${t('labels.active')}</label>
              <select class="form-input" name="active">
                <option value="true" ${p.active ? 'selected' : ''}>${t('common.yes')}</option>
                <option value="false" ${!p.active ? 'selected' : ''}>${t('common.no')}</option>
              </select>
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">${t('labels.description')}</label>
              <textarea class="form-input" name="description" rows="2">${escapeHtml(p.description ?? '')}</textarea>
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">${t('common.image')}</label>
              <div class="admin-image-field">
                <div data-preview-product="${p.id}">${imagePreviewBlock(p.image, p.name, 'square')}</div>
                ${productImageLimitHintHtml(store, products, p)}
                <input class="form-input" type="file" name="image" accept="image/*" ${canAddImage ? '' : 'disabled'} />
                ${canAddImage ? `<small class="form-hint">${PRODUCT_IMAGE_UPLOAD_HINT}</small>` : ''}
              </div>
            </div>
            <div class="form-group admin-form-grid__full" data-price-history-panel="${p.id}">
              <label class="form-label">${t('labels.priceHistory')}</label>
              <p class="form-hint">${t('merchant.loadingPriceHistory')}</p>
            </div>
            <div class="admin-edit-panel__actions admin-form-grid__full">
              <button type="submit" class="btn btn-primary btn-sm">${t('labels.save')}</button>
              <button type="button" class="btn btn-outline btn-sm" data-cancel-product="${p.id}">${t('labels.cancel')}</button>
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
      <td data-label="${escapeHtml(t('common.date'))}">${formatDate(o.created_at)}</td>
      <td class="admin-table__primary" data-label=""><strong>${escapeHtml(o.customer_name)}</strong></td>
      <td data-label="${escapeHtml(t('labels.phone'))}">${escapeHtml(o.customer_phone)}</td>
      <td data-label="${escapeHtml(t('common.payment'))}">${escapeHtml(o.payment_method ? getPaymentMethodLabel(o.payment_method) : t('app.dashPlaceholder'))}</td>
      <td data-label="${escapeHtml(t('common.total'))}">${formatCurrency(o.total)}</td>
      <td data-label="${escapeHtml(t('labels.status'))}">${orderStatusBadge(o.status)}</td>
      <td class="admin-table__actions" data-label="">
        ${o.status === 'sent'
          ? `<button type="button" class="btn btn-outline btn-sm" data-mark-viewed="${escapeHtml(o.id)}">${t('merchant.markAsViewed')}</button>`
          : t('app.dashPlaceholder')}
      </td>
    </tr>
  `).join('')
}

function renderMerchantPendingAdIdBlock(ad) {
  if (ad.status !== 'pending') return ''
  return `
    <div class="merchant-ad-id" style="margin:0.5rem 0 0.75rem;padding:0.625rem 0.75rem;border:1px solid rgb(245 158 11 / 0.45);border-radius:0.5rem;background:rgb(255 251 235 / 0.6)">
      <div style="font-size:0.75rem;font-weight:600;color:var(--amber-600,#d97706);margin-bottom:0.25rem">${escapeHtml(t('merchant.adIdPendingTitle'))}</div>
      <code style="display:block;font-size:0.8125rem;line-height:1.4;word-break:break-all;user-select:all">${escapeHtml(ad.id)}</code>
      ${ad.is_extra ? `<p class="form-hint" style="margin:0.375rem 0 0">${escapeHtml(t('merchant.adIdPendingHint'))}</p>` : ''}
    </div>`
}

function renderStoreAdRows(ads) {
  return ads.map((ad) => {
    const needsPayment = ad.is_extra && ad.status === 'pending'
    return `
    <div class="admin-list-card">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.375rem">
          <strong>${escapeHtml(ad.title)}</strong>
          ${adStatusBadge(ad.status)}
          ${ad.is_extra ? `<span class="admin-stat-chip admin-stat-chip--pending">${escapeHtml(t('merchant.adExtraBadge', { fee: formatCurrency(ad.fee_amount || STORE_AD_EXTRA_FEE) }))}</span>` : ''}
        </div>
        ${renderMerchantPendingAdIdBlock(ad)}
        <p>${escapeHtml(ad.message)}</p>
        <p class="admin-list-card__meta">
          ${t('merchant.adCreatedAt', { date: formatDate(ad.created_at) })}
          ${ad.expires_at ? ` · ${t('merchant.adExpiresAt', { date: formatDate(ad.expires_at) })}` : ''}
        </p>
        ${needsPayment ? `
          <div style="margin-top:0.5rem">
            <a href="${buildExtraAdPaymentUrl({ title: ad.title, id: ad.id })}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">
              ${escapeHtml(t('merchant.extraAdSendReceipt', { fee: formatCurrency(ad.fee_amount || STORE_AD_EXTRA_FEE) }))}
            </a>
          </div>` : ''}
      </div>
      ${ad.image_url ? `<div class="admin-table-thumb" style="width:3rem;height:3rem;flex-shrink:0"><img src="${escapeHtml(ad.image_url)}" alt="" /></div>` : ''}
    </div>`
  }).join('')
}

const EXTRA_AD_PAYMENT_SESSION_KEY = 'merchant-extra-ad-id'

function renderExtraAdPaymentBanner(main, ads) {
  let adId = null
  try {
    adId = sessionStorage.getItem(EXTRA_AD_PAYMENT_SESSION_KEY)
    sessionStorage.removeItem(EXTRA_AD_PAYMENT_SESSION_KEY)
  } catch {
    return
  }
  if (!adId) return

  const ad = ads.find((item) => item.id === adId && item.is_extra)
  const msgEl = main.querySelector('#ad-msg')
  if (!ad || !msgEl) return

  msgEl.innerHTML = `
    <div class="alert alert-success" style="margin-bottom:1rem">
      <p>${escapeHtml(t('merchant.extraAdPaymentBanner', { fee: formatCurrency(ad.fee_amount || STORE_AD_EXTRA_FEE) }))} <code>${escapeHtml(ad.id)}</code></p>
      <a href="${buildExtraAdPaymentUrl({ title: ad.title, id: ad.id })}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" style="margin-top:0.5rem">
        ${escapeHtml(t('merchant.extraAdSendReceipt', { fee: formatCurrency(ad.fee_amount || STORE_AD_EXTRA_FEE) }))}
      </a>
    </div>`
}

/** Configurações → imagem da loja: logo em qualquer plano; banner só se planAllowsStoreBanner. */
function merchantBrandingSection(store) {
  const canBanner = planAllowsStoreBanner(store.plan_id)

  return `
    <section class="merchant-branding">
      <h2 class="merchant-branding__title">${t('merchant.storeImage')}</h2>
      <div class="form-group">
        <label class="form-label">${t('merchant.storeLogo')}</label>
        <p style="font-size:0.8125rem;color:var(--text-secondary);margin-bottom:0.5rem">${STORE_LOGO_UPLOAD_HINT}</p>
        <div class="admin-image-field">
          <div data-preview-logo>${imagePreviewBlock(store.logo, store.name, 'square')}</div>
          <input class="form-input" type="file" name="logo" accept="image/*" />
        </div>
        ${store.logo ? `<label class="admin-check"><input type="checkbox" name="remove_logo" /> ${t('merchant.removeLogo')}</label>` : ''}
      </div>
      ${canBanner ? `
        <div class="form-group">
          <label class="form-label">${t('merchant.storeBanner')}</label>
          <p style="font-size:0.8125rem;color:var(--text-secondary);margin-bottom:0.5rem">${STORE_BANNER_UPLOAD_HINT}</p>
          <div class="admin-image-field">
            <div data-preview-banner>${imagePreviewBlock(store.banner, store.name, 'banner')}</div>
            <input class="form-input" type="file" name="banner" accept="image/*" />
          </div>
          ${store.banner ? `<label class="admin-check"><input type="checkbox" name="remove_banner" /> ${t('merchant.removeBanner')}</label>` : ''}
        </div>
      ` : `
        <div class="merchant-branding merchant-branding--locked" style="margin-top:0.5rem">
          <h3 class="merchant-branding__title" style="font-size:1rem">${t('merchant.storeBanner')}</h3>
          <p class="form-hint form-hint--info">${escapeHtml(FREE_PLAN_BANNER_MESSAGE)}</p>
          <p style="margin-top:0.75rem;font-size:0.875rem">
            <a href="${merchantHref('planos')}">${t('merchant.viewPlansUpgrade')}</a>
          </p>
          ${store.banner ? `
            <div class="merchant-branding__readonly" style="margin-top:1rem">
              <p style="font-size:0.8125rem;color:var(--text-secondary);margin-bottom:0.5rem">${t('merchant.bannerReadonlyHint')}</p>
              <div>${imagePreviewBlock(store.banner, store.name, 'banner')}</div>
            </div>
          ` : ''}
        </div>
      `}
    </section>`
}

async function renderMerchantPlansPanel(store) {
  const plan = getPlanById(store.plan_id)
  const pendingRequest = await fetchStorePendingPlanChangeRequest(store.id)
  const renewal = getPlanRenewalState(store)
  const pendingBanner = pendingRequest
    ? `<div class="alert alert-info" style="margin-bottom:1rem">
        ${t('merchant.planChangePending', {
          planName: escapeHtml(getPlanById(pendingRequest.requested_plan_id).name),
          date: formatDate(pendingRequest.created_at),
          storeName: escapeHtml(store.name),
          storeId: escapeHtml(store.id),
        })}
      </div>`
    : ''

  const expiryHint = renewal.expiresAt && renewal.status !== 'not_applicable'
    ? `<p class="form-hint">${t('merchant.planExpiresOn', { date: formatDate(renewal.expiresAt) })}</p>`
    : ''

  return `
    ${planRenewalBanner(store, { pendingRenewal: Boolean(pendingRequest) })}
    ${pendingBanner}
    <div class="merchant-plans-current">
      <div>
        <p class="merchant-plans-current__eyebrow">${t('merchant.activePlan')}</p>
        <h2>${escapeHtml(plan.name)} · ${escapeHtml(formatPlanPrice(plan.priceMonthly))}</h2>
        <p class="form-hint">${t('merchant.storeLabel', { name: escapeHtml(store.name) })}</p>
        <p class="form-hint">${t('merchant.planStoreId', { storeId: escapeHtml(store.id) })}</p>
        ${expiryHint}
      </div>
      ${store.status === 'approved' ? `<span class="badge badge-approved">${t('merchant.storeApprovedBadge')}</span>` : storeStatusBadge(store.status)}
    </div>
    <div class="plan-grid">${renderSubscriptionPlanCards({ currentPlanId: store.plan_id, requestMode: true, store })}</div>
    <div class="plan-payment-info">
      <p><strong>${t('merchant.howToSubscribe')}</strong></p>
      <ol>
        <li>${t('merchant.subscribeStep1')}</li>
        <li>${t('merchant.subscribeStep2')}</li>
        <li>${t('merchant.subscribeStep3')}</li>
        <li>${t('merchant.subscribeStep4')}</li>
      </ol>
      <p class="form-hint">${t('merchant.planLimitsQuestion')} <a href="${routeHref('/conta/entrar?sec=regras')}">${t('merchant.readRules')}</a> ${t('common.or')} <a href="${merchantHref('planos')}">${t('merchant.manageYourPlan')}</a>.</p>
    </div>`
}

function bindPlanRequestActions(main, store) {
  main.querySelectorAll('[data-request-plan]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const planId = btn.dataset.requestPlan
      const plan = getPlanById(planId)
      const actionLabel = planId === store.plan_id
        ? t('merchant.planRenewal')
        : t('merchant.planUpgradeTo', { planName: plan.name })
      if (!confirm(t('merchant.confirmPlanRequest', { action: actionLabel }))) return

      const originalText = btn.textContent
      btn.disabled = true
      btn.textContent = t('common.sending')
      try {
        await createPlanChangeRequest(store.id, planId)
        showToast(t('merchant.planRequestSent', { storeName: store.name, storeId: store.id }))
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
      <p class="merchant-store-card__plan">${t('merchant.planSummary', { planName: escapeHtml(plan.name), price: formatPlanPrice(plan.priceMonthly) })}</p>
      ${store.status === 'approved' ? `<a href="${routeHref(`/loja/${store.slug}`)}" class="btn btn-outline btn-sm" style="margin-top:0.75rem">${t('merchant.viewStorefront')}</a>` : ''}
      <a
        href="${merchantHref('planos')}"
        class="btn btn-green btn-sm"
        style="margin-top:0.75rem;display:block;text-align:center"
      >${plan.id === 'premium' ? t('common.viewPlans') : t('merchant.subscribeOrUpgrade')}</a>
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
    sortDirection === 'asc' ? t('common.sortByDateOldest') : t('common.sortByDateRecent'),
  )
}

function ordersToCsv(orders) {
  const headers = [
    t('common.date'),
    t('common.customer'),
    t('labels.phone'),
    t('labels.address'),
    t('common.payment'),
    t('common.totalWithCurrency'),
    t('labels.status'),
    t('common.id'),
  ]
  const rows = orders.map((o) => [
    formatDateTimeCsv(o.created_at),
    o.customer_name,
    o.customer_phone,
    o.customer_address ?? '',
    o.payment_method ? getPaymentMethodLabel(o.payment_method) : '',
    Number(o.total).toFixed(2),
    orderStatusLabel(o.status),
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
      showToast(t('merchant.noOrdersExport'))
      return
    }

    const date = new Date().toISOString().slice(0, 10)
    downloadTextFile(`pedidos-loja-${date}.csv`, ordersToCsv(toExport))
    showToast(t('merchant.ordersExported', { count: toExport.length }))
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
          <label class="form-label">${t('labels.priceHistory')}</label>
          <p class="form-hint">${t('merchant.loadingPriceHistory')}</p>`
        try {
          const history = await fetchProductPriceHistory(id)
          historyPanel.innerHTML = `
            <label class="form-label">${t('labels.priceHistory')}</label>
            ${renderPriceHistoryHtml(history)}`
        } catch (err) {
          historyPanel.innerHTML = `
            <label class="form-label">${t('labels.priceHistory')}</label>
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
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t('common.saving') }
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
          is_used: readCatalogUsedFromForm(form),
          category_id: form.category_id.value,
          active: form.active.value === 'true',
          image: imageFile,
        })
        showToast(t('merchant.productUpdated'))
        renderMerchantDashboard(main, 'products')
      } catch (err) {
        showToast(err.message)
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = t('labels.save') }
      }
    })
  })

  main.querySelectorAll('[data-del-product]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm(t('merchant.confirmDeleteProduct'))) return
      await deleteProduct(btn.dataset.delProduct)
      showToast(t('merchant.productDeleted'))
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
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t('common.saving') }
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
        is_used: readCatalogUsedFromForm(f),
        category_id: f.category_id.value,
        active: true,
        image: imageFile,
      })
      showToast(t('merchant.itemRegistered'))
      renderMerchantDashboard(main, 'products')
    } catch (err) {
      main.querySelector('#product-msg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = t('merchant.saveProduct') }
    }
  })
}

function bindSettingsForm(main, store) {
  const form = main.querySelector('#settings-form')
  const previewName = main.querySelector('[data-preview-name]')
  const previewSwatch = main.querySelector('[data-preview-swatch]')

  bindNeighborhoodLocationFields(form)

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

  bindImagePreview(form.querySelector('input[name="logo"]'), form.querySelector('[data-preview-logo]'))
  if (planAllowsStoreBanner(store.plan_id)) {
    bindImagePreview(form.querySelector('input[name="banner"]'), form.querySelector('[data-preview-banner]'))
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const f = e.target
    const submitBtn = f.querySelector('button[type="submit"]')
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t('common.saving') }
    try {
      const paymentMethods = [...f.querySelectorAll('input[name="payment_methods"]:checked')].map((el) => el.value)
      if (paymentMethods.length === 0) {
        throw new Error(t('merchant.selectPaymentMethod'))
      }

      const { validateInstagramHandle } = await import('../utils.js')
      const instagramCheck = validateInstagramHandle(f.instagram?.value ?? '')
      if (!instagramCheck.ok) throw new Error(instagramCheck.message)

      const payload = {
        name: f.name.value.trim(),
        whatsapp: f.whatsapp.value.trim(),
        description: f.description.value.trim(),
        neighborhood_id: f.neighborhood_id?.value,
        category_id: f.category_id.value,
        theme_color: f.theme_color.value,
        opening_hours: f.opening_hours.value.trim(),
        instagram: instagramCheck.handle || null,
        payment_methods: paymentMethods,
      }

      const logoFile = f.logo?.files?.[0]
      const bannerFile = f.banner?.files?.[0]
      if (logoFile) payload.logo = logoFile
      if (!logoFile && f.remove_logo?.checked) payload.remove_logo = true
      if (planAllowsStoreBanner(store.plan_id)) {
        if (bannerFile) payload.banner = bannerFile
        if (!bannerFile && f.remove_banner?.checked) payload.remove_banner = true
      }

      await updateStore(store.id, payload)
      showToast(t('merchant.settingsSaved'))
      if (payload.logo || payload.banner || payload.remove_logo || payload.remove_banner) {
        renderMerchantDashboard(main, 'settings')
      } else {
        updatePreview()
      }
    } catch (err) {
      main.querySelector('#settings-msg').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = t('merchant.saveChanges') }
    }
  })
}

/** Submit do anúncio: extras gravam id em sessionStorage para banner WhatsApp com ID na mensagem. */
function bindAdForm(main, store) {
  const form = main.querySelector('#ad-form')
  bindImagePreview(form?.querySelector('input[name="image"]'), main.querySelector('[data-preview-ad-create]'))

  form?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const f = e.target
    const msgEl = main.querySelector('#ad-msg')
    const submitBtn = f.querySelector('button[type="submit"]')
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t('common.sending') }
    try {
      const imageFile = f.image?.files?.[0]
      if (imageFile) {
        const err = validateImageFile(imageFile, STORAGE_BUCKETS.products)
        if (err) throw new Error(err)
      }
      const ad = await createStoreAd(store.id, {
        title: f.title.value,
        message: f.message.value,
        image: imageFile,
        feeAcknowledged: Boolean(f.fee_acknowledged?.checked),
      })
      if (ad.is_extra) {
        try { sessionStorage.setItem(EXTRA_AD_PAYMENT_SESSION_KEY, ad.id) } catch { /* ignore */ }
      }
      showToast(t('merchant.adCreatedWithId', { id: ad.id }))
      renderMerchantDashboard(main, 'ads')
    } catch (err) {
      msgEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = t('merchant.createAd') }
    }
  })
}

function bindPasswordForm(main) {
  bindPasswordToggles(main)
  main.querySelector('#merchant-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const msgEl = main.querySelector('#merchant-password-msg')
    const password = form.password.value
    const confirm = form.confirm.value

    if (password !== confirm) {
      msgEl.innerHTML = `<div class="alert alert-error">${t('merchant.passwordsMismatch')}</div>`
      return
    }

    const submitBtn = form.querySelector('button[type="submit"]')
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t('common.saving') }

    try {
      await updatePassword(password)
      form.reset()
      msgEl.innerHTML = `<div class="alert alert-success">${t('merchant.passwordChangedSuccess')}</div>`
      showToast(t('customer.passwordUpdated'))
    } catch (err) {
      msgEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = t('merchant.changePassword') }
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
        showToast(t('merchant.orderMarkedViewed'))
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

/** Badge de pedidos novos + toast; re-renderiza painel ao receber INSERT realtime. */
function buildOrdersSubscription(store) {
  return subscribeToStoreOrders(store.id, async () => {
    const count = await countUnreadMerchantOrders(store.id)
    setMerchantNewOrdersCount(count)
    refreshHeader()
    showToast(t('merchant.newOrderReceived'))
    await render()
  })
}

export async function renderMerchantDashboard(main, tab = 'overview') {
  const user = await guardMerchant(main)
  if (!user) return

  const store = await fetchStoreByOwner(user.id)
  if (!store) {
    main.innerHTML = merchantPage(
      t('merchant.yourStore'),
      t('merchant.registerStoreSubtitle'),
      merchantEmptyState('🏪', t('merchant.noStoreRegistered'), t('merchant.completeRegistrationHint'), `<a href="${routeHref('/lojista/cadastro')}" class="btn btn-primary btn-sm">${t('auth.registerMyStore')}</a>`),
    )
    return
  }

  const unreadCount = await countUnreadMerchantOrders(store.id)
  setMerchantNewOrdersCount(unreadCount)
  refreshHeader()

  const menuItem = getMerchantMenuItem(tab)

  if (tab === 'overview') {
    const [
      products, orders, orderAnalytics, viewStats, reviews, ads, engagementStats, pendingPlanRequest,
    ] = await Promise.all([
      fetchMerchantProducts(store.id),
      fetchOrdersByStore(store.id),
      fetchMerchantOrdersAnalytics(store.id),
      fetchStoreViewStats(store.id),
      fetchReviewsByStore(store.id),
      fetchStoreAds(store.id),
      fetchStoreEngagementStats(store.id),
      fetchStorePendingPlanChangeRequest(store.id),
    ])

    const chartSeries = orderAnalytics.timeline
    main.innerHTML = merchantPage(
      menuItem.label,
      store.name,
      `
        ${storeStatusBanner(store)}
        ${planRenewalBanner(store, { pendingRenewal: Boolean(pendingPlanRequest) })}
        ${planDowngradeBanner(store, products)}
        ${merchantMetrics({ products, orders, store, viewStats, engagementStats })}
        ${renderMerchantEngagementPreview(store, engagementStats)}
        ${merchantQuickActions(store)}
        ${merchantOnboardingChecklist(store, products)}
        ${renderOrdersChart(chartSeries, { period: '7d', metric: 'orders', compact: true, chartId: 'merchant-overview-chart' })}
        ${renderLowStockAlert(products)}
        <section class="admin-section">
          <div class="admin-section__head">
            <h2>${t('merchant.recentOrders')}</h2>
            <a href="${merchantHref('pedidos')}" class="btn btn-outline btn-sm">${t('common.viewAll')}</a>
          </div>
          ${renderRecentOrders(orders)}
        </section>
        ${renderReviewsSection(reviews)}
        ${renderAdsSummary(ads, store)}
      `,
    )

    return buildOrdersSubscription(store)
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
      : `<p class="form-hint form-hint--info">${escapeHtml(planProductImageLimitMessage(store.plan_id))} <a href="${merchantHref('planos')}">${t('merchant.viewPlansLink')}</a></p>`
    const productLimitHint = canCreate
      ? `<p class="form-hint">${escapeHtml(formatProductLimitHint(store.plan_id, products.length))}</p>`
      : `<p class="form-hint form-hint--info">${escapeHtml(planProductLimitMessage(store.plan_id))} <a href="${merchantHref('planos')}">${t('merchant.viewPlansLink')}</a></p>`

    main.innerHTML = merchantPage(
      menuItem.label,
      products.length === 1
        ? t('merchant.catalogItemCount', { count: products.length })
        : t('merchant.catalogItemsCount', { count: products.length }),
      `
        <div id="product-msg"></div>
        ${canCreate ? `
        <details class="admin-form-panel" open>
          <summary>${t('merchant.newCatalogItem')}</summary>
          ${productLimitHint}
          <form id="product-form" class="admin-form-grid" style="margin-top:1rem">
            ${catalogItemTypeFieldHtml('product')}
            <div class="form-group admin-form-grid__full">
              <label class="form-label">${t('labels.name')}</label>
              <input class="form-input" name="name" placeholder="${t('merchant.productNamePlaceholder')}" required />
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">${t('labels.description')}</label>
              <textarea class="form-input" name="description" placeholder="${t('merchant.descriptionPlaceholder')}" rows="2"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">${t('common.priceWithCurrency')}</label>
              <input class="form-input" name="price" type="number" step="0.01" min="0" required />
            </div>
            ${catalogStockFieldHtml(0, 'product')}
            ${catalogUsedFieldHtml(false)}
            <div class="form-group admin-form-grid__full">
              <label class="form-label">${t('labels.category')}</label>
              <select class="form-input" name="category_id">
                <option value="">${t('common.noCategory')}</option>
                ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">${t('common.image')}</label>
              <div class="admin-image-field">
                <div data-preview-product-create>${imagePreviewBlock(null, t('merchant.newProductPreview'), 'square')}</div>
                ${imageLimitHint}
                <input class="form-input" type="file" name="image" accept="image/*" ${canAddImage ? '' : 'disabled'} />
                ${canAddImage ? `<small class="form-hint">${PRODUCT_IMAGE_UPLOAD_HINT}</small>` : ''}
              </div>
            </div>
            <div class="admin-form-grid__full">
              <button type="submit" class="btn btn-primary btn-sm">${t('merchant.saveItem')}</button>
            </div>
          </form>
        </details>
        ` : `
        <div class="admin-form-panel" style="padding:1rem">
          ${productLimitHint}
        </div>`}

        <section class="admin-section">
          <div class="admin-section__head">
            <h2>${t('merchant.catalog')}</h2>
            <span class="admin-stat-chip admin-stat-chip--sent">${t('merchant.activeItemsCount', { count: products.filter((p) => p.active).length })}</span>
          </div>
          ${products.length === 0
            ? merchantEmptyState('📦', t('merchant.emptyCatalogTitle'), t('merchant.emptyCatalogBody'))
            : `
              <div class="admin-filter-bar admin-filter-bar--compact">
                <input type="search" class="form-input admin-filter-bar__search" id="merchant-products-search" placeholder="${t('merchant.searchCatalog')}" autocomplete="off" />
                <div class="admin-filter-chips" role="group">
                  <button type="button" class="admin-filter-chip active" data-filter="all">${t('common.all')}</button>
                  <button type="button" class="admin-filter-chip" data-filter="1">${t('common.activePlural')}</button>
                  <button type="button" class="admin-filter-chip" data-filter="0">${t('common.inactivePlural')}</button>
                </div>
              </div>
              <div class="table-wrap admin-table--stack" id="merchant-products-table">
                <table>
                  <thead><tr>
                    <th class="admin-table-sortable">
                      <button type="button" class="admin-table-sort active" data-sort-field="name" aria-label="${t('common.sortByName')}">
                        ${t('common.item')} <span class="admin-table-sort__icon" aria-hidden="true">↑</span>
                      </button>
                    </th>
                    <th class="admin-table-sortable">
                      <button type="button" class="admin-table-sort" data-sort-field="price" aria-label="${t('common.sortByPrice')}">
                        ${t('common.price')} <span class="admin-table-sort__icon" aria-hidden="true"></span>
                      </button>
                    </th>
                    <th class="admin-table-sortable">
                      <button type="button" class="admin-table-sort" data-sort-field="stock" aria-label="${t('common.sortByStock')}">
                        ${t('common.stock')} <span class="admin-table-sort__icon" aria-hidden="true"></span>
                      </button>
                    </th>
                    <th>${t('labels.status')}</th>
                    <th></th>
                  </tr></thead>
                  <tbody id="merchant-products-tbody">
                    ${renderProductTableRows(products, categories, store)}
                    <tr data-products-empty hidden>
                      <td colspan="5">${merchantEmptyState('🔍', t('common.noResults'), t('merchant.noProductsFilter'))}</td>
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
      metrics.totalOrders === 1
        ? t('merchant.ordersVolumeSummary', { count: metrics.totalOrders, revenue: formatCurrency(revenue) })
        : t('merchant.ordersVolumeSummaryPlural', { count: metrics.totalOrders, revenue: formatCurrency(revenue) }),
      `
        ${metrics.totalOrders > 0 ? `
          <div class="admin-stat-chips" style="margin-bottom:1rem">
            <span class="admin-stat-chip admin-stat-chip--sent">${t('merchant.sentOrdersCount', { count: metrics.byStatus.sent ?? 0 })}</span>
            <span class="admin-stat-chip admin-stat-chip--viewed">${t('merchant.viewedOrdersCount', { count: metrics.byStatus.viewed ?? 0 })}</span>
            <span class="admin-stat-chip admin-stat-chip--pending">${t('merchant.pendingOrdersCount', { count: metrics.byStatus.pending ?? 0 })}</span>
          </div>` : ''}
        ${orders.length === 0
          ? merchantEmptyState('🛒', t('merchant.noOrdersTitle'), t('merchant.noOrdersBody'))
          : `
            <div class="admin-orders-toolbar">
              <div class="admin-filter-bar admin-filter-bar--compact" style="margin:0;flex:1">
                <input type="search" class="form-input admin-filter-bar__search" id="merchant-orders-search" placeholder="${t('merchant.searchCustomerPhone')}" autocomplete="off" />
                <div class="admin-filter-chips" role="group">
                  <button type="button" class="admin-filter-chip active" data-order-status="all">${t('common.all')}</button>
                  <button type="button" class="admin-filter-chip" data-order-status="sent">${t('orderStatus.sentPlural')}</button>
                  <button type="button" class="admin-filter-chip" data-order-status="viewed">${t('orderStatus.viewedPlural')}</button>
                  <button type="button" class="admin-filter-chip" data-order-status="pending">${t('orderStatus.pendingPlural')}</button>
                </div>
              </div>
              <button type="button" class="btn btn-outline btn-sm" id="merchant-orders-export">${t('common.exportCsv')}</button>
            </div>
            <div class="table-wrap admin-orders-table admin-table--stack" style="margin-top:1rem" id="merchant-orders-table">
              <table>
                <thead><tr>
                  <th class="admin-table-sortable">
                    <button type="button" class="admin-table-sort active" id="merchant-orders-sort" data-sort-field="date" aria-label="${t('common.sortByDateRecent')}">
                      ${t('common.date')} <span class="admin-table-sort__icon" aria-hidden="true">↓</span>
                    </button>
                  </th>
                  <th>${t('common.customer')}</th>
                  <th>${t('labels.phone')}</th>
                  <th>${t('common.payment')}</th>
                  <th>${t('common.total')}</th>
                  <th>${t('labels.status')}</th>
                  <th></th>
                </tr></thead>
                <tbody id="merchant-orders-tbody">
                  ${renderOrderRows(orders)}
                  <tr data-orders-empty hidden>
                    <td colspan="7">${merchantEmptyState('🔍', t('common.noResults'), t('merchant.noOrdersFilter'))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div id="merchant-orders-pagination-wrap"></div>`}
      `,
      orders.length > 0
        ? `<span class="admin-export-hint">${t('merchant.exportFilteredHint')}</span>`
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

    return buildOrdersSubscription(store)
  }

  if (tab === 'ads') {
    const ads = await fetchStoreAds(store.id)
    const includedThisMonth = countIncludedStoreAdsThisMonth(ads)
    const approved = store.status === 'approved' && ['active', 'trialing'].includes(store.subscription_status)
    const canCreate = approved
      && planAllowsStoreAds(store.plan_id)
      && (canCreateIncludedStoreAd(store.plan_id, includedThisMonth)
        || (isExtraStoreAdSlot(store.plan_id, includedThisMonth) && canCreateExtraStoreAd(store.plan_id)))

    main.innerHTML = merchantPage(
      menuItem.label,
      planAllowsStoreAds(store.plan_id)
        ? t('merchant.adsSubtitle')
        : (canCreate ? t('merchant.adsSubtitle') : t('merchant.adsAfterApproval')),
      `
        <div id="ad-msg"></div>
        ${merchantAdsCreatePanel(store, ads)}
        <section class="admin-section">
          <div class="admin-section__head">
            <h2>${t('merchant.yourAds')}</h2>
            <span class="admin-stat-chip admin-stat-chip--sent">${ads.length === 1 ? t('merchant.adsRegisteredOne', { count: ads.length }) : t('merchant.adsRegisteredMany', { count: ads.length })}</span>
          </div>
          ${ads.length === 0
            ? merchantEmptyState(
              '📣',
              t('merchant.noAdsTitle'),
              canCreate
                ? t('merchant.createFirstAd')
                : (planAllowsStoreAds(store.plan_id) ? t('merchant.waitStoreApproval') : t('merchant.adsPremiumRequired')),
            )
            : `<div style="display:flex;flex-direction:column;gap:0.75rem">${renderStoreAdRows(ads)}</div>`}
        </section>
      `,
    )

    if (canCreate) bindAdForm(main, store)
    renderExtraAdPaymentBanner(main, ads)
    return
  }

  if (tab === 'plans') {
    main.innerHTML = merchantPage(
      menuItem.label,
      t('merchant.plansSubtitle'),
      await renderMerchantPlansPanel(store),
    )
    bindPlanRequestActions(main, store)
    return
  }

  if (tab === 'settings') {
    const [categories, neighborhoods] = await Promise.all([
      fetchCategories(),
      fetchNeighborhoods({ activeOnly: true }),
    ])
    const plan = getPlanById(store.plan_id)
    // Mantém o bairro atual na lista mesmo se inativo (para não perder o valor selecionado).
    const neighborhoodOptions = [...neighborhoods]
    if (store.neighborhood_id && !neighborhoodOptions.some((n) => n.id === store.neighborhood_id)) {
      if (store.neighborhood) neighborhoodOptions.unshift(store.neighborhood)
    }

    main.innerHTML = merchantPage(
      menuItem.label,
      t('merchant.settingsSubtitle'),
      `
        <div id="settings-msg"></div>
        <div class="merchant-settings-layout">
          <aside class="merchant-settings-aside">
            ${renderSettingsPreviewCard(store, plan)}
          </aside>
          <form id="settings-form" class="merchant-settings-form merchant-settings-main">
            <section class="merchant-settings-section">
              <h2>${t('merchant.storeInfo')}</h2>
              <div class="admin-form-grid">
                <div class="form-group admin-form-grid__full">
                  <label class="form-label">${t('labels.name')}</label>
                  <input class="form-input" name="name" value="${escapeHtml(store.name)}" required />
                </div>
                <div class="form-group">
                  <label class="form-label">${t('labels.whatsapp')}</label>
                  <input class="form-input" name="whatsapp" value="${escapeHtml(store.whatsapp)}" required />
                </div>
                <div class="form-group">
                  <label class="form-label">${t('merchant.openingHours')}</label>
                  <input class="form-input" name="opening_hours" value="${escapeHtml(store.opening_hours ?? '')}" placeholder="${t('merchant.openingHoursPlaceholder')}" />
                </div>
                <div class="form-group admin-form-grid__full">
                  <label class="form-label">${t('merchant.instagram')}</label>
                  <input class="form-input" name="instagram" value="${escapeHtml(store.instagram ?? '')}" placeholder="${t('merchant.instagramPlaceholder')}" autocomplete="off" />
                  <p class="form-hint">${t('merchant.instagramOptionalHint')}</p>
                </div>
                <div class="form-group admin-form-grid__full">
                  <label class="form-label">${t('labels.description')}</label>
                  <textarea class="form-input" name="description" rows="3">${escapeHtml(store.description ?? '')}</textarea>
                </div>
                <div class="form-group">
                  <label class="form-label">${t('auth.neighborhoodRegion')}</label>
                  <select class="form-input" name="neighborhood_id" required>
                    <option value="">${t('app.selectPlaceholder')}</option>
                    ${neighborhoodOptions.map((n) => `
                      <option value="${n.id}" data-city="${escapeHtml(n.city ?? '')}" data-state="${escapeHtml(n.state ?? '')}" ${store.neighborhood_id === n.id ? 'selected' : ''}>
                        ${escapeHtml(formatNeighborhoodLabel(n))}
                      </option>
                    `).join('')}
                  </select>
                  <p class="form-hint">${t('auth.neighborhoodAdminOnlyHint')}</p>
                </div>
                <div class="form-group">
                  <label class="form-label">${t('labels.category')}</label>
                  <select class="form-input" name="category_id" required>
                    <option value="">${t('app.selectPlaceholder')}</option>
                    ${categories.map((c) => `<option value="${c.id}" ${store.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                  </select>
                  <p class="form-hint">${t('auth.categoryAdminOnlyHint')}</p>
                </div>
                <div class="form-group">
                  <label class="form-label">${t('labels.city')}</label>
                  <input class="form-input" name="city" value="${escapeHtml(store.city ?? '')}" readonly tabindex="-1" />
                </div>
                <div class="form-group">
                  <label class="form-label">${t('labels.state')}</label>
                  <input class="form-input" name="state" value="${escapeHtml(store.state ?? '')}" maxlength="2" readonly tabindex="-1" />
                </div>
                <div class="form-group">
                  <label class="form-label">${t('merchant.themeColor')}</label>
                  <select class="form-input" name="theme_color">
                    ${STORE_THEME_COLORS.map((c) => `<option value="${c.id}" ${store.theme_color === c.id ? 'selected' : ''}>${c.id}</option>`).join('')}
                  </select>
                </div>
              </div>
            </section>
            <section class="merchant-settings-section">
              <h2>${t('merchant.paymentMethods')}</h2>
              <p class="form-hint">${t('merchant.paymentMethodsHint')}</p>
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
            <button type="submit" class="btn btn-primary">${t('merchant.saveChanges')}</button>
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
      t('merchant.accountSubtitle'),
      `
        <div class="admin-account-card">
          <p class="admin-account-card__email"><span>${t('common.account')}</span> ${escapeHtml(user.email)}</p>
          <form id="merchant-password-form" class="admin-password-form">
            <div class="form-group">
              <label class="form-label">${t('labels.newPassword')}</label>
              <input class="form-input" type="password" name="password" required minlength="6" autocomplete="new-password" />
            </div>
            <div class="form-group">
              <label class="form-label">${t('labels.confirmNewPassword')}</label>
              <input class="form-input" type="password" name="confirm" required minlength="6" autocomplete="new-password" />
            </div>
            <div id="merchant-password-msg"></div>
            <button type="submit" class="btn btn-primary btn-sm">${t('merchant.changePassword')}</button>
          </form>
        </div>
      `,
    )

    bindPasswordForm(main)
    return
  }
}