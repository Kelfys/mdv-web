/**
 * Página inicial — feed misto de lojas, produtos e anúncios.
 *
 * Ranking em js/feed.js (plano, engajamento, diversidade entre lojas).
 * Busca e filtros por categoria substituem o feed padrão.
 */
import { fetchCategories, fetchStores, fetchNewProducts, fetchTopLikedProducts, fetchActiveFeedAds } from '../api.js'
import { renderStoreCard, renderFeedProductCard, renderFeedAdCard, openCart } from '../ui.js'
import { escapeHtml } from '../utils.js'
import { buildHomeFeed } from '../feed.js'
import { setStore, addItem, getUser } from '../state.js'
import { normalizeStorePaymentMethods } from '../payment.js'

const FEED_PRODUCT_LIMIT = 12

export async function renderHome(main) {
  let search = ''
  let categoryId = null
  let categories = []
  let stores = []
  let newProducts = []
  let likedProducts = []
  let feedItems = []
  let productMap = new Map()
  let feedAds = []

  async function load() {
    const feed = main.querySelector('#feed')
    if (feed) feed.innerHTML = '<div class="loading"><div class="spinner"></div></div>'

    try {
      const user = getUser()
      const productFilters = {
        categoryId: categoryId ?? undefined,
        search: search || undefined,
        limit: FEED_PRODUCT_LIMIT,
        userId: user?.id,
      }

      ;[categories, stores, newProducts, likedProducts, feedAds] = await Promise.all([
        fetchCategories(),
        fetchStores({
          search: search || undefined,
          categoryId: categoryId ?? undefined,
          marketplaceVisible: true,
        }),
        fetchNewProducts(productFilters),
        fetchTopLikedProducts(productFilters),
        fetchActiveFeedAds(6),
      ])

      feedItems = buildHomeFeed(stores, newProducts, likedProducts, feedAds, {
        search,
        categoryId,
      })
      productMap = new Map(
        [...newProducts, ...likedProducts].map((product) => [product.id, product])
      )
      paint()
    } catch (err) {
      const feedEl = main.querySelector('#feed')
      if (feedEl) {
        feedEl.innerHTML = `
          <div class="empty-state">
            <h2>Erro ao conectar</h2>
            <p>${escapeHtml(err.message)}</p>
          </div>
        `
      }
    }
  }

  function bindFeedEvents() {
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

  function renderFeedItem(item) {
    if (item.kind === 'store') return renderStoreCard(item.store, { showPlanBadge: true })
    if (item.kind === 'ad') return renderFeedAdCard(item.ad)
    return renderFeedProductCard(item.product, { badge: item.badge })
  }

  function paint() {
    const hasFilters = Boolean(search || categoryId)
    const label = search
      ? `Resultados para "${search}"`
      : categoryId
        ? `${categories.find((c) => c.id === categoryId)?.name ?? 'Categoria'}`
        : ''

    const emptyMessage = hasFilters
      ? '<div class="empty-state"><h2>Nada encontrado</h2><p>Tente outra categoria ou limpe a busca.</p></div>'
      : '<div class="empty-state"><h2>Feed vazio</h2><p>Em breve novas lojas e produtos aparecerão aqui.</p></div>'

    main.innerHTML = `
      <div class="toolbar">
        <div class="container" style="display:flex;flex-direction:column;gap:0.5rem;padding:0.5rem 0">
          <input type="search" class="search-input" id="search" placeholder="Buscar loja ou produto..." value="${escapeHtml(search)}" />
          <div class="category-scroll" id="categories">
            <button type="button" class="chip ${!categoryId ? 'active' : ''}" data-cat="">Todas</button>
            ${categories.map((c) => `
              <button type="button" class="chip ${categoryId === c.id ? 'active' : ''}" data-cat="${c.id}">${escapeHtml(c.name)}</button>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="container">
        ${label ? `<p class="feed-label">${escapeHtml(label)}</p>` : ''}
        <div class="feed" id="feed">
          ${feedItems.length === 0 ? emptyMessage : feedItems.map(renderFeedItem).join('')}
        </div>
      </div>
    `

    let debounce
    main.querySelector('#search')?.addEventListener('input', (e) => {
      clearTimeout(debounce)
      debounce = setTimeout(() => { search = e.target.value; load() }, 300)
    })

    main.querySelectorAll('[data-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        categoryId = btn.dataset.cat || null
        load()
      })
    })

    bindFeedEvents()
  }

  paint()
  await load()
}