import { APP_NAME } from './config.js'
import { getStoreThemeColor } from './config.js'
import { escapeHtml, formatCurrency, formatPhone } from './utils.js'
import {
  getUser, logout, onAuthChange, toggleTheme, getTheme,
  getCart, onCartChange, openCart, closeCart, removeItem, updateQuantity,
  getCartTotal, getCartItemCount, clearCart,
} from './state.js'
import { buildOrderMessage, buildWhatsAppUrl } from './whatsapp.js'
import { createOrder } from './api.js'
import { navigate } from './router.js'
import { showToast } from './utils.js'

let menuOpen = false

export function renderHeader() {
  const header = document.getElementById('header')
  if (!header) return

  const user = getUser()

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
        ${user?.role === 'merchant' ? `<a href="#/dashboard" class="icon-btn" title="Painel">📊</a>` : ''}
        ${user?.role === 'admin' ? `<a href="#/admin" class="icon-btn" title="Admin">⚙️</a>` : ''}
        ${user ? `<button type="button" class="icon-btn" id="logout-btn" title="Sair">🚪</button>` : `<a href="#/conta/entrar" class="icon-btn hidden md:flex" title="Entrar">❤️</a>`}

        <button type="button" class="icon-btn menu-toggle" id="menu-toggle" aria-expanded="${menuOpen}">${menuOpen ? '✕' : '☰'}</button>
      </div>
    </div>

    <nav class="nav-mobile ${menuOpen ? 'open' : ''}" id="nav-mobile">
      <a href="#/">Lojas</a>
      <a href="#/lojista/entrar">Área do Lojista</a>
      <a href="#/regras">Regras</a>
      ${user?.role === 'customer' ? '<a href="#/favoritos">❤️ Favoritos</a>' : ''}
      ${user?.role === 'merchant' ? '<a href="#/dashboard">📊 Painel do Lojista</a>' : ''}
      ${user?.role === 'admin' ? '<a href="#/admin">⚙️ Painel Admin</a>' : ''}
      ${user ? '<button type="button" id="logout-mobile">🚪 Sair</button>' : '<a href="#/conta/entrar">🔑 Entrar</a>'}
    </nav>
  `

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