/**
 * Componentes de UI reutilizáveis (renderização imperativa).
 *
 * Header: logo, nav-desktop (Criar loja, Entrar, Minha conta), ações (tema, painel, sair)
 * e nav-mobile (hambúrguer).
 *
 * Também: store-card, feed-product-card, cart-drawer e checkout com pagamentos por loja.
 */
import { APP_NAME, faviconHref, profileIconHref, getStoreThemeColor, storeThemeButtonStyle, storeThemeOnColor } from './config.js'
import { t, deliveryPeriodLabel } from './strings.js'
import { escapeHtml, formatCurrency, formatPhone } from './utils.js'
import { isCatalogItemAvailable, getCatalogItemIcon, getCatalogItemLabel, isUsedProduct } from './catalog.js'
import { getPlanById, getStorePublicBanner } from './plans.js'
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
import { renderReportButton } from './reporting.js'
import { MERCHANT_PANEL, MERCHANT_MENU, isMerchantPath, getMerchantTab, merchantMenuHref } from './merchant-nav.js'
import { CUSTOMER_MENU, isCustomerAccountPath, getCustomerTab, customerMenuHref } from './customer-nav.js'

let menuOpen = false
let staffMenuOpen = false
let headerCartBound = false

function renderMenuToggleButton() {
  const label = menuOpen ? t('nav.closeMenu') : t('nav.openMenu')
  return `
    <button
      type="button"
      class="icon-btn menu-toggle${menuOpen ? ' menu-toggle--open' : ''}"
      id="menu-toggle"
      aria-expanded="${menuOpen}"
      aria-controls="nav-mobile"
      aria-label="${label}"
      title="${label}"
    >
      <span class="menu-toggle__icon" aria-hidden="true"><span></span><span></span><span></span></span>
    </button>`
}

function renderCartHeaderButton(cartCount) {
  const title = cartCount > 0
    ? t('nav.cartWithCount', { count: cartCount > 9 ? '9+' : cartCount })
    : t('nav.cart')
  return `
    <button
      type="button"
      class="icon-btn icon-btn--cart"
      id="header-cart-btn"
      title="${title}"
      aria-label="${title}"
    >
      <span class="icon-btn__glyph" aria-hidden="true">🛒</span>
      ${cartCount > 0 ? `<span class="icon-btn__badge">${cartCount > 9 ? '9+' : cartCount}</span>` : ''}
    </button>`
}

function renderProfileAvatar(className = 'profile-avatar') {
  return `<img class="${className}" src="${escapeHtml(profileIconHref())}" alt="" width="32" height="32" decoding="async" />`
}

function renderCustomerMobileNav(user, customerTab) {
  const firstName = escapeHtml(user.name?.split(' ')[0] ?? t('customer.defaultName'))
  return `
    <div class="nav-mobile__user">
      <span class="nav-mobile__avatar" aria-hidden="true">${renderProfileAvatar('profile-avatar profile-avatar--lg')}</span>
      <div class="nav-mobile__user-text">
        <strong>${firstName}</strong>
        <span>${escapeHtml(t('nav.customerMenuTitle'))}</span>
      </div>
    </div>
    ${CUSTOMER_MENU.map((item) => `
      <a
        href="${customerMenuHref(item)}"
        class="nav-mobile__link${customerTab === item.id ? ' active' : ''}"
      >
        <span class="nav-mobile__link-icon" aria-hidden="true">${item.icon}</span>
        <span>${item.label}</span>
      </a>
    `).join('')}
    <div class="nav-mobile__divider"></div>`
}

