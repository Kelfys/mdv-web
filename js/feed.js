/**
 * Algoritmo do feed da home — ranking de lojas, produtos e anúncios patrocinados.
 *
 * Score por plano da loja, curtidas, novidade, busca e rotação diária.
 * Anúncios aprovados entram a cada N slots; diversidade entre lojas no mix.
 */
import { getPlanFeedWeight } from './plans.js'
import { getProductEngagementWeight } from './utils.js'

const STORE_NEW_DAYS = 30
const STORE_NEW_BOOST = 0.35
const SEARCH_MATCH_BOOST = 2
const CATEGORY_MATCH_BOOST = 1.5
const PLAN_PRODUCT_BOOST = 0.15
const AD_INTERVAL = 5

export function getProductStoreId(product) {
  return product.store_id ?? product.store?.id ?? null
}

function dayBucket(now = Date.now()) {
  return Math.floor(now / (1000 * 60 * 60 * 24))
}

function rotationJitter(id, bucket) {
  let hash = bucket
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return (hash % 97) / 1000
}

export function getStoreFeedScore(store, { search = '', categoryId = null, now = Date.now() } = {}) {
  let score = getPlanFeedWeight(store.plan_id)
  const ageDays = (now - new Date(store.created_at).getTime()) / (1000 * 60 * 60 * 24)
  if (ageDays < STORE_NEW_DAYS) score += STORE_NEW_BOOST * (1 - ageDays / STORE_NEW_DAYS)

  if (categoryId && store.category_id === categoryId) score += CATEGORY_MATCH_BOOST

  const term = search.trim().toLowerCase()
  if (term) {
    const haystack = `${store.name} ${store.city ?? ''} ${store.category?.name ?? ''}`.toLowerCase()
    if (haystack.includes(term)) score += SEARCH_MATCH_BOOST
  }

  score += rotationJitter(store.id, dayBucket(now))
  return score
}

export function getProductFeedScore(product, { search = '', now = Date.now() } = {}) {
  let score = getProductEngagementWeight(product, now)
  const planWeight = getPlanFeedWeight(product.store?.plan_id)
  if (planWeight > 1) score += (planWeight - 1) * PLAN_PRODUCT_BOOST

  const term = search.trim().toLowerCase()
  if (term) {
    const haystack = [
      product.name,
      product.description,
      product.store?.name,
      product.store?.city,
    ].filter(Boolean).join(' ').toLowerCase()
    if (haystack.includes(term)) score += SEARCH_MATCH_BOOST
  }

  score += rotationJitter(product.id, dayBucket(now))
  return score
}

export function rankStoresForFeed(stores, options = {}) {
  return [...(stores ?? [])].sort((a, b) => {
    const diff = getStoreFeedScore(b, options) - getStoreFeedScore(a, options)
    if (diff !== 0) return diff
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export function rankProductsForFeed(products, options = {}) {
  const now = options.now ?? Date.now()
  return [...(products ?? [])].sort((a, b) => {
    const diff = getProductFeedScore(b, { ...options, now }) - getProductFeedScore(a, { ...options, now })
    if (diff !== 0) return diff
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

function productBadge(product, now = Date.now()) {
  const ageDays = (now - new Date(product.created_at).getTime()) / (1000 * 60 * 60 * 24)
  if (ageDays <= 14) return 'new'
  if ((product.likes_count ?? 0) > 0) return 'liked'
  return 'pick'
}

function pickProduct(pool, { seenIds, avoidStoreId = null }) {
  for (let i = 0; i < pool.length; i++) {
    const product = pool[i]
    if (seenIds.has(product.id)) continue
    if (avoidStoreId && getProductStoreId(product) === avoidStoreId) continue
    seenIds.add(product.id)
    pool.splice(i, 1)
    return product
  }

  for (let i = 0; i < pool.length; i++) {
    const product = pool[i]
    if (seenIds.has(product.id)) continue
    seenIds.add(product.id)
    pool.splice(i, 1)
    return product
  }

  return null
}

function takeAd(ads, seenAdIds) {
  while (ads.length > 0) {
    const ad = ads.shift()
    if (!seenAdIds.has(ad.id)) {
      seenAdIds.add(ad.id)
      return ad
    }
  }
  return null
}

/**
 * Monta feed com prioridade de plano, engajamento, diversidade de lojas e anúncios.
 */
export function buildHomeFeed(stores, newProducts, likedProducts, ads = [], options = {}) {
  const now = options.now ?? Date.now()
  const rankedStores = rankStoresForFeed(stores, options)
  const mergedProducts = rankProductsForFeed(
    [...(newProducts ?? []), ...(likedProducts ?? [])]
      .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i),
    options,
  )

  const productPool = [...mergedProducts]
  const adPool = [...(ads ?? [])].sort(
    (a, b) => getPlanFeedWeight(b.store?.plan_id) - getPlanFeedWeight(a.store?.plan_id),
  )
  const seenProductIds = new Set()
  const seenAdIds = new Set()
  const items = []
  let lastProductStoreId = null
  let slotsSinceAd = 0

  const pushAd = () => {
    const ad = takeAd(adPool, seenAdIds)
    if (ad) {
      items.push({ kind: 'ad', ad })
      slotsSinceAd = 0
    }
  }

  if (adPool.length > 0) pushAd()

  rankedStores.forEach((store, index) => {
    items.push({ kind: 'store', store })
    slotsSinceAd++

    const product = pickProduct(productPool, {
      seenIds: seenProductIds,
      avoidStoreId: lastProductStoreId,
    }) ?? pickProduct(productPool, { seenIds: seenProductIds })

    if (product) {
      items.push({
        kind: 'product',
        product,
        badge: productBadge(product, now),
      })
      lastProductStoreId = getProductStoreId(product)
      slotsSinceAd++
    }

    if ((index + 1) % 2 === 0) {
      const extra = pickProduct(productPool, {
        seenIds: seenProductIds,
        avoidStoreId: lastProductStoreId,
      })
      if (extra) {
        items.push({ kind: 'product', product: extra, badge: productBadge(extra, now) })
        lastProductStoreId = getProductStoreId(extra)
        slotsSinceAd++
      }
    }

    if (slotsSinceAd >= AD_INTERVAL) pushAd()
  })

  let product = pickProduct(productPool, { seenIds: seenProductIds, avoidStoreId: lastProductStoreId })
  while (product) {
    items.push({ kind: 'product', product, badge: productBadge(product, now) })
    lastProductStoreId = getProductStoreId(product)
    slotsSinceAd++
    if (slotsSinceAd >= AD_INTERVAL) pushAd()
    product = pickProduct(productPool, { seenIds: seenProductIds, avoidStoreId: lastProductStoreId })
  }

  return items
}