/**
 * Página inicial — abas "Para você" (lojas e produtos) e "Anúncios".
 *
 * Feed filtrado por bairro/região selecionado (localStorage).
 */
import { fetchCategories, fetchStores, fetchNewProducts, fetchTopLikedProducts, fetchActiveFeedAds, fetchNeighborhoods } from '../api.js'
import { renderStoreCard, renderFeedProductCard, renderFeedAdCard, openCart } from '../ui.js'
import { escapeHtml } from '../utils.js'
import { buildHomeFeed } from '../feed.js'
import { setStore, addItem, getUser } from '../state.js'
import { normalizeStorePaymentMethods } from '../payment.js'
import { getSelectedNeighborhoodId, setSelectedNeighborhoodId, formatNeighborhoodLabel } from '../neighborhood.js'

const FEED_PRODUCT_LIMIT = 12
const FEED_ADS_LIMIT = 12

export async function renderHome(main) {
  let search = ''
  let categoryId = null
  let neighborhoodId = getSelectedNeighborhoodId()
  let activeTab = 'feed'
  let categories = []
  let neighborhoods = []
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
      neighborhoods = await fetchNeighborhoods()

      if (!neighborhoodId && neighborhoods.length > 0) {
        neighborhoodId = neighborhoods[0].id
        setSelectedNeighborhoodId(neighborhoodId)
      }

      const productFilters = {
        categoryId: categoryId ?? undefined,
        search: search || undefined,
        limit: FEED_PRODUCT_LIMIT,
        userId: user?.id,
        neighborhoodId: neighborhoodId ?? undefined,
      }

      ;[categories, stores, newProducts, likedProducts, feedAds] = await Promise.all([
        fetchCategories(),
        fetchStores({
          search: search || undefined,
          categoryId: categoryId ?? undefined,
          neighborhoodId: neighborhoodId ?? undefined,
          marketplaceVisible: true,
        }),
        fetchNewProducts(productFilters),
        fetchTopLikedProducts(productFilters),
        fetchActiveFeedAds(FEED_ADS_LIMIT, neighborhoodId ?? undefined),
      ])

      feedItems = buildHomeFeed(stores, newProducts, likedProducts, [], {
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
    return renderFeedProductCard(item.product, { badge: item.badge })
  }

  function filterAds(ads) {
    const term = search.trim().toLowerCase()
    if (!term) return ads
    return ads.filter((ad) => {
      const haystack = `${ad.title} ${ad.message} ${ad.store?.name ?? ''}`.toLowerCase()
      return haystack.includes(term)
    })
  }

  function renderFeedContent() {
    if (neighborhoods.length === 0) {
      return '<div class="empty-state"><h2>Nenhum bairro configurado</h2><p>Em breve novas regiões estarão disponíveis.</p></div>'
    }

    if (activeTab === 'ads') {
      const ads = filterAds(feedAds)
      if (ads.length === 0) {
        return search
          ? '<div class="empty-state"><h2>Nenhum anúncio encontrado</h2><p>Tente outro termo de busca.</p></div>'
          : '<div class="empty-state"><h2>Sem anúncios no momento</h2><p>Volte em breve para ver ofertas patrocinadas neste bairro.</p></div>'
      }
      return ads.map((ad) => renderFeedAdCard(ad)).join('')
    }

    const hasFilters = Boolean(search || categoryId)
    if (feedItems.length === 0) {
      return hasFilters
        ? '<div class="empty-state"><h2>Nada encontrado</h2><p>Tente outra categoria ou limpe a busca.</p></div>'
        : '<div class="empty-state"><h2>Feed vazio neste bairro</h2><p>Em breve novas lojas e produtos aparecerão aqui.</p></div>'
    }
    return feedItems.map(renderFeedItem).join('')
  }

  function paint() {
    const selectedNeighborhood = neighborhoods.find((n) => n.id === neighborhoodId)
    const neighborhoodLabel = selectedNeighborhood ? formatNeighborhoodLabel(selectedNeighborhood) : ''
    const hasFilters = Boolean(search || categoryId)
    const label = activeTab === 'feed' && (search || categoryId)
      ? search
        ? `Resultados para "${search}"`
        : `${categories.find((c) => c.id === categoryId)?.name ?? 'Categoria'}`
      : activeTab === 'ads' && search
        ? `Anúncios para "${search}"`
        : neighborhoodLabel
          ? `Bairro: ${neighborhoodLabel}`
          : ''

    main.innerHTML = `
      <div class="toolbar">
        <div class="container" style="display:flex;flex-direction:column;gap:0.5rem;padding:0.5rem 0">
          <input type="search" class="search-input" id="search" placeholder="${activeTab === 'ads' ? 'Buscar anúncio...' : 'Buscar loja ou produto...'}" value="${escapeHtml(search)}" />
          ${neighborhoods.length ? `
            <div class="category-scroll neighborhood-scroll" id="neighborhoods">
              ${neighborhoods.map((n) => `
                <button type="button" class="chip ${neighborhoodId === n.id ? 'active' : ''}" data-neighborhood="${n.id}">
                  📍 ${escapeHtml(n.name)}
                </button>
              `).join('')}
            </div>
          ` : ''}
          ${activeTab === 'feed' ? `
            <div class="category-scroll" id="categories">
              <button type="button" class="chip ${!categoryId ? 'active' : ''}" data-cat="">Todas</button>
              ${categories.map((c) => `
                <button type="button" class="chip ${categoryId === c.id ? 'active' : ''}" data-cat="${c.id}">${escapeHtml(c.name)}</button>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
      <div class="container">
        <div class="home-tabs tabs">
          <button type="button" class="tab ${activeTab === 'feed' ? 'active' : ''}" data-home-tab="feed">Para você</button>
          <button type="button" class="tab ${activeTab === 'ads' ? 'active' : ''}" data-home-tab="ads">
            Anúncios${feedAds.length ? ` (${feedAds.length})` : ''}
          </button>
        </div>
        ${label ? `<p class="feed-label">${escapeHtml(label)}</p>` : ''}
        <div class="feed" id="feed">
          ${renderFeedContent()}
        </div>
      </div>
    `

    let debounce
    main.querySelector('#search')?.addEventListener('input', (e) => {
      clearTimeout(debounce)
      debounce = setTimeout(() => {
        search = e.target.value
        if (activeTab === 'feed') load()
        else paint()
      }, 300)
    })

    main.querySelectorAll('[data-neighborhood]').forEach((btn) => {
      btn.addEventListener('click', () => {
        neighborhoodId = btn.dataset.neighborhood
        setSelectedNeighborhoodId(neighborhoodId)
        load()
      })
    })

    main.querySelectorAll('[data-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        categoryId = btn.dataset.cat || null
        load()
      })
    })

    main.querySelectorAll('[data-home-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.homeTab
        if (tab === activeTab) return
        activeTab = tab
        paint()
        if (tab === 'feed') load()
      })
    })

    bindFeedEvents()
  }

  paint()
  await load()
}