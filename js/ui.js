/**
 * Componentes de UI reutilizáveis (renderização imperativa).
 *
 * Header: logo, nav-desktop (Início, Criar loja, Entrar), ações (tema, painel, sair)
 * e nav-mobile (hambúrguer). Entrar fica no menu — não nas ações do header.
 *
 * Também: store-card, feed-product-card, cart-drawer e checkout com pagamentos por loja.
 */
import { APP_NAME } from './config.js'
import { t, deliveryPeriodLabel } from './strings.js'
import { getStoreThemeColor } from './config.js'
import { escapeHtml, formatCurrency, formatPhone } from './utils.js'
import { isCatalogItemAvailable, getCatalogItemIcon, getCatalogItemLabel } from './catalog.js'
import { getPlanById } from './plans.js'
import {
  getUser, logout, onAuthChange, toggleTheme, getTheme, getAdminPendingCount,
  getMerchantNewOrdersCount,
  getCart, onCartChange, openCart, closeCart, removeItem, updateQuantity,
  getCartTotal, getCartItemCount, clearCart,
} from './state.js'
import { buildOrderMessage, buildWhatsAppUrl } from './whatsapp.js'
import {
  getPaymentMethod, getDefaultPaymentMethod, isValidPaymentMethod,
} from './payment.js'
import { createOrder } from './api.js'
import { navigate, render as rerenderRoute, getCurrentPath, routeHref } from './router.js'
import { showToast } from './utils.js'
import { STAFF_PANELS, getStaffMenu, isStaffPath, getStaffPanel, getStaffTab } from './staff-nav.js'
import { MERCHANT_PANEL, MERCHANT_MENU, isMerchantPath, getMerchantTab, merchantMenuHref } from './merchant-nav.js'

let menuOpen = false
let staffMenuOpen = false

/** Links fora do SPA (ex.: strings-editor.html) abrem em nova aba. */
function staffMenuLinkAttrs(item) {
  return item.external ? ' target="_blank" rel="noopener noreferrer"' : ''
}

function renderStaffMenuItems(panel, activeTab, { compact = false } = {}) {
  return getStaffMenu(panel).map((item) => `
    <a href="${item.href}"${staffMenuLinkAttrs(item)} class="admin-menu__item ${activeTab === item.id ? 'active' : ''} ${compact ? 'admin-menu__item--compact' : ''}">
      <span class="admin-menu__icon">${item.icon}</span>
      <span>${item.label}</span>
    </a>
  `).join('')
}

function renderStaffPanelDropdown(user, panel, activeTab) {
  const panelConfig = STAFF_PANELS[panel]
  const onPanel = isStaffPath() && getStaffPanel() === panel && user?.role === panel
  return `
    <div class="header-dropdown ${staffMenuOpen ? 'open' : ''}" id="staff-dropdown-${panel}">
      <button type="button" class="icon-btn ${onPanel ? 'icon-btn--active' : ''}" id="staff-menu-toggle-${panel}" title="${panelConfig.label}" aria-expanded="${staffMenuOpen}" aria-haspopup="true">${panelConfig.icon}</button>
      <div class="header-dropdown__panel admin-menu" role="menu">
        <p class="admin-menu__title">${panelConfig.label}</p>
        ${renderStaffMenuItems(panel, activeTab)}
        <div class="admin-menu__divider"></div>
        <a href="${routeHref('/')}" class="admin-menu__item admin-menu__item--muted">${t('nav.backToSite')}</a>
      </div>
    </div>`
}

