/**
 * Dashboard do cliente — favoritos, curtidos, pedidos e perfil.
 */
import {
  fetchFavorites,
  fetchLikedProductsByUser,
  fetchUserEngagementStats,
  fetchOrdersByCustomer,
  updateCustomerProfile,
  updatePassword,
} from '../api.js'
import { getUser, setUser, getCart, getCartItemCount, setStore, addItem, openCart } from '../state.js'
import { renderStoreCard, renderFeedProductCard, renderEngagementStats } from '../ui.js'
import { escapeHtml, formatCurrency, formatDate, showToast } from '../utils.js'
import { routeHref, navigate } from '../router.js'
import { getCustomerTab } from '../customer-nav.js'
import { normalizeStorePaymentMethods, getPaymentMethodLabel } from '../payment.js'
import { t, deliveryPeriodLabel, orderStatusLabel } from '../strings.js'
import { bindPasswordToggles } from '../password-field.js'
import { bindReportTriggers, getReportLoginPath } from '../reporting.js'

const DELIVERY_LABELS = {
  manha: deliveryPeriodLabel('manha'),
  tarde: deliveryPeriodLabel('tarde'),
  noite: deliveryPeriodLabel('noite'),
  madrugada: deliveryPeriodLabel('madrugada'),
}

const TABS = [
  { id: 'overview', label: t('nav.customerOverview'), icon: '🏠' },
  { id: 'favorites', label: t('nav.customerFavorites'), icon: '❤️' },
  { id: 'liked', label: t('nav.customerLiked'), icon: '👍' },
  { id: 'orders', label: t('nav.customerOrders'), icon: '📦' },
  { id: 'profile', label: t('nav.customerProfile'), icon: '👤' },
]

function renderRegisterStoreCallout() {
  return `
    <section class="customer-register-store" aria-label="${escapeHtml(t('auth.registerMyStore'))}">
      <div class="customer-register-store__content">
        <span class="customer-register-store__icon" aria-hidden="true">🏪</span>
        <div class="customer-register-store__text">
          <h2 class="customer-register-store__title">${escapeHtml(t('customer.registerStoreTitle'))}</h2>
          <p class="customer-register-store__desc">${escapeHtml(t('customer.registerStoreDesc'))}</p>
        </div>
      </div>
      <a href="${routeHref('/lojista/cadastro')}" class="btn btn-primary">${escapeHtml(t('auth.registerMyStore'))}</a>
    </section>`
}

function customerPage(title, subtitle, content) {
  return `
    <div class="admin-page customer-page">
      <div class="admin-page__head">
        <div class="admin-page__head-main">
          <p class="admin-page__eyebrow">${t('customer.myAccountTitle')}</p>
          <h1 class="admin-page__title">${escapeHtml(title)}</h1>
          ${subtitle ? `<p class="admin-page__subtitle">${escapeHtml(subtitle)}</p>` : ''}
        </div>
      </div>
      <div class="admin-page__body admin-fade-in">${content}</div>
    </div>
  `
}

function customerEmpty(icon, title, text, actionHtml = '') {
  return `
    <div class="admin-empty">
      <span class="admin-empty__icon">${icon}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${text}</p>
      ${actionHtml}
    </div>`
}

function orderStatusBadge(status) {
  const map = {
    pending: 'badge-order-pending',
    sent: 'badge-order-sent',
    viewed: 'badge-order-viewed',
  }
  const label = orderStatusLabel(status)
  return `<span class="badge ${map[status] ?? ''}">${escapeHtml(label)}</span>`
}

function renderOrderCard(order) {
  const items = (order.items ?? [])
    .map((item) => `${item.quantity}x ${item.product?.name ?? 'Item'}`)
    .join(', ')
  const payment = order.payment_method ? getPaymentMethodLabel(order.payment_method) : null

  return `
    <article class="customer-order-card">
      <div class="customer-order-card__head">
        <div>
          <h3 class="customer-order-card__store">
            <a href="#/loja/${escapeHtml(order.store?.slug ?? '')}">${escapeHtml(order.store?.name ?? t('common.defaultStore'))}</a>
          </h3>
          <p class="customer-order-card__meta">${formatDate(order.created_at)}${order.store?.city ? ` · ${escapeHtml(order.store.city)}` : ''}</p>
        </div>
        <div class="customer-order-card__aside">
          ${orderStatusBadge(order.status)}
          <strong class="customer-order-card__total">${formatCurrency(order.total)}</strong>
        </div>
      </div>
      ${items ? `<p class="customer-order-card__items">${escapeHtml(items)}</p>` : ''}
      ${payment ? `<p class="customer-order-card__payment">${t('customer.paymentLabel')} ${escapeHtml(payment)}</p>` : ''}
    </article>
  `
}

