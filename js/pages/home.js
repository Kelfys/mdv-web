/**
 * Página inicial — feed único "Para você".
 *
 * Lojas, produtos e anúncios patrocinados (Premium) entram no mesmo grid via
 * `buildHomeFeed()` (`js/feed.js`). Não há aba separada de anúncios — ver commit 320d076.
 *
 * Feed filtrado por bairro/região selecionado (localStorage).
 */
import { fetchCategories, fetchStores, fetchNewProducts, fetchTopLikedProducts, fetchActiveFeedAds, fetchNeighborhoods } from '../api.js'
import { renderStoreCard, renderFeedProductCard, renderFeedAdCard, openCart } from '../ui.js'
import { escapeHtml } from '../utils.js'
import { buildHomeFeed, paginateFeedItems, FEED_PAGE_SIZE } from '../feed.js'
import { setStore, addItem, getUser } from '../state.js'
import { normalizeStorePaymentMethods } from '../payment.js'
import { getSelectedNeighborhoodId, setSelectedNeighborhoodId, formatNeighborhoodLabel } from '../neighborhood.js'
import { t } from '../strings.js'
import { bindHomeFiltersScroll } from '../home-filters-scroll.js'
import { bindReportTriggers, getReportLoginPath } from '../reporting.js'
import { navigate } from '../router.js'
import { showToast } from '../utils.js'
import { renderPaginationHtml } from '../list-utils.js'

/** Mais produtos no pool para preencher várias páginas de 44 cards. */
const FEED_PRODUCT_LIMIT = 100
const FEED_ADS_LIMIT = 24
const FEED_SKELETON_COUNT = 6

/**
 * Scroll horizontal de chips (bairros/categorias) no desktop:
 * roda do mouse, arrastar e barra de scroll.
 * Atualiza fade nas pontas e leva a chip ativa para a área visível.
 */
function updateChipRowFade(el) {
  if (!el) return
  const max = el.scrollWidth - el.clientWidth
  const overflow = max > 2
  el.classList.toggle('category-scroll--fade-start', overflow && el.scrollLeft > 4)
  el.classList.toggle('category-scroll--fade-end', overflow && el.scrollLeft < max - 4)
}

function scrollActiveChipIntoView(el) {
  if (!el) return
  const active = el.querySelector('.chip.active')
  if (!active) return
  // centraliza a ativa quando possível
  const left = active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2
  el.scrollTo({ left: Math.max(0, left), behavior: 'instant' in HTMLElement.prototype ? 'instant' : 'auto' })
  updateChipRowFade(el)
}