export function renderHeader() {
  const header = document.getElementById('header')
  if (!header) return

  const user = getUser()
  const currentPath = getCurrentPath()
  const staffPanel = getStaffPanel(currentPath)
  const onStaff = (user?.role === 'admin' && staffPanel === 'admin')
    || (user?.role === 'moderator' && staffPanel === 'moderator')
  const onMerchant = user?.role === 'merchant' && isMerchantPath(currentPath)
  const staffTab = onStaff ? getStaffTab(currentPath, staffPanel) : null
  const merchantTab = onMerchant ? getMerchantTab(currentPath) : null
  const onHome = currentPath === '/' || currentPath === ''
  const onLogin = currentPath === '/conta/entrar'
  const onRegisterStore = currentPath === '/lojista/cadastro'
  const showCreateStore = !user || user?.role === 'customer'

  header.innerHTML = `
    <div class="header__inner">
      <a href="${routeHref('/')}" class="logo">
        <div class="logo__icon">🏪</div>
        <span>${APP_NAME.replace('Vendas', '')}<span class="accent">Vendas</span></span>
      </a>

      <nav class="nav-desktop">
        <a href="${routeHref('/')}" class="nav-btn${onHome ? ' active' : ''}">
          <span class="nav-btn__icon" aria-hidden="true">🏠</span>
          <span>${t('nav.home')}</span>
        </a>
        ${showCreateStore ? `<a href="${routeHref('/lojista/cadastro')}" class="nav-btn${onRegisterStore ? ' active' : ''}">
          <span class="nav-btn__icon" aria-hidden="true">🏪</span>
          <span>${t('nav.createStore')}</span>
        </a>` : ''}
        ${!user ? `<a href="${routeHref('/conta/entrar')}" class="nav-btn${onLogin ? ' active' : ''}">
          <span class="nav-btn__icon" aria-hidden="true">🔑</span>
          <span>${t('nav.login')}</span>
        </a>` : ''}
      </nav>

      <div class="header__actions">
        <button type="button" class="icon-btn" id="theme-toggle" title="${t('nav.toggleTheme')}">${getTheme() === 'dark' ? '☀️' : '🌙'}</button>

        ${user?.role === 'customer' ? `<a href="#/favoritos" class="icon-btn" title="${t('nav.myAccount')}">👤</a>` : ''}
        ${user?.role === 'merchant' ? `
          <div class="header-dropdown ${staffMenuOpen ? 'open' : ''}" id="staff-dropdown-merchant">
            <button type="button" class="icon-btn ${onMerchant ? 'icon-btn--active' : ''}" id="staff-menu-toggle-merchant" title="${MERCHANT_PANEL.label}" aria-expanded="${staffMenuOpen}" aria-haspopup="true">${MERCHANT_PANEL.icon}</button>
            <div class="header-dropdown__panel admin-menu" role="menu">
              <p class="admin-menu__title">${MERCHANT_PANEL.label}</p>
              ${MERCHANT_MENU.map((item) => `
                <a href="${merchantMenuHref(item)}" class="admin-menu__item ${merchantTab === item.id ? 'active' : ''}">
                  <span class="admin-menu__icon">${item.icon}</span>
                  <span>${item.label}</span>
                </a>
              `).join('')}
              <div class="admin-menu__divider"></div>
              <a href="${routeHref('/')}" class="admin-menu__item admin-menu__item--muted">${t('nav.backToSite')}</a>
            </div>
          </div>` : ''}
        ${user?.role === 'admin' ? renderStaffPanelDropdown(user, 'admin', staffTab) : ''}
        ${user?.role === 'moderator' ? renderStaffPanelDropdown(user, 'moderator', staffTab) : ''}
        ${user ? `<button type="button" class="icon-btn" id="logout-btn" title="${t('nav.logout')}">🚪</button>` : ''}

        <button type="button" class="icon-btn menu-toggle" id="menu-toggle" aria-expanded="${menuOpen}">${menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}</button>
      </div>
    </div>

    <nav class="nav-mobile ${menuOpen ? 'open' : ''}" id="nav-mobile">
      ${!user || showCreateStore ? `
        <div class="nav-mobile__actions">
          <a href="${routeHref('/')}" class="nav-btn nav-btn--block${onHome ? ' active' : ''}">
            <span class="nav-btn__icon" aria-hidden="true">🏠</span>
            <span>${t('nav.home')}</span>
          </a>
          ${showCreateStore ? `<a href="${routeHref('/lojista/cadastro')}" class="nav-btn nav-btn--block${onRegisterStore ? ' active' : ''}">
            <span class="nav-btn__icon" aria-hidden="true">🏪</span>
            <span>${t('nav.createStore')}</span>
          </a>` : ''}
          ${!user ? `<a href="${routeHref('/conta/entrar')}" class="nav-btn nav-btn--block${onLogin ? ' active' : ''}">
            <span class="nav-btn__icon" aria-hidden="true">🔑</span>
            <span>${t('nav.login')}</span>
          </a>` : ''}
        </div>
      ` : ''}
      ${user?.role === 'customer' ? `<a href="#/favoritos">${t('nav.myAccount')}</a>` : ''}
      ${user?.role === 'merchant' ? `
        <p class="nav-mobile__section">${t('nav.merchantPanel')}</p>
        ${MERCHANT_MENU.map((item) => {
          const badge = item.id === 'orders' && getMerchantNewOrdersCount() > 0
            ? ` (${getMerchantNewOrdersCount()})` : ''
          return `<a href="${merchantMenuHref(item)}" class="${merchantTab === item.id ? 'active' : ''}">${item.icon} ${item.label}${badge}</a>`
        }).join('')}
        <a href="${routeHref('/')}">${t('nav.backToSite')}</a>
      ` : ''}
      ${user?.role === 'admin' ? `
        <p class="nav-mobile__section">${t('nav.adminPanel')}</p>
        ${renderStaffMenuItems('admin', staffTab, { compact: true })}
        <a href="${routeHref('/')}">${t('nav.backToSite')}</a>
      ` : ''}
      ${user?.role === 'moderator' ? `
        <p class="nav-mobile__section">${t('moderator.panelLabel')}</p>
        ${renderStaffMenuItems('moderator', staffTab, { compact: true })}
        <a href="${routeHref('/')}">${t('nav.backToSite')}</a>
      ` : ''}
      ${user ? `<button type="button" id="logout-mobile">🚪 ${t('nav.logout')}</button>` : ''}
    </nav>

    ${onStaff ? `
      <div class="admin-toolbar">
        <div class="admin-toolbar__inner">
          <div class="admin-toolbar__tabs">
            ${getStaffMenu(staffPanel).map((item) => {
              const pending = item.id === 'approvals' ? getAdminPendingCount() : 0
              return `
              <a href="${item.href}"${staffMenuLinkAttrs(item)} class="admin-toolbar__tab ${staffTab === item.id ? 'active' : ''}">
                <span>${item.icon}</span> ${item.label}
                ${pending > 0 ? `<span class="admin-toolbar__badge">${pending}</span>` : ''}
              </a>`
            }).join('')}
          </div>
          <button type="button" class="btn btn-outline btn-sm" id="admin-refresh" title="${t('common.refreshDataTitle')}">${t('nav.refresh')}</button>
        </div>
      </div>
    ` : ''}
    ${onMerchant ? `
      <div class="admin-toolbar merchant-toolbar">
        <div class="admin-toolbar__inner">
          <div class="admin-toolbar__tabs">
            ${MERCHANT_MENU.map((item) => {
              const pending = item.id === 'orders' ? getMerchantNewOrdersCount() : 0
              return `
              <a href="${merchantMenuHref(item)}" class="admin-toolbar__tab ${merchantTab === item.id ? 'active' : ''}">
                <span>${item.icon}</span> ${item.label}
                ${pending > 0 ? `<span class="admin-toolbar__badge">${pending}</span>` : ''}
              </a>`
            }).join('')}
          </div>
          <button type="button" class="btn btn-outline btn-sm" id="merchant-refresh" title="${t('common.refreshDataTitle')}">${t('nav.refresh')}</button>
        </div>
      </div>
    ` : ''}
  `

  header.classList.toggle('header--admin', onStaff || onMerchant)

  ;['admin', 'moderator', 'merchant'].forEach((panel) => {
    document.getElementById(`staff-menu-toggle-${panel}`)?.addEventListener('click', (e) => {
      e.stopPropagation()
      staffMenuOpen = !staffMenuOpen
      menuOpen = false
      renderHeader()
    })
  })

  document.getElementById('admin-refresh')?.addEventListener('click', () => {
    rerenderRoute()
    showToast(t('toasts.panelUpdated'))
  })

  document.getElementById('merchant-refresh')?.addEventListener('click', () => {
    rerenderRoute()
    showToast(t('toasts.panelUpdated'))
  })

  header.querySelectorAll('.admin-menu__item, .admin-toolbar__tab').forEach((link) => {
    link.addEventListener('click', () => {
      staffMenuOpen = false
      menuOpen = false
    })
  })

  if (staffMenuOpen) {
    setTimeout(() => {
      const close = (ev) => {
        const inside = ['admin', 'moderator', 'merchant'].some((panel) =>
          document.getElementById(`staff-dropdown-${panel}`)?.contains(ev.target))
        if (!inside) {
          staffMenuOpen = false
          document.removeEventListener('click', close)
          renderHeader()
        }
      }
      document.addEventListener('click', close)
    }, 0)
  }

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    toggleTheme()
    renderHeader()
  })

  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    menuOpen = !menuOpen
    renderHeader()
  })

  async function doLogout() {
    await logout()
    menuOpen = false
    navigate('/')
  }

  document.getElementById('logout-btn')?.addEventListener('click', doLogout)
  document.getElementById('logout-mobile')?.addEventListener('click', doLogout)
}

