/**
 * Componentes de UI reutilizáveis (renderização imperativa).
 *
 * Gera HTML via template strings e reanexa event listeners a cada render.
 * Padrão "render + bind" — simples, sem framework.
 *
 * Componentes: header, store-card, product-card, cart-drawer, checkout.
 *
 * Melhorias futuras:
 * - Extrair partials HTML para funções menores (product-card é grande)
 * - Delegação de eventos no #main em vez de listeners por elemento
 * - Componentes acessíveis (ARIA, foco no drawer, trap de teclado)
 * - Indicador flutuante do carrinho no header
 */
import { APP_NAME } from './config.js'
import { getStoreThemeColor } from './config.js'
import { escapeHtml, formatCurrency, formatPhone } from './utils.js'
import {
  getUser, logout, onAuthChange, toggleTheme, getTheme, getAdminPendingCount,
  getMerchantNewOrdersCount,
  getCart, onCartChange, openCart, closeCart, removeItem, updateQuantity,
  getCartTotal, getCartItemCount, clearCart,
} from './state.js'
import { buildOrderMessage, buildWhatsAppUrl } from './whatsapp.js'
import { createOrder } from './api.js'
import { navigate, render as rerenderRoute, getCurrentPath, routeHref } from './router.js'
import { showToast } from './utils.js'
import { STAFF_PANELS, getStaffMenu, isStaffPath, getStaffPanel, getStaffTab } from './staff-nav.js'
import { MERCHANT_PANEL, MERCHANT_MENU, isMerchantPath, getMerchantTab, merchantMenuHref } from './merchant-nav.js'

let menuOpen = false
let staffMenuOpen = false