function bindChipRowScroll(el) {
  if (!el || el.dataset.chipScrollBound === '1') return
  el.dataset.chipScrollBound = '1'

  const DRAG_THRESHOLD = 6

  const onScrollOrResize = () => updateChipRowFade(el)
  el.addEventListener('scroll', onScrollOrResize, { passive: true })
  window.addEventListener('resize', onScrollOrResize, { passive: true })

  el.addEventListener('wheel', (e) => {
    if (el.scrollWidth <= el.clientWidth + 1) return
    // Roda vertical → scroll horizontal na faixa
    if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
      e.preventDefault()
      el.scrollLeft += e.deltaY
    } else {
      el.scrollLeft += e.deltaX
    }
    updateChipRowFade(el)
  }, { passive: false })

  // Arraste só com mouse no desktop. Touch usa scroll nativo (overflow-x).
  // Importante: NÃO capturar pointer / pointer-events:none no pointerdown —
  // senão o click do chip deixa de funcionar.
  let tracking = false
  let dragging = false
  let suppressClick = false
  let startX = 0
  let startLeft = 0
  let activePointerId = null

  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    if (el.scrollWidth <= el.clientWidth + 1) return
    tracking = true
    dragging = false
    suppressClick = false
    startX = e.clientX
    startLeft = el.scrollLeft
    activePointerId = e.pointerId
  })

  el.addEventListener('pointermove', (e) => {
    if (!tracking || e.pointerId !== activePointerId) return
    const dx = e.clientX - startX
    if (!dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return
      // Só agora entrou em modo arraste
      dragging = true
      suppressClick = true
      el.classList.add('category-scroll--dragging')
      try { el.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    }
    el.scrollLeft = startLeft - dx
    updateChipRowFade(el)
  })

  const endDrag = (e) => {
    if (!tracking || (e.pointerId != null && e.pointerId !== activePointerId)) return
    tracking = false
    activePointerId = null
    if (dragging) {
      dragging = false
      el.classList.remove('category-scroll--dragging')
      try { el.releasePointerCapture?.(e.pointerId) } catch { /* ignore */ }
    }
  }

  el.addEventListener('pointerup', endDrag)
  el.addEventListener('pointercancel', endDrag)
  el.addEventListener('lostpointercapture', () => {
    tracking = false
    dragging = false
    activePointerId = null
    el.classList.remove('category-scroll--dragging')
  })

  // Só bloqueia click se houve arraste real
  el.addEventListener('click', (e) => {
    if (!suppressClick) return
    e.preventDefault()
    e.stopPropagation()
    suppressClick = false
  }, true)

  // Layout pronto → fade + chip ativa visível
  requestAnimationFrame(() => {
    scrollActiveChipIntoView(el)
    updateChipRowFade(el)
  })
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
  /** Feed completo montado pelo algoritmo (todas as páginas). */
  let allFeedItems = []
  let productMap = new Map()
  let feedAds = []
  let loading = false
  let feedPage = 1

  function bindFeedEvents() {
    main.querySelectorAll('[data-feed-add-product]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const productId = btn.dataset.feedAddProduct
        const product = productMap.get(productId)
        if (!product) {
          showToast(t('errors.productNotFound'))
          return
        }
        if (!product.store) {
          showToast(t('checkout.storeNoWhatsapp'))
          return
        }

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

  function getFeedPage() {
    return paginateFeedItems(allFeedItems, feedPage, FEED_PAGE_SIZE)
  }

  function renderFeedPagination(pageInfo) {
    if (pageInfo.total === 0) return ''
    return `
      <div class="feed-pagination" id="feed-pagination">
        ${renderPaginationHtml({
          currentPage: pageInfo.page,
          totalPages: pageInfo.totalPages,
          matchedCount: pageInfo.total,
          pageSize: pageInfo.pageSize,
          labelSingular: t('pagination.cardSingular'),
          labelPlural: t('pagination.cardPlural'),
          prevAttr: 'data-feed-page-prev',
          nextAttr: 'data-feed-page-next',
          showInfo: false,
        })}
      </div>`
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
    if (allFeedItems.length === 0) {
      return renderHomeEmptyState({
        icon: hasFilters ? '🔍' : '🏪',
        title: hasFilters ? t('home.nothingFoundTitle') : t('home.emptyFeedTitle'),
        body: hasFilters ? t('home.nothingFoundBody') : t('home.emptyFeedBody'),
        actionHtml: clearFiltersAction(),
      })
    }

    const pageInfo = getFeedPage()
    feedPage = pageInfo.page
    return pageInfo.items.map(wrapFeedItem).join('')
  }

  function renderHero(selectedNeighborhood) {
    const neighborhoodLabel = selectedNeighborhood ? formatNeighborhoodLabel(selectedNeighborhood) : ''

    return `
      <section class="home-hero">
        <div class="container home-hero__inner">
          <div class="home-hero__copy">
            <p class="home-hero__eyebrow">${t('home.heroEyebrow')}</p>
            <h1 class="home-hero__title">${t('home.heroTitle')}</h1>
            ${neighborhoodLabel ? `<p class="home-hero__location">📍 ${escapeHtml(neighborhoodLabel)}</p>` : ''}
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
    const pageInfo = !loading && allFeedItems.length > 0 ? getFeedPage() : null

    main.innerHTML = `
      <div class="home-page">
        ${renderHero(selectedNeighborhood)}
        ${renderToolbar()}
        <div class="container home-content">
          ${label ? `<p class="feed-label">${escapeHtml(label)}</p>` : ''}
          <div class="feed feed--grid" id="feed" ${loading ? 'aria-busy="true"' : ''}>
            ${renderFeedContent()}
          </div>
          ${pageInfo ? renderFeedPagination(pageInfo) : ''}
        </div>
      </div>
    `

    let debounce
    main.querySelector('#search')?.addEventListener('input', (e) => {
      clearTimeout(debounce)
      debounce = setTimeout(() => {
        search = e.target.value
        feedPage = 1
        load()
      }, 300)
    })

    main.querySelector('[data-clear-home-filters]')?.addEventListener('click', () => {
      search = ''
      categoryId = null
      feedPage = 1
      load()
    })

    main.querySelectorAll('[data-neighborhood]').forEach((btn) => {
      btn.addEventListener('click', () => {
        neighborhoodId = btn.dataset.neighborhood || null
        setSelectedNeighborhoodId(neighborhoodId)
        feedPage = 1
        load()
      })
    })

    main.querySelectorAll('[data-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        categoryId = btn.dataset.cat || null
        feedPage = 1
        load()
      })
    })

    bindChipRowScroll(main.querySelector('#neighborhoods'))
    bindChipRowScroll(main.querySelector('#categories'))

    main.querySelector('#feed-pagination')?.addEventListener('click', (event) => {
      const pageInfo = getFeedPage()
      if (event.target.closest('[data-feed-page-prev]') && feedPage > 1) {
        feedPage -= 1
        paint()
        main.querySelector('#feed')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      if (event.target.closest('[data-feed-page-next]') && feedPage < pageInfo.totalPages) {
        feedPage += 1
        paint()
        main.querySelector('#feed')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
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

      allFeedItems = buildHomeFeed(stores, newProducts, likedProducts, feedAds, {
        search,
        categoryId,
      })
      // Garante página válida após filtro que reduz o total de cards
      feedPage = paginateFeedItems(allFeedItems, feedPage, FEED_PAGE_SIZE).page
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