export function initHeader() {
  renderHeader()
  onAuthChange(() => renderHeader())
}

export function renderStoreCard(store, options = {}) {
  const { showPlanBadge = false } = options
  const theme = getStoreThemeColor(store.theme_color)
  const bannerStyle = `background: linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`
  const plan = getPlanById(store.plan_id)
  const planBadge = showPlanBadge && store.plan_id && store.plan_id !== 'free'
    ? `<span class="store-card__plan-badge store-card__plan-badge--${escapeHtml(store.plan_id)}">${escapeHtml(plan.name)}</span>`
    : ''

  return `
    <article class="store-card">
      <div class="store-card__banner">
        ${planBadge}
        ${store.banner
          ? `<img src="${escapeHtml(store.banner)}" alt="" loading="lazy" />`
          : `<div style="${bannerStyle};width:100%;height:100%"></div>`}
        ${store.logo
          ? `<img class="store-card__logo" src="${escapeHtml(store.logo)}" alt="${escapeHtml(store.name)}" />`
          : `<div class="store-card__logo-placeholder" style="background:${theme.hex}">🏪</div>`}
      </div>
      <div class="store-card__body">
        <h3 class="store-card__title">${escapeHtml(store.name)}</h3>
        ${store.category ? `<span class="store-card__category" style="background:${theme.hex}">${escapeHtml(store.category.name)}</span>` : ''}
        <div class="store-card__meta">
          <span>📍 ${escapeHtml(store.city)}, ${escapeHtml(store.state)}</span>
          ${store.opening_hours ? `<span>🕐 ${escapeHtml(store.opening_hours)}</span>` : ''}
        </div>
        <a href="#/loja/${escapeHtml(store.slug)}" class="btn btn-block" style="margin-top:1rem;background:${theme.hex};color:white">
          ${t('home.viewStoreCta')}
        </a>
      </div>
    </article>
  `
}