function renderStaffMenuItems(panel, activeTab, { compact = false } = {}) {
  return getStaffMenu(panel).map((item) => `
    <a href="${item.href}" class="admin-menu__item ${activeTab === item.id ? 'active' : ''} ${compact ? 'admin-menu__item--compact' : ''}">
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
        <a href="#/" class="admin-menu__item admin-menu__item--muted">← Voltar ao site</a>
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

  header.innerHTML = `
    <div class="header__inner">
      <a href="#/" class="logo">
        <div class="logo__icon">🏪</div>
        <span>${APP_NAME.replace('Vendas', '')}<span class="accent">Vendas</span></span>
      </a>

      <nav class="nav-desktop">
        <a href="#/">Lojas</a>
        <a href="#/lojista/entrar">Área do Lojista</a>
        <a href="#/regras">Regras</a>
      </nav>

      <div class="header__actions">
        <button type="button" class="icon-btn" id="theme-toggle" title="Alternar tema">${getTheme() === 'dark' ? '☀️' : '🌙'}</button>

        ${!user ? `<a href="#/conta/entrar" class="btn btn-primary btn-sm btn-login-mobile">Entrar</a>` : ''}
        ${user?.role === 'customer' ? `<a href="#/favoritos" class="icon-btn" title="Favoritos">❤️</a>` : ''}
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
              <a href="#/" class="admin-menu__item admin-menu__item--muted">← Voltar ao site</a>
            </div>
          </div>` : ''}
        ${user?.role === 'admin' ? renderStaffPanelDropdown(user, 'admin', staffTab) : ''}
        ${user?.role === 'moderator' ? renderStaffPanelDropdown(user, 'moderator', staffTab) : ''}
        ${user ? `<button type="button" class="icon-btn" id="logout-btn" title="Sair">🚪</button>` : `<a href="#/conta/entrar" class="icon-btn hidden md:flex" title="Entrar">❤️</a>`}

        <button type="button" class="icon-btn menu-toggle" id="menu-toggle" aria-expanded="${menuOpen}">${menuOpen ? '✕' : '☰'}</button>
      </div>
    </div>

    <nav class="nav-mobile ${menuOpen ? 'open' : ''}" id="nav-mobile">
      <a href="#/">Lojas</a>
      <a href="#/lojista/entrar">Área do Lojista</a>
      <a href="#/regras">Regras</a>
      ${user?.role === 'customer' ? '<a href="#/favoritos">❤️ Favoritos</a>' : ''}
      ${user?.role === 'merchant' ? `
        <p class="nav-mobile__section">Painel do Lojista</p>
        ${MERCHANT_MENU.map((item) => {
          const badge = item.id === 'orders' && getMerchantNewOrdersCount() > 0
            ? ` (${getMerchantNewOrdersCount()})` : ''
          return `<a href="${merchantMenuHref(item)}" class="${merchantTab === item.id ? 'active' : ''}">${item.icon} ${item.label}${badge}</a>`
        }).join('')}
        <a href="#/">← Voltar ao site</a>
      ` : ''}
      ${user?.role === 'admin' ? `
        <p class="nav-mobile__section">Painel Admin</p>
        ${renderStaffMenuItems('admin', staffTab, { compact: true })}
        <a href="#/">← Voltar ao site</a>
      ` : ''}
      ${user?.role === 'moderator' ? `
        <p class="nav-mobile__section">Painel Moderador</p>
        ${renderStaffMenuItems('moderator', staffTab, { compact: true })}
        <a href="#/">← Voltar ao site</a>
      ` : ''}
      ${user ? '<button type="button" id="logout-mobile">🚪 Sair</button>' : '<a href="#/conta/entrar">🔑 Entrar</a>'}
    </nav>

    ${onStaff ? `
      <div class="admin-toolbar">
        <div class="admin-toolbar__inner">
          <div class="admin-toolbar__tabs">
            ${getStaffMenu(staffPanel).map((item) => {
              const pending = item.id === 'approvals' ? getAdminPendingCount() : 0
              return `
              <a href="${item.href}" class="admin-toolbar__tab ${staffTab === item.id ? 'active' : ''}">
                <span>${item.icon}</span> ${item.label}
                ${pending > 0 ? `<span class="admin-toolbar__badge">${pending}</span>` : ''}
              </a>`
            }).join('')}
          </div>
          <button type="button" class="btn btn-outline btn-sm" id="admin-refresh" title="Atualizar dados">↻ Atualizar</button>
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
          <button type="button" class="btn btn-outline btn-sm" id="merchant-refresh" title="Atualizar dados">↻ Atualizar</button>
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
    showToast('Painel atualizado')
  })

  document.getElementById('merchant-refresh')?.addEventListener('click', () => {
    rerenderRoute()
    showToast('Painel atualizado')
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

export function renderStoreCard(store) {
  const theme = getStoreThemeColor(store.theme_color)
  const bannerStyle = `background: linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`

  return `
    <article class="store-card">
      <div class="store-card__banner">
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
          Ver loja e pedir pelo WhatsApp
        </a>
      </div>
    </article>
  `
}

/** Card horizontal de produto no feed da home. */
export function renderFeedProductCard(product, options = {}) {
  const { badge = 'new' } = options
  const oos = product.stock <= 0
  const likesCount = product.likes_count ?? 0
  const badgeLabel = badge === 'liked' ? 'Mais curtido' : 'Novo produto'
  const badgeClass = badge === 'liked' ? 'feed-product-card__badge--liked' : 'feed-product-card__badge--new'
  const store = product.store

  return `
    <article class="feed-product-card ${oos ? 'out-of-stock' : ''}">
      <div class="feed-product-card__badge ${badgeClass}">${badgeLabel}</div>
      <div class="feed-product-card__inner">
        <a href="#/loja/${escapeHtml(store?.slug ?? '')}" class="feed-product-card__media">
          ${product.image
            ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />`
            : '<div class="feed-product-card__placeholder">📦</div>'}
          ${oos ? '<span class="product-card__oos">Indisponível</span>' : ''}
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
              + Carrinho
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
  const oos = product.stock <= 0
  const likesCount = product.likes_count ?? 0
  const commentsCount = product.comments_count ?? 0
  const liked = Boolean(product.liked_by_user)
  const canEngage = Boolean(user)

  return `
    <article class="product-card ${oos ? 'out-of-stock' : ''}" data-product-id="${product.id}">
      <div class="product-card__img">
        ${product.image
          ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />`
          : '<div class="product-card__placeholder">📦</div>'}
        ${oos ? '<span class="product-card__oos">Indisponível</span>' : ''}
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
            <span class="engagement-btn engagement-btn--readonly" title="Entre para curtir">🤍 ${likesCount}</span>
            <button type="button" class="engagement-btn engagement-btn--ghost" data-toggle-comments="${product.id}" aria-expanded="${commentsOpen}">
              💬 ${commentsCount}
            </button>
          `}
        </div>
        ${commentsOpen ? `
          <div class="product-comments" data-comments-panel="${product.id}">
            ${commentsLoading
              ? '<p class="product-comments__status">Carregando comentários...</p>'
              : comments.length === 0
                ? '<p class="product-comments__status">Nenhum comentário ainda.</p>'
                : comments.map((comment) => `
                    <div class="product-comment">
                      <div class="product-comment__meta">
                        <strong>${escapeHtml(comment.user?.name ?? 'Usuário')}</strong>
                        <span>${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(comment.created_at))}</span>
                      </div>
                      <p>${escapeHtml(comment.content)}</p>
                    </div>
                  `).join('')}
            ${canEngage ? `
              <form class="product-comment-form" data-comment-form="${product.id}">
                <textarea class="form-input" name="content" rows="2" maxlength="500" placeholder="Escreva um comentário..." required></textarea>
                <button type="submit" class="btn btn-primary btn-sm">Comentar</button>
              </form>
            ` : `
              <p class="product-comments__login-hint">
                <a href="#/conta/entrar">Entre</a> ou <a href="#/conta/criar">crie uma conta</a> para comentar.
              </p>
            `}
          </div>
        ` : ''}
        <div class="product-card__footer">
          <span class="product-card__price">${formatCurrency(product.price)}</span>
          <button type="button" class="btn btn-primary btn-sm" data-add-product="${product.id}" ${oos ? 'disabled' : ''}>+ Adicionar</button>
        </div>
      </div>
    </article>
  `
}