function bindHeaderNavClose(header) {
  header.querySelectorAll('.nav-mobile a, .nav-mobile button, .admin-toolbar__tab').forEach((el) => {
    el.addEventListener('click', () => {
      staffMenuOpen = false
      menuOpen = false
    })
  })
}

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
  const onLogin = currentPath === '/conta/entrar'
  const onRegisterStore = currentPath === '/lojista/cadastro'
  const showCreateStore = !user || user?.role === 'customer'
  const onCustomerAccount = user?.role === 'customer' && isCustomerAccountPath(currentPath)
  const customerTab = onCustomerAccount ? getCustomerTab(currentPath) : null
  const isCustomerPublic = user?.role === 'customer' && !onStaff && !onMerchant
  // Carrinho no site público: visitante + cliente (e admin/mod fora do painel).
  // Antes só cliente logado via — visitante não via o botão e achava que “não funciona”.
  const showCartButton = !onStaff && !onMerchant
  const cartCount = getCartItemCount()
  const themeIcon = getTheme() === 'dark' ? '☀️' : '🌙'

  header.innerHTML = `
    ${menuOpen ? `<button type="button" class="header__backdrop" id="header-backdrop" aria-label="${escapeHtml(t('nav.closeMenu'))}"></button>` : ''}
    <div class="header__inner">
      <a href="${routeHref('/')}" class="logo">
        <div class="logo__icon logo__icon--image">
          <img src="${escapeHtml(faviconHref())}" alt="" width="28" height="28" decoding="async" />
        </div>
        <span class="logo__text" aria-label="Maré de Vendas">
          <span class="logo__accent">Maré</span><span class="logo__mid"> de </span><span class="logo__vendas">Vendas</span>
        </span>
      </a>

      <nav class="nav-desktop">
        ${showCreateStore ? `<a href="${routeHref('/lojista/cadastro')}" class="nav-btn${onRegisterStore ? ' active' : ''}">
          <span class="nav-btn__icon" aria-hidden="true">🏪</span>
          <span>${t('nav.createStore')}</span>
        </a>` : ''}
        ${!user ? `<a href="${routeHref('/conta/entrar')}" class="nav-btn${onLogin ? ' active' : ''}">
          <span class="nav-btn__icon" aria-hidden="true">🔑</span>
          <span>${t('nav.login')}</span>
        </a>` : ''}
        ${user?.role === 'customer' ? `<a href="${customerMenuHref(CUSTOMER_MENU[0])}" class="nav-btn${onCustomerAccount ? ' active' : ''}">
          <span class="nav-btn__icon nav-btn__icon--avatar" aria-hidden="true">${renderProfileAvatar()}</span>
          <span>${t('nav.customerMenuTitle')}</span>
        </a>` : ''}
      </nav>

      <div class="header__actions">
        ${showCartButton ? renderCartHeaderButton(cartCount) : ''}
        <button type="button" class="icon-btn header__action--desktop" id="theme-toggle" title="${t('nav.toggleTheme')}" aria-label="${t('nav.toggleTheme')}">${themeIcon}</button>

        ${user?.role === 'customer' ? `<a href="${customerMenuHref(CUSTOMER_MENU[0])}" class="icon-btn icon-btn--avatar header__action--desktop" title="${t('nav.myAccount')}" aria-label="${t('nav.myAccount')}">${renderProfileAvatar()}</a>` : ''}
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
        ${user ? `<button type="button" class="icon-btn header__action--desktop" id="logout-btn" title="${t('nav.logout')}" aria-label="${t('nav.logout')}">🚪</button>` : ''}

        ${renderMenuToggleButton()}
      </div>
    </div>

    <nav class="nav-mobile ${menuOpen ? 'open' : ''}" id="nav-mobile">
      ${!user || showCreateStore ? `
        <div class="nav-mobile__actions">
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
      ${user?.role === 'customer' ? renderCustomerMobileNav(user, customerTab ?? 'overview') : ''}
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
      <div class="nav-mobile__footer">
        <button type="button" class="nav-mobile__utility" id="theme-toggle-mobile">
          <span class="nav-mobile__link-icon" aria-hidden="true">${themeIcon}</span>
          <span>${t('nav.toggleTheme')}</span>
        </button>
        ${user ? `<button type="button" class="nav-mobile__utility nav-mobile__utility--danger" id="logout-mobile">
          <span class="nav-mobile__link-icon" aria-hidden="true">🚪</span>
          <span>${t('nav.logout')}</span>
        </button>` : ''}
      </div>
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
    ${onCustomerAccount ? `
      <div class="admin-toolbar customer-toolbar">
        <div class="admin-toolbar__inner">
          <div class="admin-toolbar__tabs">
            ${CUSTOMER_MENU.map((item) => `
              <a
                href="${customerMenuHref(item)}"
                class="admin-toolbar__tab ${customerTab === item.id ? 'active' : ''}"
                title="${escapeHtml(item.label)}"
              >
                <span class="admin-toolbar__tab-icon" aria-hidden="true">${item.icon}</span>
                <span class="admin-toolbar__tab-label">${item.label}</span>
              </a>
            `).join('')}
          </div>
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
              <a href="${merchantMenuHref(item)}" class="admin-toolbar__tab ${merchantTab === item.id ? 'active' : ''}" title="${escapeHtml(item.label)}">
                <span class="admin-toolbar__tab-icon" aria-hidden="true">${item.icon}</span>
                <span class="admin-toolbar__tab-label">${item.label}</span>
                ${pending > 0 ? `<span class="admin-toolbar__badge">${pending}</span>` : ''}
              </a>`
            }).join('')}
          </div>
          <button type="button" class="btn btn-outline btn-sm admin-toolbar__refresh" id="merchant-refresh" title="${t('common.refreshDataTitle')}" aria-label="${t('common.refreshDataTitle')}">
            <span class="admin-toolbar__refresh-icon" aria-hidden="true">↻</span>
            <span class="admin-toolbar__refresh-label">${t('nav.refresh').replace(/^↻\s*/, '')}</span>
          </button>
        </div>
      </div>
    ` : ''}
  `

  header.classList.toggle('header--admin', onStaff || onMerchant || onCustomerAccount)
  header.classList.toggle('header--customer', isCustomerPublic)
  header.classList.toggle('header--customer-account', onCustomerAccount)
  header.classList.toggle('header--menu-open', menuOpen)
  document.body.classList.toggle('body--menu-open', menuOpen)
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

  bindHeaderNavClose(header)
  header.querySelectorAll('.admin-menu__item').forEach((link) => {
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

  const handleThemeToggle = () => {
    toggleTheme()
    renderHeader()
  }

  document.getElementById('theme-toggle')?.addEventListener('click', handleThemeToggle)
  document.getElementById('theme-toggle-mobile')?.addEventListener('click', handleThemeToggle)

  document.getElementById('header-cart-btn')?.addEventListener('click', () => {
    menuOpen = false
    openCart()
    renderHeader()
  })

  document.getElementById('header-backdrop')?.addEventListener('click', () => {
    menuOpen = false
    renderHeader()
  })

  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    staffMenuOpen = false
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

/** Fecha menu hambúrguer e dropdowns staff; usado ao rolar (`header-scroll.js`). */
export function closeMobileMenu() {
  if (!menuOpen && !staffMenuOpen) return
  menuOpen = false
  staffMenuOpen = false
  renderHeader()
}

export function initHeader() {
  renderHeader()
  onAuthChange(() => renderHeader())
  if (!headerCartBound) {
    onCartChange(() => renderHeader())
    headerCartBound = true
  }
}

function formatEngagementCount(count) {
  const safe = Math.max(0, Number(count) || 0)
  return new Intl.NumberFormat('pt-BR').format(safe)
}

function engagementStatLabel(mode, type, count) {
  const isOne = count === 1
  if (mode === 'store') {
    if (type === 'favorites') {
      return isOne ? t('engagement.storeFavoriteOne') : t('engagement.storeFavorites')
    }
    return isOne ? t('engagement.storeLikeOne') : t('engagement.storeLikes')
  }
  if (type === 'favorites') {
    return isOne ? t('engagement.customerFavoriteOne') : t('engagement.customerFavorites')
  }
  return isOne ? t('engagement.customerLikeOne') : t('engagement.customerLikes')
}

function renderEngagementStatItem({ icon, count, label, type }) {
  const isEmpty = count <= 0
  return `
    <div class="profile-stats__item ${isEmpty ? 'profile-stats__item--empty' : ''}" data-stat="${type}">
      <span class="profile-stats__icon" aria-hidden="true">${icon}</span>
      <div class="profile-stats__copy">
        <span class="profile-stats__value">${formatEngagementCount(count)}</span>
        <span class="profile-stats__label">${escapeHtml(label)}</span>
      </div>
    </div>`
}

/** Favoritos + curtidas em produtos (perfil da loja ou do cliente). */
export function renderEngagementStats({ favoritesCount = 0, likesCount = 0, mode = 'store' } = {}) {
  const favorites = Math.max(0, Number(favoritesCount) || 0)
  const likes = Math.max(0, Number(likesCount) || 0)
  const modifier = mode === 'store' ? 'profile-stats--store' : 'profile-stats--customer'

  return `
    <div class="profile-stats ${modifier}" aria-label="${escapeHtml(t('engagement.statsAria'))}">
      ${renderEngagementStatItem({
        icon: '❤️',
        count: favorites,
        label: engagementStatLabel(mode, 'favorites', favorites),
        type: 'favorites',
      })}
      ${renderEngagementStatItem({
        icon: '👍',
        count: likes,
        label: engagementStatLabel(mode, 'likes', likes),
        type: 'likes',
      })}
    </div>`
}

export function renderStoreCard(store, options = {}) {
  const { showPlanBadge = false, user = null } = options
  const theme = getStoreThemeColor(store.theme_color)
  const btnStyle = storeThemeButtonStyle(theme)
  const onColor = storeThemeOnColor(theme.hex)
  const bannerStyle = `background: linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`
  const publicBanner = getStorePublicBanner(store)
  const plan = getPlanById(store.plan_id)
  const planBadge = showPlanBadge && store.plan_id && store.plan_id !== 'free'
    ? `<span class="store-card__plan-badge store-card__plan-badge--${escapeHtml(store.plan_id)}">${escapeHtml(plan.name)}</span>`
    : ''

  return `
    <article class="store-card">
      <div class="store-card__banner">
        ${planBadge}
        ${publicBanner
          ? `<img class="store-card__banner-img" src="${escapeHtml(publicBanner)}" alt="" loading="lazy" />`
          : `<div class="store-card__banner-fill" style="${bannerStyle}"></div>`}
        ${store.logo
          ? `<img class="store-card__logo" src="${escapeHtml(store.logo)}" alt="${escapeHtml(store.name)}" />`
          : `<div class="store-card__logo-placeholder" style="background:${theme.hex};color:${onColor}">🏪</div>`}
      </div>
      <div class="store-card__body">
        <h3 class="store-card__title">${escapeHtml(store.name)}</h3>
        ${store.category ? `<span class="store-card__category" style="${btnStyle}">${escapeHtml(store.category.name)}</span>` : ''}
        <div class="store-card__meta">
          <span>📍 ${escapeHtml(store.city)}, ${escapeHtml(store.state)}</span>
          ${store.opening_hours ? `<span>🕐 ${escapeHtml(store.opening_hours)}</span>` : ''}
        </div>
        <div class="store-card__actions">
          <a href="#/loja/${escapeHtml(store.slug)}" class="btn btn-block" style="${btnStyle}">
            ${t('home.viewStoreCta')}
          </a>
          ${renderReportButton({ type: 'store', id: store.id, name: store.name, user, store, variant: 'link' })}
        </div>
      </div>
    </article>
  `
}

/** Anúncio patrocinado no feed da home. */
export function renderFeedAdCard(ad) {
  const store = ad.store
  const theme = getStoreThemeColor(store?.theme_color)
  const btnStyle = storeThemeButtonStyle(theme)
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
          <a href="#/loja/${escapeHtml(store?.slug ?? '')}" class="btn btn-sm" style="${btnStyle}">${t('home.viewStore')}</a>
        </div>
      </div>
    </article>
  `
}

function renderUsedProductTag(product, className = 'product-tag product-tag--used') {
  if (!isUsedProduct(product)) return ''
  return `<span class="${className}">${t('catalog.used')}</span>`
}

/** Card horizontal de produto no feed da home. */
export function renderFeedProductCard(product, options = {}) {
  const { badge = 'new', user = null, storeOwnerId = null } = options
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
  const btnStyle = storeThemeButtonStyle(store?.theme_color)

  return `
    <article class="feed-product-card ${oos ? 'out-of-stock' : ''}">
      <div class="feed-product-card__badge ${badgeClass}">${badgeLabel}</div>
      <div class="feed-product-card__inner">
        <div class="feed-product-card__media">
          <a href="#/loja/${escapeHtml(store?.slug ?? '')}" class="feed-product-card__media-link">
            ${product.image
              ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />`
              : `<div class="feed-product-card__placeholder">${getCatalogItemIcon(product)}</div>`}
            ${renderUsedProductTag(product, 'feed-product-card__used-tag')}
            ${oos ? `<span class="product-card__oos">${t('store.unavailable')}</span>` : ''}
          </a>
          ${renderReportButton({
            type: 'product',
            id: product.id,
            name: product.name,
            user,
            storeOwnerId,
            product,
            variant: 'overlay',
          })}
        </div>
        <div class="feed-product-card__body">
          <a href="#/loja/${escapeHtml(store?.slug ?? '')}" class="feed-product-card__name">${escapeHtml(product.name)}</a>
          ${store ? `<p class="feed-product-card__store">🏪 ${escapeHtml(store.name)}</p>` : ''}
          ${product.description ? `<p class="feed-product-card__desc">${escapeHtml(product.description)}</p>` : ''}
          <div class="feed-product-card__footer">
            <div class="feed-product-card__meta">
              <span class="feed-product-card__price">${formatCurrency(product.price)}</span>
              ${likesCount > 0 ? `<span class="feed-product-card__likes">❤️ ${likesCount}</span>` : ''}
            </div>
            <div class="feed-product-card__actions">
              <button type="button" class="btn btn-sm" style="${btnStyle}" data-feed-add-product="${product.id}" ${oos ? 'disabled' : ''}>
                ${t('home.addToCartShort')}
              </button>
            </div>
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
    canDeleteComments = false,
    canAdjustLikes = false,
    storeOwnerId = null,
    themeColor = null,
  } = options
  const oos = !isCatalogItemAvailable(product)
  const likesCount = product.likes_count ?? 0
  const commentsCount = product.comments_count ?? 0
  const typeLabel = getCatalogItemLabel(product)
  const liked = Boolean(product.liked_by_user)
  const canEngage = Boolean(user)
  const btnStyle = storeThemeButtonStyle(themeColor ?? product.store?.theme_color)

  return `
    <article class="product-card ${oos ? 'out-of-stock' : ''}" data-product-id="${product.id}">
      <div class="product-card__img">
        ${product.image
          ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />`
          : `<div class="product-card__placeholder">${getCatalogItemIcon(product)}</div>`}
        ${oos ? `<span class="product-card__oos">${t('store.unavailable')}</span>` : ''}
        <span class="product-card__type">${escapeHtml(typeLabel)}</span>
        ${renderUsedProductTag(product)}
        ${renderReportButton({
          type: 'product',
          id: product.id,
          name: product.name,
          user,
          storeOwnerId,
          product,
          variant: 'overlay',
        })}
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
          ${canAdjustLikes ? `
            <div class="product-card__engagement-admin" title="${t('admin.adjustLikesHint')}">
              <button type="button" class="engagement-btn engagement-btn--ghost" data-admin-like-dec="${product.id}" aria-label="${t('admin.decreaseLikes')}">−</button>
              <button type="button" class="engagement-btn engagement-btn--ghost" data-admin-like-inc="${product.id}" aria-label="${t('admin.increaseLikes')}">+</button>
            </div>
          ` : ''}
        </div>
        ${commentsOpen ? `
          <div class="product-comments" data-comments-panel="${product.id}">
            ${commentsLoading
              ? `<p class="product-comments__status">${t('common.loadingComments')}</p>`
              : comments.length === 0
                ? `<p class="product-comments__status">${t('store.noCommentsYet')}</p>`
                : comments.map((comment) => `
                    <div class="product-comment" data-comment-id="${comment.id}">
                      <div class="product-comment__meta">
                        <strong>${escapeHtml(comment.user?.name ?? t('common.defaultUser'))}</strong>
                        <div class="product-comment__meta-end">
                          <span>${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(comment.created_at))}</span>
                          ${canDeleteComments ? `
                            <button
                              type="button"
                              class="product-comment__delete"
                              data-delete-comment="${comment.id}"
                              aria-label="${t('store.deleteComment')}"
                            >${t('common.delete')}</button>
                          ` : ''}
                        </div>
                      </div>
                      <p>${escapeHtml(comment.content)}</p>
                    </div>
                  `).join('')}
            ${canEngage ? `
              <form class="product-comment-form" data-comment-form="${product.id}">
                <textarea class="form-input" name="content" rows="2" maxlength="500" placeholder="${t('store.commentPlaceholder')}" required></textarea>
                <button type="submit" class="btn btn-sm" style="${btnStyle}">${t('store.submitComment')}</button>
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
          <div class="product-card__footer-actions">
            <button type="button" class="btn btn-sm" style="${btnStyle}" data-add-product="${product.id}" ${oos ? 'disabled' : ''}>${t('store.addProduct')}</button>
          </div>
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
  if (!cart.storeId) return
  if (!String(cart.storeWhatsapp || '').trim()) {
    showToast(t('checkout.storeNoWhatsapp'))
    return
  }

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