/** Anúncio patrocinado no feed da home. */
export function renderFeedAdCard(ad) {
  const store = ad.store
  const theme = getStoreThemeColor(store?.theme_color)
  const bannerStyle = `background: linear-gradient(135deg, ${theme?.gradientFrom ?? '#448AFF'}, ${theme?.gradientTo ?? '#1565C0'})`

  return `
    <article class="feed-ad-card">
      <div class="feed-ad-card__label">${t('app.sponsored')}</div>
      <div class="feed-ad-card__inner">
        <a href="#/loja/${escapeHtml(store?.slug ?? '')}" class="feed-ad-card__media">
          ${ad.image_url
            ? `<img src="${escapeHtml(ad.image_url)}" alt="" loading="lazy" />`
            : store?.logo
              ? `<img src="${escapeHtml(store.logo)}" alt="" loading="lazy" />`
              : `<div class="feed-ad-card__placeholder" style="${bannerStyle}">📣</div>`}
        </a>
        <div class="feed-ad-card__body">
          <p class="feed-ad-card__store">🏪 ${escapeHtml(store?.name ?? t('common.defaultStore'))}</p>
          <h3 class="feed-ad-card__title">${escapeHtml(ad.title)}</h3>
          <p class="feed-ad-card__message">${escapeHtml(ad.message)}</p>
          <a href="#/loja/${escapeHtml(store?.slug ?? '')}" class="btn btn-primary btn-sm">${t('home.viewStore')}</a>
        </div>
      </div>
    </article>
  `
}