function renderMetrics({ favorites, liked, orders, cartCount }) {
  return `
    <div class="metrics admin-metrics customer-metrics">
      <button type="button" class="metric-card metric-card--link" data-customer-tab="favorites">
        <div class="metric-card__value">${favorites}</div>
        <div class="metric-card__label">${t('customer.metricFavoriteStores')}</div>
      </button>
      <button type="button" class="metric-card metric-card--link" data-customer-tab="liked">
        <div class="metric-card__value">${liked}</div>
        <div class="metric-card__label">${t('customer.metricLikedProducts')}</div>
      </button>
      <button type="button" class="metric-card metric-card--link" data-customer-tab="orders">
        <div class="metric-card__value">${orders}</div>
        <div class="metric-card__label">${t('customer.metricOrders')}</div>
      </button>
      ${cartCount > 0 ? `
        <div class="metric-card metric-card--alert">
          <div class="metric-card__value">${cartCount}</div>
          <div class="metric-card__label">${t('customer.metricCartItems')}</div>
        </div>
      ` : ''}
    </div>
  `
}

function renderOverview({ user, favorites, likedProducts, orders, cart, engagementStats }) {
  const cartCount = getCartItemCount()
  const previewStores = favorites.slice(0, 2)
  const previewLiked = likedProducts.slice(0, 2)

  return `
    ${renderMetrics({
      favorites: engagementStats?.favoritesCount ?? favorites.length,
      liked: engagementStats?.likesCount ?? likedProducts.length,
      orders: orders.length,
      cartCount,
    })}
    <div class="admin-quick-actions">
      <a href="${routeHref('/')}" class="admin-quick-card">
        <span class="admin-quick-card__icon">🔍</span>
        <strong>${t('customer.exploreStores')}</strong>
        <span>${t('customer.exploreStoresDesc')}</span>
      </a>
      <button type="button" class="admin-quick-card" data-customer-tab="favorites">
        <span class="admin-quick-card__icon">❤️</span>
        <strong>${t('customer.viewFavorites')}</strong>
        <span>${favorites.length ? t('customer.savedStoresCount', { count: favorites.length }) : t('customer.savedStoresHint')}</span>
      </button>
      ${cartCount > 0 ? `
        <button type="button" class="admin-quick-card" data-open-cart>
          <span class="admin-quick-card__icon">🛒</span>
          <strong>${t('customer.openCart')}</strong>
          <span>${t('customer.cartItemsHint', { count: cartCount, store: cart.storeName ?? t('common.defaultStore') })}</span>
        </button>
      ` : ''}
    </div>
    ${previewStores.length ? `
      <section class="admin-section">
        <div class="admin-section__head">
          <h2>${t('customer.recentFavorites')}</h2>
          ${favorites.length > 2 ? `<button type="button" class="btn btn-ghost btn-sm" data-customer-tab="favorites">${t('customer.viewAllFeminine')}</button>` : ''}
        </div>
        <div class="feed customer-feed-preview">${previewStores.map((store) => renderStoreCard(store, { user })).join('')}</div>
      </section>
    ` : ''}
    ${previewLiked.length ? `
      <section class="admin-section">
        <div class="admin-section__head">
          <h2>${t('customer.likedProductsSection')}</h2>
          ${likedProducts.length > 2 ? `<button type="button" class="btn btn-ghost btn-sm" data-customer-tab="liked">${t('customer.viewAllMasculine')}</button>` : ''}
        </div>
        <div class="feed customer-feed-preview">${previewLiked.map((product) => renderFeedProductCard(product, {
          badge: 'liked',
          user,
          storeOwnerId: product?.store?.owner_id,
        })).join('')}</div>
      </section>
    ` : ''}
    ${!previewStores.length && !previewLiked.length ? customerEmpty(
      '✨',
      t('customer.greeting', { name: user.name?.split(' ')[0] ?? t('customer.defaultName') }),
      t('customer.emptyOverviewBody'),
      `<a href="${routeHref('/')}" class="btn btn-primary">${t('customer.goToHome')}</a>`,
    ) : ''}
  `
}

function renderFavoritesTab(stores, user) {
  if (!stores.length) {
    return customerEmpty(
      '❤️',
      t('customer.noFavoriteStoresTitle'),
      t('customer.noFavoriteStoresBody'),
      `<a href="${routeHref('/')}" class="btn btn-primary">${t('customer.exploreStores')}</a>`,
    )
  }
  return `<div class="feed">${stores.map((store) => renderStoreCard(store, { user })).join('')}</div>`
}

function renderLikedTab(products, user) {
  if (!products.length) {
    return customerEmpty(
      '👍',
      t('customer.noLikedProductsTitle'),
      t('customer.noLikedProductsBody'),
      `<a href="${routeHref('/')}" class="btn btn-primary">${t('customer.viewProducts')}</a>`,
    )
  }
  return `<div class="feed">${products.map((product) => renderFeedProductCard(product, {
    badge: 'liked',
    user,
    storeOwnerId: product?.store?.owner_id,
  })).join('')}</div>`
}

