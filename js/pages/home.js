/**
 * Página inicial — feed "Para você" (lojas, produtos e anúncios patrocinados no mix).
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
import { t } from '../strings.js'
import { bindHomeFiltersScroll } from '../home-filters-scroll.js'
import { bindReportTriggers, getReportLoginPath } from '../reporting.js'
import { navigate } from '../router.js'
import { showToast } from '../utils.js'

const FEED_PRODUCT_LIMIT = 12
const FEED_ADS_LIMIT = 12
const FEED_SKELETON_COUNT = 6

function countUniqueProducts(...lists) {
  const ids = new Set()
  for (const list of lists) {
    for (const product of list ?? []) ids.add(product.id)
  }
  return ids.size
}

function renderHomeEmptyState({ icon, title, body, actionHtml = '' }) {
  return `
    <div class="home-empty">
      <span class="home-empty__icon" aria-hidden="true">${icon}</span>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(body)}</p>
      ${actionHtml}
    </div>`
}

function renderFeedSkeleton() {
  return Array.from({ length: FEED_SKELETON_COUNT }, () => `
    <div class="feed__item feed__item--skeleton" aria-hidden="true">
      <div class="skeleton-card">
        <div class="skeleton-card__media"></div>
        <div class="skeleton-card__lines">
          <div class="skeleton-line skeleton-line--lg"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line skeleton-line--sm"></div>
        </div>
      </div>
    </div>
  `).join('')
}

export async function renderHome(main) {
  let search = ''
  let categoryId = null
  let neighborhoodId = getSelectedNeighborhoodId()
  let categories = []
  let neighborhoods = []
  let stores = []
  let newProducts = []
  let likedProducts = []
  let feedItems = []
  let productMap = new Map()
  let feedAds = []
  let loading = false

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
    const user = getUser()
    if (item.kind === 'store') return renderStoreCard(item.store, { showPlanBadge: true, user })
    if (item.kind === 'ad') return renderFeedAdCard(item.ad)
    return renderFeedProductCard(item.product, {
      badge: item.badge,
      user,
      storeOwnerId: item.product?.store?.owner_id,
    })
  }

  function wrapFeedItem(item) {
    const kind = item.kind === 'ad' ? 'ad' : item.kind
    return `<div class="feed__item feed__item--${kind}">${renderFeedItem(item)}</div>`
  }

  function clearFiltersAction() {
    const hasFilters = Boolean(search || categoryId)
    if (!hasFilters) return ''
    return `<button type="button" class="btn btn-outline btn-sm" data-clear-home-filters>${t('home.clearFilters')}</button>`
  }

  function renderFeedContent() {
    if (loading) return renderFeedSkeleton()

    if (neighborhoods.length === 0) {
      return renderHomeEmptyState({
        icon: '📍',
        title: t('home.noNeighborhoodsTitle'),
        body: t('home.noNeighborhoodsBody'),
      })
    }

    const hasFilters = Boolean(search || categoryId)
    if (feedItems.length === 0) {
      return renderHomeEmptyState({
        icon: hasFilters ? '🔍' : '🏪',
        title: hasFilters ? t('home.nothingFoundTitle') : t('home.emptyFeedTitle'),
        body: hasFilters ? t('home.nothingFoundBody') : t('home.emptyFeedBody'),
        actionHtml: clearFiltersAction(),
      })
    }

    return feedItems.map(wrapFeedItem).join('')
  }

  function renderHero(selectedNeighborhood) {
    const neighborhoodLabel = selectedNeighborhood ? formatNeighborhoodLabel(selectedNeighborhood) : ''
    const productCount = countUniqueProducts(newProducts, likedProducts)
    const statsText = productCount > 0
      ? (neighborhoodId
        ? t('home.heroStats', { stores: stores.length, products: productCount })
        : t('home.heroStatsAll', { stores: stores.length, products: productCount }))
      : (neighborhoodId
        ? t('home.heroStatsStoresOnly', { stores: stores.length })
        : t('home.heroStatsStoresOnlyAll', { stores: stores.length }))

    return `
      <section class="home-hero">
        <div class="container home-hero__inner">
          <div class="home-hero__copy">
            <p class="home-hero__eyebrow">${t('home.heroEyebrow')}</p>
            <h1 class="home-hero__title">${t('home.heroTitle')}</h1>
            ${neighborhoodLabel ? `<p class="home-hero__location">📍 ${escapeHtml(neighborhoodLabel)}</p>` : ''}
            ${neighborhoods.length ? `<p class="home-hero__stats">${escapeHtml(statsText)}</p>` : ''}
          </div>
        </div>
      </section>`
  }

  function renderToolbar() {
    const searchPlaceholder = t('home.searchStoresProducts')
    const showNeighborhoods = neighborhoods.length > 0
    const showCategories = categories.length > 0
    const showFilters = showNeighborhoods || showCategories

    return `
      <div class="home-toolbar toolbar toolbar--sticky">
        <div class="container home-toolbar__inner">
          <label class="search-field">
            <span class="search-field__icon" aria-hidden="true">🔍</span>
            <input
              type="search"
              class="search-input search-field__input"
              id="search"
              placeholder="${searchPlaceholder}"
              value="${escapeHtml(search)}"
              autocomplete="off"
            />
          </label>
          ${showFilters ? `
            <div class="home-toolbar__filters" id="home-toolbar-filters">
              ${showNeighborhoods ? `
                <div class="home-toolbar__row">
                  <span class="home-toolbar__label">${t('home.neighborhoodsLabel')}</span>
                  <div class="category-scroll category-scroll--fade neighborhood-scroll" id="neighborhoods">
                    <button type="button" class="chip chip--neighborhood ${!neighborhoodId ? 'active' : ''}" data-neighborhood="">${t('home.allNeighborhoods')}</button>
                    ${neighborhoods.map((n) => `
                      <button type="button" class="chip chip--neighborhood ${neighborhoodId === n.id ? 'active' : ''}" data-neighborhood="${n.id}">
                        ${escapeHtml(n.name)}
                      </button>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
              ${showCategories ? `
                <div class="home-toolbar__row">
                  <span class="home-toolbar__label">${t('home.categoriesLabel')}</span>
                  <div class="category-scroll category-scroll--fade" id="categories">
                    <button type="button" class="chip chip--category ${!categoryId ? 'active' : ''}" data-cat="">${t('home.allCategories')}</button>
                    ${categories.map((c) => `
                      <button type="button" class="chip chip--category ${categoryId === c.id ? 'active' : ''}" data-cat="${c.id}">${escapeHtml(c.name)}</button>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      </div>`
  }

  function renderFeedLabel() {
    const selectedNeighborhood = neighborhoods.find((n) => n.id === neighborhoodId)
    const neighborhoodLabel = selectedNeighborhood ? formatNeighborhoodLabel(selectedNeighborhood) : ''

    if (search) return t('home.resultsFor', { term: search })
    if (categoryId) {
      return categories.find((c) => c.id === categoryId)?.name ?? t('labels.category')
    }
    if (neighborhoodLabel) return t('home.neighborhoodLabel', { name: neighborhoodLabel })
    if (neighborhoods.length) return t('home.allNeighborhoodsLabel')
    return ''
  }

  function paint() {
    const selectedNeighborhood = neighborhoods.find((n) => n.id === neighborhoodId)
    const label = renderFeedLabel()

    main.innerHTML = `
      <div class="home-page">
        ${renderHero(selectedNeighborhood)}
        ${renderToolbar()}
        <div class="container home-content">
          ${label ? `<p class="feed-label">${escapeHtml(label)}</p>` : ''}
          <div class="feed feed--grid" id="feed" ${loading ? 'aria-busy="true"' : ''}>
            ${renderFeedContent()}
          </div>
        </div>
      </div>
    `

    let debounce
    main.querySelector('#search')?.addEventListener('input', (e) => {
      clearTimeout(debounce)
      debounce = setTimeout(() => {
        search = e.target.value
        load()
      }, 300)
    })

    main.querySelector('[data-clear-home-filters]')?.addEventListener('click', () => {
      search = ''
      categoryId = null
      load()
    })

    main.querySelectorAll('[data-neighborhood]').forEach((btn) => {
      btn.addEventListener('click', () => {
        neighborhoodId = btn.dataset.neighborhood || null
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

    bindFeedEvents()
    bindHomeFiltersScroll() // auto-hide bairros/categorias ao rolar — ver home-filters-scroll.js

    const currentUser = getUser()
    bindReportTriggers(main, {
      user: currentUser,
      redirectPath: '/',
      onRequireAuth: () => {
        navigate(getReportLoginPath(currentUser, '/'))
        showToast(t('report.loginRequired'))
      },
    })
  }

  async function load() {
    loading = true
    const feed = main.querySelector('#feed')
    if (feed) {
      feed.innerHTML = renderFeedSkeleton()
      feed.setAttribute('aria-busy', 'true')
    }

    try {
      const user = getUser()
      neighborhoods = await fetchNeighborhoods()

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

      feedItems = buildHomeFeed(stores, newProducts, likedProducts, feedAds, {
        search,
        categoryId,
      })
      productMap = new Map(
        [...newProducts, ...likedProducts].map((product) => [product.id, product]),
      )
    } catch (err) {
      loading = false
      main.innerHTML = `
        <div class="container home-error">
          ${renderHomeEmptyState({
            icon: '⚠️',
            title: t('home.connectErrorTitle'),
            body: err.message,
          })}
        </div>
      `
      return
    }

    loading = false
    paint()
  }

  paint()
  await load()
}