/** Card horizontal de produto no feed da home. */
export function renderFeedProductCard(product, options = {}) {
  const { badge = 'new' } = options
  const oos = !isCatalogItemAvailable(product)
  const likesCount = product.likes_count ?? 0
  const badgeLabels = {
    liked: t('home.badgeMostLiked'),
    new: t('home.badgeNewProduct'),
    pick: t('home.badgeFeatured'),
  }
  const badgeLabel = badgeLabels[badge] ?? badgeLabels.new
  const badgeClass = badge === 'liked'
    ? 'feed-product-card__badge--liked'
    : badge === 'pick'
      ? 'feed-product-card__badge--pick'
      : 'feed-product-card__badge--new'
  const store = product.store

  return `
    <article class="feed-product-card ${oos ? 'out-of-stock' : ''}">
      <div class="feed-product-card__badge ${badgeClass}">${badgeLabel}</div>
      <div class="feed-product-card__inner">
        <a href="#/loja/${escapeHtml(store?.slug ?? '')}" class="feed-product-card__media">
          ${product.image
            ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />`
            : `<div class="feed-product-card__placeholder">${getCatalogItemIcon(product)}</div>`}
          ${oos ? `<span class="product-card__oos">${t('store.unavailable')}</span>` : ''}
        </a>
        <div class="feed-product-card__body">
          <a href="#/loja/${escapeHtml(store?.slug ?? '')}" class="feed-product-card__name">${escapeHtml(product.name)}</a>
          ${store ? `<p class="feed-product-card__store">🏪 ${escapeHtml(store.name)}</p>` : ''}
          ${product.description ? `<p class="feed-product-card__desc">${escapeHtml(product.description)}</p>` : ''}
          <div class="feed-product-card__footer">
            <div class="feed-product-card__meta">
              <span class="feed-product-card__price">${formatCurrency(product.price)}</span>
              ${likesCount > 0 ? `<span class="feed-product-card__likes">❤️ ${likesCount}</span>` : ''}
            </div>
            <button type="button" class="btn btn-primary btn-sm" data-feed-add-product="${product.id}" ${oos ? 'disabled' : ''}>
              ${t('home.addToCartShort')}
            </button>
          </div>
        </div>
      </div>
    </article>
  `
}

export function renderProductCard(product, options = {}) {
  const {
    user = null,
    commentsOpen = false,
    comments = [],
    commentsLoading = false,
  } = options
  const oos = !isCatalogItemAvailable(product)
  const likesCount = product.likes_count ?? 0
  const commentsCount = product.comments_count ?? 0
  const typeLabel = getCatalogItemLabel(product)
  const liked = Boolean(product.liked_by_user)
  const canEngage = Boolean(user)

  return `
    <article class="product-card ${oos ? 'out-of-stock' : ''}" data-product-id="${product.id}">
      <div class="product-card__img">
        ${product.image
          ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />`
          : `<div class="product-card__placeholder">${getCatalogItemIcon(product)}</div>`}
        ${oos ? `<span class="product-card__oos">${t('store.unavailable')}</span>` : ''}
        <span class="product-card__type">${escapeHtml(typeLabel)}</span>
      </div>
      <div class="product-card__body">
        <h3 class="product-card__name">${escapeHtml(product.name)}</h3>
        ${product.description ? `<p class="product-card__desc">${escapeHtml(product.description)}</p>` : ''}
        <div class="product-card__engagement">
          ${canEngage ? `
            <button type="button" class="engagement-btn ${liked ? 'active' : ''}" data-like-product="${product.id}" aria-pressed="${liked}">
              ${liked ? '❤️' : '🤍'} <span data-like-count="${product.id}">${likesCount}</span>
            </button>
            <button type="button" class="engagement-btn" data-toggle-comments="${product.id}" aria-expanded="${commentsOpen}">
              💬 <span data-comment-count="${product.id}">${commentsCount}</span>
            </button>
          ` : `
            <span class="engagement-btn engagement-btn--readonly" title="${t('store.loginToLike')}">🤍 ${likesCount}</span>
            <button type="button" class="engagement-btn engagement-btn--ghost" data-toggle-comments="${product.id}" aria-expanded="${commentsOpen}">
              💬 ${commentsCount}
            </button>
          `}
        </div>
        ${commentsOpen ? `
          <div class="product-comments" data-comments-panel="${product.id}">
            ${commentsLoading
              ? `<p class="product-comments__status">${t('common.loadingComments')}</p>`
              : comments.length === 0
                ? `<p class="product-comments__status">${t('store.noCommentsYet')}</p>`
                : comments.map((comment) => `
                    <div class="product-comment">
                      <div class="product-comment__meta">
                        <strong>${escapeHtml(comment.user?.name ?? t('common.defaultUser'))}</strong>
                        <span>${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(comment.created_at))}</span>
                      </div>
                      <p>${escapeHtml(comment.content)}</p>
                    </div>
                  `).join('')}
            ${canEngage ? `
              <form class="product-comment-form" data-comment-form="${product.id}">
                <textarea class="form-input" name="content" rows="2" maxlength="500" placeholder="${t('store.commentPlaceholder')}" required></textarea>
                <button type="submit" class="btn btn-primary btn-sm">${t('store.submitComment')}</button>
              </form>
            ` : `
              <p class="product-comments__login-hint">
                ${t('common.loginOrRegisterToComment')}
              </p>
            `}
          </div>
        ` : ''}
        <div class="product-card__footer">
          <span class="product-card__price">${formatCurrency(product.price)}</span>
          <button type="button" class="btn btn-primary btn-sm" data-add-product="${product.id}" ${oos ? 'disabled' : ''}>${t('store.addProduct')}</button>
        </div>
      </div>
    </article>
  `
}