function renderOrdersTab(orders) {
  if (!orders.length) {
    return customerEmpty(
      '📦',
      t('customer.noOrdersTitle'),
      t('customer.noOrdersBody'),
      `<a href="${routeHref('/')}" class="btn btn-primary">${t('customer.placeOrder')}</a>`,
    )
  }
  return `<div class="customer-orders-list">${orders.map(renderOrderCard).join('')}</div>`
}

function renderProfileTab(user, engagementStats) {
  const birthLabel = user.birth_date ? formatDate(user.birth_date) : '—'

  return `
    <div class="customer-profile">
      <section class="customer-profile__activity">
        <h2>${t('engagement.profileActivity')}</h2>
        ${renderEngagementStats({ ...engagementStats, mode: 'customer' })}
      </section>
      <form class="admin-form customer-profile__form" id="customer-profile-form">
        <div class="admin-form-grid">
          <label class="form-group">
            <span class="form-label">${t('labels.name')}</span>
            <input class="form-input" name="name" required value="${escapeHtml(user.name ?? '')}" />
          </label>
          <label class="form-group">
            <span class="form-label">${t('labels.phone')}</span>
            <input class="form-input" name="phone" required value="${escapeHtml(user.phone ?? '')}" />
          </label>
          <label class="form-group admin-form-grid__full">
            <span class="form-label">${t('labels.address')}</span>
            <input class="form-input" name="address" required value="${escapeHtml(user.address ?? '')}" />
          </label>
          <label class="form-group">
            <span class="form-label">${t('customer.deliveryPeriodPreferred')}</span>
            <select class="form-input" name="delivery_period" required>
              ${Object.entries(DELIVERY_LABELS).map(([value, label]) => `
                <option value="${value}" ${user.delivery_period === value ? 'selected' : ''}>${label}</option>
              `).join('')}
            </select>
          </label>
          <div class="form-group">
            <span class="form-label">${t('labels.email')}</span>
            <input class="form-input" value="${escapeHtml(user.email ?? '')}" disabled />
          </div>
          <div class="form-group">
            <span class="form-label">${t('labels.birthDate')}</span>
            <input class="form-input" value="${escapeHtml(birthLabel)}" disabled />
          </div>
        </div>
        <button type="submit" class="btn btn-primary" id="customer-profile-save">${t('customer.saveProfile')}</button>
      </form>

      <section class="customer-profile__password">
        <h2>${t('customer.changePasswordTitle')}</h2>
        <p class="form-hint">${t('customer.passwordHint')}</p>
        <form id="customer-password-form" class="admin-form">
          <div class="admin-form-grid">
            <label class="form-group admin-form-grid__full">
              <span class="form-label">${t('labels.newPassword')}</span>
              <input class="form-input" type="password" name="password" minlength="8" required autocomplete="new-password" />
            </label>
            <label class="form-group admin-form-grid__full">
              <span class="form-label">${t('labels.confirmNewPassword')}</span>
              <input class="form-input" type="password" name="password_confirm" minlength="8" required autocomplete="new-password" />
            </label>
          </div>
          <button type="submit" class="btn btn-secondary" id="customer-password-save">${t('customer.updatePassword')}</button>
        </form>
      </section>
    </div>
  `
}