export function renderCartDrawer() {
  const root = document.getElementById('cart-root')
  if (!root) return

  const cart = getCart()
  if (!cart.isOpen) {
    root.innerHTML = ''
    return
  }

  const total = getCartTotal()
  const count = getCartItemCount()

  root.innerHTML = `
    <div class="cart-overlay" id="cart-overlay"></div>
    <aside class="cart-drawer">
      <div class="cart-drawer__header">
        <div style="display:flex;align-items:center;gap:0.5rem">
          <span>🛒</span>
          <strong>Carrinho</strong>
          ${count > 0 ? `<span style="background:var(--primary-100);color:var(--primary-600);padding:0.125rem 0.5rem;border-radius:999px;font-size:0.75rem">${count}</span>` : ''}
        </div>
        <button type="button" class="icon-btn" id="cart-close">✕</button>
      </div>

      ${cart.items.length === 0 ? `
        <div class="cart-empty">
          <div style="font-size:3rem;margin-bottom:1rem">🛒</div>
          <p>Seu carrinho está vazio</p>
          <p style="font-size:0.875rem;color:var(--text-muted);margin-top:0.25rem">Adicione produtos para continuar</p>
        </div>
      ` : `
        <ul class="cart-drawer__items" id="cart-items">
          ${cart.items.map((item) => `
            <li class="cart-item">
              ${item.product.image
                ? `<img class="cart-item__img" src="${escapeHtml(item.product.image)}" alt="" />`
                : '<div class="cart-item__img" style="display:grid;place-items:center">📦</div>'}
              <div class="cart-item__body">
                <div style="display:flex;justify-content:space-between;gap:0.5rem">
                  <span class="cart-item__name">${escapeHtml(item.product.name)}</span>
                  <button type="button" class="icon-btn" data-remove="${item.product.id}" style="width:1.5rem;height:1.5rem">🗑</button>
                </div>
                <span class="cart-item__price">${formatCurrency(item.product.price)}</span>
                <div class="qty-controls">
                  <button type="button" data-qty-minus="${item.product.id}">−</button>
                  <span>${item.quantity}</span>
                  <button type="button" data-qty-plus="${item.product.id}">+</button>
                </div>
              </div>
            </li>
          `).join('')}
        </ul>
        <div class="cart-drawer__footer">
          <div class="cart-total">
            <span>Total</span>
            <span class="cart-total__value">${formatCurrency(total)}</span>
          </div>
          <div id="checkout-area">
            <button type="button" class="btn btn-green btn-block" id="checkout-start">Finalizar Pedido</button>
          </div>
        </div>
      `}
    </aside>
  `

  document.getElementById('cart-overlay')?.addEventListener('click', closeCart)
  document.getElementById('cart-close')?.addEventListener('click', closeCart)

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
}