let cartCheckoutOpen = false

function renderCartItem(item) {
  const subtotal = item.product.price * item.quantity
  return `
    <li class="cart-item">
      <div class="cart-item__media">
        ${item.product.image
          ? `<img src="${escapeHtml(item.product.image)}" alt="" loading="lazy" />`
          : `<span class="cart-item__placeholder" aria-hidden="true">${getCatalogItemIcon(item.product)}</span>`}
      </div>
      <div class="cart-item__content">
        <div class="cart-item__top">
          <h4 class="cart-item__name">${escapeHtml(item.product.name)}</h4>
          <button type="button" class="cart-item__remove" data-remove="${item.product.id}" aria-label="${t('common.removeItem')}">✕</button>
        </div>
        <p class="cart-item__unit">${t('common.priceEach', { price: formatCurrency(item.product.price) })}</p>
        <div class="cart-item__bottom">
          <div class="cart-qty">
            <button type="button" class="cart-qty__btn" data-qty-minus="${item.product.id}" aria-label="${t('common.decreaseQty')}">−</button>
            <span class="cart-qty__value">${item.quantity}</span>
            <button type="button" class="cart-qty__btn" data-qty-plus="${item.product.id}" aria-label="${t('common.increaseQty')}">+</button>
          </div>
          <span class="cart-item__subtotal">${formatCurrency(subtotal)}</span>
        </div>
      </div>
    </li>
  `
}

function renderPaymentOptions(allowedIds, selected) {
  const defaultMethod = getDefaultPaymentMethod(allowedIds)
  const active = selected ?? defaultMethod

  return `
    <fieldset class="checkout-payment">
      <legend class="checkout-payment__label">${t('checkout.paymentLegend')}</legend>
      <div class="checkout-payment__options">
        ${allowedIds.map((id) => {
          const method = getPaymentMethod(id)
          if (!method) return ''
          return `
            <label class="checkout-payment__option ${active === method.id ? 'active' : ''}">
              <input
                type="radio"
                name="payment"
                value="${escapeHtml(method.id)}"
                ${active === method.id ? 'checked' : ''}
                required
              />
              <span class="checkout-payment__icon" aria-hidden="true">${method.icon}</span>
              <span class="checkout-payment__copy">
                <span class="checkout-payment__title">${escapeHtml(method.label)}</span>
                <span class="checkout-payment__hint">${escapeHtml(method.hint)}</span>
              </span>
            </label>
          `
        }).join('')}
      </div>
    </fieldset>
  `
}

