/**
 * Página pública da loja — catálogo, carrinho, favoritos e engajamento.
 *
 * Produtos são ordenados por rankProductsByEngagement (curtidas + novidade).
 * paint() re-renderiza o DOM inteiro; retorna cleanup ao sair da rota.
 *
 * Melhorias futuras:
 * - Atualização parcial do DOM (evitar repaint completo a cada like)
 * - Filtro de produtos por categoria dentro da loja
 * - Formulário de avaliação da loja (reviews já existe na API)
 * - Compartilhamento de link da loja (Web Share API)
 */
import {
  fetchStoreBySlug, fetchProductsByStore, fetchReviewsByStore,
  recordStoreView, toggleFavorite, isFavorite,
  toggleProductLike, fetchProductComments, addProductComment,
} from '../api.js'
import { getStoreThemeColor } from '../config.js'
import {
  renderProductCard, openCart, formatPhone,
} from '../ui.js'
import {
  escapeHtml, rankProductsByEngagement, instagramProfileUrl, formatInstagramDisplay,
} from '../utils.js'
import { setStore, addItem, getCartItemCount, getUser } from '../state.js'
import { normalizeStorePaymentMethods } from '../payment.js'
import { navigate } from '../router.js'
import { showToast } from '../utils.js'
import { t } from '../strings.js'