export async function renderFavorites(main) {
  const user = getUser()
  if (!user || user.role !== 'customer') {
    main.innerHTML = `
      <div class="empty-state">
        <h2>${t('customer.loginRequiredTitle')}</h2>
        <p>${t('customer.loginRequiredBody')}</p>
        <a href="${routeHref('/conta/entrar?redirect=/favoritos')}" class="btn btn-primary">${t('nav.login')}</a>
      </div>
    `
    return
  }

  let activeTab = getCustomerTab()
  let favorites = []
  let likedProducts = []
  let orders = []
  let engagementStats = { favoritesCount: 0, likesCount: 0 }
  let productMap = new Map()
  let loading = true
  let profileSaving = false
  let passwordSaving = false

  async function load() {
    loading = true
    paint()

    try {
      ;[favorites, likedProducts, orders, engagementStats] = await Promise.all([
        fetchFavorites(user.id),
        fetchLikedProductsByUser(user.id),
        fetchOrdersByCustomer(user.id),
        fetchUserEngagementStats(user.id),
      ])
      productMap = new Map(likedProducts.map((product) => [product.id, product]))
    } catch (err) {
      showToast(err.message ?? t('customer.loadError'))
    } finally {
      loading = false
      paint()
    }
  }

  function bindProductCartEvents() {
    main.querySelectorAll('[data-feed-add-product]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const product = productMap.get(btn.dataset.feedAddProduct)
        if (!product?.store) return

        setStore(
          product.store.id,
          product.store.name,
          product.store.whatsapp,
          normalizeStorePaymentMethods(product.store.payment_methods),
        )
        addItem(product)
        openCart()
      })
    })
  }

  function switchTab(tab) {
    if (tab === activeTab) return
    navigate(tab === 'overview' ? '/favoritos' : `/favoritos?tab=${tab}`)
  }

  function renderTabContent() {
    if (loading) {
      return '<div class="loading"><div class="spinner"></div></div>'
    }

    switch (activeTab) {
      case 'favorites':
        return renderFavoritesTab(favorites, user)
      case 'liked':
        return renderLikedTab(likedProducts, user)
      case 'orders':
        return renderOrdersTab(orders)
      case 'profile':
        return renderProfileTab(user, engagementStats)
      default:
        return renderOverview({
          user,
          favorites,
          likedProducts,
          orders,
          cart: getCart(),
          engagementStats,
        })
    }
  }

  function paint() {
    const tabLabels = {
      overview: t('customer.tabOverview'),
      favorites: t('customer.tabFavorites'),
      liked: t('customer.tabLiked'),
      orders: t('customer.tabOrders'),
      profile: t('customer.tabProfile'),
    }

    main.innerHTML = customerPage(
      tabLabels[activeTab] ?? t('customer.myAccountTitle'),
      activeTab === 'overview'
        ? t('customer.greeting', { name: user.name?.split(' ')[0] ?? t('customer.defaultName') })
        : activeTab === 'profile'
          ? t('engagement.profileActivity')
          : '',
      `
        ${renderRegisterStoreCallout()}
        <nav class="customer-tabs tabs" aria-label="${t('customer.accountSectionsAria')}">
          ${TABS.map((tab) => `
            <button
              type="button"
              class="tab ${activeTab === tab.id ? 'active' : ''}"
              data-customer-tab="${tab.id}"
            >
              <span class="customer-tab__icon" aria-hidden="true">${tab.icon}</span>
              ${tab.label}
              ${tab.id === 'favorites' && favorites.length ? ` (${favorites.length})` : ''}
              ${tab.id === 'liked' && likedProducts.length ? ` (${likedProducts.length})` : ''}
              ${tab.id === 'orders' && orders.length ? ` (${orders.length})` : ''}
            </button>
          `).join('')}
        </nav>
        <div class="customer-tab-panel">${renderTabContent()}</div>
      `,
    )

    main.querySelectorAll('[data-customer-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.customerTab))
    })

    main.querySelector('[data-open-cart]')?.addEventListener('click', openCart)
    bindProductCartEvents()
    bindReportTriggers(main, {
      user,
      redirectPath: '/favoritos',
      onRequireAuth: () => {
        navigate(getReportLoginPath(user, '/favoritos'))
        showToast(t('report.loginRequired'))
      },
    })
    bindPasswordToggles(main)

    const profileForm = main.querySelector('#customer-profile-form')
    profileForm?.addEventListener('submit', async (e) => {
      e.preventDefault()
      if (profileSaving) return
      profileSaving = true
      const submitBtn = main.querySelector('#customer-profile-save')
      if (submitBtn) {
        submitBtn.disabled = true
        submitBtn.textContent = t('common.saving')
      }

      try {
        const form = e.target
        const updated = await updateCustomerProfile(user.id, {
          name: form.name.value,
          phone: form.phone.value,
          address: form.address.value,
          delivery_period: form.delivery_period.value,
        })
        Object.assign(user, updated)
        setUser({ ...user, ...updated })
        showToast(t('customer.profileUpdated'))
      } catch (err) {
        showToast(err.message ?? t('customer.saveProfileError'))
      } finally {
        profileSaving = false
        if (submitBtn) {
          submitBtn.disabled = false
          submitBtn.textContent = t('customer.saveProfile')
        }
      }
    })

    const passwordForm = main.querySelector('#customer-password-form')
    passwordForm?.addEventListener('submit', async (e) => {
      e.preventDefault()
      if (passwordSaving) return

      const form = e.target
      const password = form.password.value
      const confirm = form.password_confirm.value
      if (password !== confirm) {
        showToast(t('customer.passwordsMismatch'))
        return
      }

      passwordSaving = true
      const submitBtn = main.querySelector('#customer-password-save')
      if (submitBtn) {
        submitBtn.disabled = true
        submitBtn.textContent = t('common.saving')
      }

      try {
        await updatePassword(password)
        form.reset()
        showToast(t('customer.passwordUpdated'))
      } catch (err) {
        showToast(err.message ?? t('customer.updatePasswordError'))
      } finally {
        passwordSaving = false
        if (submitBtn) {
          submitBtn.disabled = false
          submitBtn.textContent = t('customer.updatePassword')
        }
      }
    })
  }

  paint()
  await load()
}