function renderCheckoutSummary(cart, total, count) {
  return `
    <div class="cart-summary">
      <div class="cart-summary__row">
        <span>${t('cart.itemsCount', { count })}</span>
        <span>${formatCurrency(total)}</span>
      </div>
      <div class="cart-summary__row cart-summary__row--total">
        <span>${t('cart.total')}</span>
        <span class="cart-summary__total">${formatCurrency(total)}</span>
      </div>
    </div>
    <button type="button" class="btn btn-green btn-block cart-checkout-btn" id="checkout-start">
      ${t('checkout.finalizeOrder')}
    </button>
    <p class="cart-checkout-hint">${t('cart.checkoutHint')}</p>
  `
}

export function renderCartDrawer() {
  const root = document.getElementById('cart-root')
  if (!root) return

  const cart = getCart()
  if (!cart.isOpen) {
    root.innerHTML = ''
    cartCheckoutOpen = false
    return
  }

  const total = getCartTotal()
  const count = getCartItemCount()
  const allowedPayments = cart.storePaymentMethods ?? []
  const hasItems = cart.items.length > 0

  root.innerHTML = `
    <div class="cart-overlay" id="cart-overlay"></div>
    <aside class="cart-drawer ${cartCheckoutOpen ? 'cart-drawer--checkout' : ''}" role="dialog" aria-label="${t('cart.title')}">
      <div class="cart-drawer__header">
        <div class="cart-drawer__title-group">
          <span class="cart-drawer__eyebrow">${cartCheckoutOpen ? t('checkout.finalizeOrder') : t('cart.yourOrder')}</span>
          <strong class="cart-drawer__title">${cartCheckoutOpen ? t('checkout.finalizeOrder') : t('cart.title')}</strong>
          ${cart.storeName && !cartCheckoutOpen ? `<span class="cart-drawer__store">🏪 ${escapeHtml(cart.storeName)}</span>` : ''}
        </div>
        <div class="cart-drawer__header-actions">
          ${count > 0 ? `<span class="cart-drawer__count">${count}</span>` : ''}
          <button type="button" class="cart-drawer__close icon-btn" id="cart-close" aria-label="${t('common.closeCart')}">✕</button>
        </div>
      </div>

      ${!hasItems ? `
        <div class="cart-empty">
          <div class="cart-empty__icon" aria-hidden="true">🛒</div>
          <h3 class="cart-empty__title">${t('cart.emptyTitle')}</h3>
          <p class="cart-empty__text">${t('cart.emptyBody')}</p>
        </div>
      ` : cartCheckoutOpen ? `
        <div class="cart-drawer__checkout-scroll">
          <form id="checkout-form" class="cart-checkout-form">
            ${renderPaymentOptions(allowedPayments)}
            <div class="cart-checkout-form__section">
              <p class="cart-checkout-form__section-title">${t('checkout.deliverySectionTitle')}</p>
              <div class="form-group">
                <label class="form-label" for="checkout-name">${t('labels.name')}</label>
                <input class="form-input" id="checkout-name" name="name" placeholder="${t('checkout.namePlaceholder')}" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="checkout-phone">${t('labels.phone')}</label>
                <input class="form-input" id="checkout-phone" name="phone" placeholder="(21) 99999-9999" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="checkout-address">${t('labels.address')}</label>
                <textarea class="form-input" id="checkout-address" name="address" placeholder="${t('checkout.addressPlaceholder')}" rows="3" required></textarea>
              </div>
            </div>
          </form>
        </div>
        <div class="cart-drawer__footer cart-drawer__footer--checkout">
          <div class="cart-checkout-total">
            <span>${t('checkout.orderTotal')}</span>
            <strong>${formatCurrency(total)}</strong>
          </div>
          <div class="cart-checkout-actions">
            <button type="button" class="btn btn-outline" id="checkout-back">${t('checkout.back')}</button>
            <button type="submit" form="checkout-form" class="btn btn-green" id="checkout-submit">
              ${t('checkout.sendViaWhatsapp')}
            </button>
          </div>
        </div>
      ` : `
        <div class="cart-drawer__body">
          <ul class="cart-drawer__items" id="cart-items">
            ${cart.items.map(renderCartItem).join('')}
          </ul>
        </div>
        <div class="cart-drawer__footer">
          <div id="checkout-area">
            ${renderCheckoutSummary(cart, total, count)}
          </div>
        </div>
      `}
    </aside>
  `

  document.getElementById('cart-overlay')?.addEventListener('click', () => {
    cartCheckoutOpen = false
    closeCart()
  })
  document.getElementById('cart-close')?.addEventListener('click', () => {
    cartCheckoutOpen = false
    closeCart()
  })

  root.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => removeItem(btn.dataset.remove))
  })
  root.querySelectorAll('[data-qty-minus]').forEach((btn) => {
    const item = cart.items.find((i) => i.product.id === btn.dataset.qtyMinus)
    if (item) btn.addEventListener('click', () => updateQuantity(item.product.id, item.quantity - 1))
  })
  root.querySelectorAll('[data-qty-plus]').forEach((btn) => {
    const item = cart.items.find((i) => i.product.id === btn.dataset.qtyPlus)
    if (item) btn.addEventListener('click', () => updateQuantity(item.product.id, item.quantity + 1))
  })

  document.getElementById('checkout-start')?.addEventListener('click', showCheckoutForm)

  if (cartCheckoutOpen) bindCheckoutForm(root, allowedPayments)
}