export async function renderStorePage(main, { slug }) {
  const store = await fetchStoreBySlug(slug)

  if (!store) {
    main.innerHTML = `
      <div class="empty-state">
        <h2>${t('store.unavailableTitle')}</h2>
        <p>${t('store.unavailableBody')}</p>
        <a href="#/" class="btn btn-primary">${t('store.backToHome')}</a>
      </div>
    `
    return
  }

  setStore(store.id, store.name, store.whatsapp, normalizeStorePaymentMethods(store.payment_methods))
  recordStoreView(store.id)

  const user = getUser()
  const [rawProducts, reviews] = await Promise.all([
    fetchProductsByStore(store.id, user?.id),
    fetchReviewsByStore(store.id),
  ])

  let products = rankProductsByEngagement(rawProducts)
  const theme = getStoreThemeColor(store.theme_color)
  let favorited = user ? await isFavorite(user.id, store.id) : false
  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0

  const productMap = new Map(products.map((p) => [p.id, p]))
  const openComments = new Set()
  const commentsByProduct = new Map()
  const commentsLoading = new Set()

  function requireAuthForEngagement() {
    navigate(`/conta/entrar?redirect=${encodeURIComponent(`/loja/${slug}`)}`)
    showToast(t('store.loginToEngage'))
  }

  async function loadComments(productId) {
    commentsLoading.add(productId)
    paint()
    try {
      const comments = await fetchProductComments(productId)
      commentsByProduct.set(productId, comments)
    } catch (err) {
      showToast(err.message ?? t('store.commentsLoadError'))
    } finally {
      commentsLoading.delete(productId)
      paint()
    }
  }

  function paint() {
    const cartCount = getCartItemCount()
    const currentUser = getUser()
    const bannerStyle = `background:linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})`

    main.innerHTML = `
      <div class="store-hero">
        ${store.banner
          ? `<img src="${escapeHtml(store.banner)}" alt="" />`
          : `<div style="${bannerStyle};width:100%;height:100%"></div>`}
        <div class="store-hero__overlay"></div>
        <a href="#/" class="store-hero__back">${t('store.backShort')}</a>
      </div>

      <div class="container-wide" style="padding-bottom:3rem">
        <div class="store-profile">
          <div class="store-profile__info">
            ${store.logo
              ? `<img class="store-profile__logo" src="${escapeHtml(store.logo)}" alt="${escapeHtml(store.name)}" />`
              : `<div class="store-profile__logo-ph" style="background:${theme.hex}">🏪</div>`}
            <div>
              <h1 style="font-size:1.75rem;font-weight:700">${escapeHtml(store.name)}</h1>
              ${store.category ? `<span class="store-card__category" style="background:${theme.hex}">${escapeHtml(store.category.name)}</span>` : ''}
              ${avgRating > 0 ? `<div class="stars" style="margin-top:0.25rem">★ ${avgRating.toFixed(1)} (${reviews.length})</div>` : ''}
            </div>
          </div>
          <div class="store-profile__actions">
            <button type="button" class="btn btn-primary" id="open-cart">
              ${t('store.cart')} ${cartCount > 0 ? `<span class="badge-count">${cartCount > 9 ? '9+' : cartCount}</span>` : ''}
            </button>
            <button type="button" class="btn btn-outline" id="favorite-btn">${favorited ? t('store.favorited') : t('store.favorite')}</button>
            <button type="button" class="btn btn-outline" id="share-btn">${t('store.share')}</button>
          </div>
        </div>

        <div class="info-panel">
          ${store.description ? `<p>${escapeHtml(store.description)}</p>` : ''}
          ${store.address ? `<div class="info-panel__item">📍 ${escapeHtml(store.address)}, ${escapeHtml(store.city)} - ${escapeHtml(store.state)}</div>` : ''}
          ${store.opening_hours ? `<div class="info-panel__item">🕐 ${escapeHtml(store.opening_hours)}</div>` : ''}
          <div class="info-panel__item">📞 ${formatPhone(store.whatsapp)}</div>
          ${store.instagram ? `<a class="info-panel__item info-panel__link" href="${escapeHtml(instagramProfileUrl(store.instagram))}" target="_blank" rel="noopener noreferrer">📷 ${escapeHtml(formatInstagramDisplay(store.instagram))}</a>` : ''}
        </div>

        <div class="products-header">
          <h2 class="section-title">${t('store.productsAndServices')}</h2>
          <p class="products-header__hint">${t('store.productsSortHint')}</p>
        </div>
        ${products.length === 0
          ? `<div class="empty-state"><h2>${t('store.emptyCatalog')}</h2></div>`
          : `<div class="product-grid" id="products">${products.map((product) => renderProductCard(product, {
              user: currentUser,
              commentsOpen: openComments.has(product.id),
              comments: commentsByProduct.get(product.id) ?? [],
              commentsLoading: commentsLoading.has(product.id),
            })).join('')}</div>`}

        ${reviews.length > 0 ? `
          <section style="margin-top:2rem;padding-top:2rem;border-top:1px solid var(--border)">
            <h2 class="section-title">${t('store.storeReviews')}</h2>
            ${reviews.map((r) => `
              <div class="review-card">
                <div style="display:flex;justify-content:space-between">
                  <strong>${escapeHtml(r.user?.name ?? t('common.anonymous'))}</strong>
                  <span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
                </div>
                ${r.comment ? `<p style="margin-top:0.5rem;font-size:0.875rem;color:var(--text-secondary)">${escapeHtml(r.comment)}</p>` : ''}
              </div>
            `).join('')}
          </section>
        ` : ''}
      </div>
    `

    document.getElementById('open-cart')?.addEventListener('click', openCart)
    document.getElementById('share-btn')?.addEventListener('click', async () => {
      const url = window.location.href
      if (navigator.share) {
        await navigator.share({ title: store.name, url })
      } else {
        await navigator.clipboard.writeText(url)
        showToast(t('store.linkCopiedToast'))
      }
    })

    document.getElementById('favorite-btn')?.addEventListener('click', async () => {
      if (!currentUser) {
        navigate(`/conta/entrar?redirect=${encodeURIComponent(`/loja/${slug}`)}`)
        return
      }
      if (currentUser.role !== 'customer') {
        showToast(t('store.customersOnlyFavorite'))
        return
      }
      favorited = await toggleFavorite(currentUser.id, store.id)
      paint()
    })

    main.querySelectorAll('[data-add-product]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const product = productMap.get(btn.dataset.addProduct)
        if (product) {
          addItem(product)
          openCart()
          paint()
        }
      })
    })

    main.querySelectorAll('[data-like-product]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!currentUser) {
          requireAuthForEngagement()
          return
        }

        const productId = btn.dataset.likeProduct
        const product = productMap.get(productId)
        if (!product) return

        try {
          const liked = await toggleProductLike(currentUser.id, productId)
          product.liked_by_user = liked
          product.likes_count = Math.max(0, (product.likes_count ?? 0) + (liked ? 1 : -1))
          paint()
        } catch (err) {
          showToast(err.message ?? t('store.likeError'))
        }
      })
    })

    main.querySelectorAll('[data-toggle-comments]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const productId = btn.dataset.toggleComments
        if (openComments.has(productId)) {
          openComments.delete(productId)
          paint()
          return
        }

        openComments.add(productId)
        if (!commentsByProduct.has(productId)) {
          await loadComments(productId)
          return
        }
        paint()
      })
    })

    main.querySelectorAll('[data-comment-form]').forEach((form) => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault()
        if (!currentUser) {
          requireAuthForEngagement()
          return
        }

        const productId = form.dataset.commentForm
        const content = form.content.value
        const submitBtn = form.querySelector('button[type="submit"]')
        if (submitBtn) {
          submitBtn.disabled = true
          submitBtn.textContent = t('checkout.submitting')
        }

        try {
          const comment = await addProductComment(currentUser.id, productId, content)
          const product = productMap.get(productId)
          if (product) product.comments_count = (product.comments_count ?? 0) + 1
          const existing = commentsByProduct.get(productId) ?? []
          commentsByProduct.set(productId, [comment, ...existing])
          form.reset()
          paint()
          showToast(t('store.commentPublished'))
        } catch (err) {
          showToast(err.message ?? t('store.commentError'))
          paint()
        }
      })
    })
  }

  paint()
}