function showCheckoutForm() {
  const area = document.getElementById('checkout-area')
  const user = getUser()
  const defaults = user?.role === 'customer'
    ? { name: user.name ?? '', phone: user.phone ?? '', address: user.address ?? '' }
    : { name: '', phone: '', address: '' }

  area.innerHTML = `
    <form id="checkout-form">
      <div class="form-group">
        <input class="form-input" name="name" placeholder="Seu nome" required value="${escapeHtml(defaults.name)}" />
      </div>
      <div class="form-group">
        <input class="form-input" name="phone" placeholder="Telefone" required value="${escapeHtml(defaults.phone)}" />
      </div>
      <div class="form-group">
        <textarea class="form-input" name="address" placeholder="Endereço de entrega" rows="2" required>${escapeHtml(defaults.address)}</textarea>
      </div>
      <div style="display:flex;gap:0.5rem">
        <button type="button" class="btn btn-outline" style="flex:1" id="checkout-back">Voltar</button>
        <button type="submit" class="btn btn-green" style="flex:1" id="checkout-submit">Enviar via WhatsApp</button>
      </div>
    </form>
  `

  document.getElementById('checkout-back')?.addEventListener('click', () => {
    area.innerHTML = '<button type="button" class="btn btn-green btn-block" id="checkout-start">Finalizar Pedido</button>'
    document.getElementById('checkout-start')?.addEventListener('click', showCheckoutForm)
  })

  document.getElementById('checkout-form')?.addEventListener('submit', handleCheckout)
}

async function handleCheckout(e) {
  e.preventDefault()
  const cart = getCart()
  if (!cart.storeId || !cart.storeWhatsapp) return

  const form = e.target
  const name = form.name.value.trim()
  const phone = form.phone.value.trim()
  const address = form.address.value.trim()
  const total = getCartTotal()
  const user = getUser()

  const deliveryLabels = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', madrugada: 'Madrugada' }
  const deliveryPeriod = user?.delivery_period ? deliveryLabels[user.delivery_period] : undefined

  const message = buildOrderMessage({
    items: cart.items,
    total,
    customerName: name,
    customerPhone: phone,
    customerAddress: address,
    deliveryPeriod,
  })

  const submitBtn = document.getElementById('checkout-submit')
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Enviando...' }

  try {
    await createOrder(cart.storeId, {
      customerName: name,
      customerPhone: phone,
      customerAddress: address,
    }, cart.items)
  } catch (err) {
    console.error('Erro ao salvar pedido:', err)
  }

  window.open(buildWhatsAppUrl(cart.storeWhatsapp, message), '_blank')
  clearCart()
  closeCart()
  showToast('Pedido enviado! Confirme no WhatsApp.')
}

export function initCart() {
  onCartChange(renderCartDrawer)
  renderCartDrawer()
}

export { openCart, closeCart, formatPhone }