function bindCheckoutForm(root, allowedPayments) {
  const form = root.querySelector('#checkout-form')
  if (!form) return

  const user = getUser()
  if (user?.role === 'customer') {
    if (form.name && !form.name.value) form.name.value = user.name ?? ''
    if (form.phone && !form.phone.value) form.phone.value = user.phone ?? ''
    if (form.address && !form.address.value) form.address.value = user.address ?? ''
  }

  form.querySelectorAll('.checkout-payment__option input').forEach((input) => {
    input.addEventListener('change', () => {
      form.querySelectorAll('.checkout-payment__option').forEach((label) => {
        label.classList.toggle('active', label.querySelector('input')?.checked)
      })
    })
  })

  document.getElementById('checkout-back')?.addEventListener('click', () => {
    cartCheckoutOpen = false
    renderCartDrawer()
  })

  form.addEventListener('submit', (e) => handleCheckout(e, allowedPayments))
}

function showCheckoutForm() {
  cartCheckoutOpen = true
  renderCartDrawer()
}

async function handleCheckout(e, allowedPayments) {
  e.preventDefault()
  const cart = getCart()
  if (!cart.storeId || !cart.storeWhatsapp) return

  const form = e.target
  const name = form.name.value.trim()
  const phone = form.phone.value.trim()
  const address = form.address.value.trim()
  const paymentMethod = form.payment?.value
  const allowed = allowedPayments ?? cart.storePaymentMethods ?? []
  if (!isValidPaymentMethod(paymentMethod, allowed)) return
  const total = getCartTotal()
  const user = getUser()

  const deliveryPeriod = user?.delivery_period ? deliveryPeriodLabel(user.delivery_period) : undefined

  const message = buildOrderMessage({
    items: cart.items,
    total,
    customerName: name,
    customerPhone: phone,
    customerAddress: address,
    deliveryPeriod,
    paymentMethod,
  })

  const submitBtn = document.getElementById('checkout-submit')
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t('checkout.submitting') }

  try {
    await createOrder(cart.storeId, {
      customerName: name,
      customerPhone: phone,
      customerAddress: address,
      paymentMethod,
    }, cart.items)
  } catch (err) {
    console.error('Erro ao salvar pedido:', err)
  }

  window.open(buildWhatsAppUrl(cart.storeWhatsapp, message), '_blank')
  cartCheckoutOpen = false
  clearCart()
  closeCart()
  showToast(t('toasts.orderSent'))
}

export function initCart() {
  onCartChange(renderCartDrawer)
  renderCartDrawer()
}

export { openCart, closeCart, formatPhone }