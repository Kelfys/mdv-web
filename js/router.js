/**
 * Roteador SPA — hash (#/rota). 404.html e shells por rota no deploy (GitHub Pages).
 */
import { APP_BASE_PATH, USE_HISTORY_ROUTER } from './config.js'
import { t } from './strings.js'

const routes = new Map()
let currentCleanup = null
let renderEpoch = 0

function normalizeRoutePath(raw) {
  if (!raw || raw === '/') return ''
  let path = String(raw).split('?')[0].replace(/\/$/, '') || '/'
  if (!path.startsWith('/')) path = `/${path}`
  return path === '/' ? '' : path
}

function readHashPath() {
  const rawHash = window.location.hash ?? ''
  if (rawHash) {
    const fromHash = normalizeRoutePath(rawHash.replace(/^#/, ''))
    if (fromHash) return fromHash
    return '/'
  }

  const fromHref = (() => {
    const href = window.location.href ?? ''
    const hashIdx = href.indexOf('#')
    if (hashIdx === -1) return ''
    const pathPart = href.slice(hashIdx + 1)
    const normalized = normalizeRoutePath(pathPart)
    if (normalized) return normalized
    if (pathPart === '' || pathPart === '/') return '/'
    return ''
  })()
  if (fromHref) return fromHref

  const initial = normalizeRoutePath(window.__MV_INITIAL_ROUTE__ ?? '')
  if (initial) return initial

  return ''
}

export function registerRoute(pattern, handler) {
  routes.set(pattern, handler)
}

export function routeHref(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (USE_HISTORY_ROUTER) return `${APP_BASE_PATH}${normalized}`
  return `#${normalized}`
}

export function getCurrentPath() {
  const hashPath = readHashPath()
  if (hashPath && hashPath !== '/') return hashPath

  if (USE_HISTORY_ROUTER) {
    let path = window.location.pathname
    if (APP_BASE_PATH && path.startsWith(APP_BASE_PATH)) {
      path = path.slice(APP_BASE_PATH.length) || '/'
    }
    return path.startsWith('/') ? path : `/${path}`
  }

  return hashPath || '/'
}

export function getHashSection() {
  if (USE_HISTORY_ROUTER) {
    return new URLSearchParams(window.location.search).get('sec')
  }

  const raw = window.location.hash.replace(/^#/, '') || '/'
  const query = raw.split('?')[1] ?? ''
  const fromQuery = new URLSearchParams(query.split('#')[0]).get('sec')
  if (fromQuery) return fromQuery
  const pathPart = raw.split('?')[0]
  const anchorIdx = pathPart.indexOf('#', 1)
  return anchorIdx !== -1 ? pathPart.slice(anchorIdx + 1) : null
}

function matchRoute(path) {
  const normalized = path.replace(/\/$/, '') || '/'
  const ordered = [...routes.entries()].sort((a, b) => b[0].length - a[0].length)

  for (const [pattern, handler] of ordered) {
    const paramNames = []
    const regexStr = pattern.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name)
      return '([^/]+)'
    })
    const regex = new RegExp(`^${regexStr}$`)
    const match = normalized.match(regex)
    if (match) {
      const params = {}
      paramNames.forEach((name, i) => { params[name] = decodeURIComponent(match[i + 1]) })
      return { handler, params, path }
    }
  }
  return null
}

export async function render() {
  const main = document.getElementById('main')
  if (!main) return

  const epoch = ++renderEpoch

  import('./ui.js').then(({ renderHeader }) => renderHeader()).catch(() => {})

  if (currentCleanup) {
    currentCleanup()
    currentCleanup = null
  }

  const matched = matchRoute(getCurrentPath())

  if (!matched) {
    if (epoch !== renderEpoch) return
    main.innerHTML = `<div class="empty-state"><h2>${t('router.notFoundTitle')}</h2><p><a href="${routeHref('/')}">${t('router.notFoundBack')}</a></p></div>`
    return
  }

  main.innerHTML = '<div class="loading"><div class="spinner"></div></div>'

  try {
    const cleanup = await matched.handler(main, matched.params)
    if (epoch !== renderEpoch) return
    if (typeof cleanup === 'function') currentCleanup = cleanup
    window.scrollTo({ top: 0, behavior: 'smooth' })
    import('./home-filters-scroll.js').then(({ resetHomeFiltersScroll }) => resetHomeFiltersScroll()).catch(() => {})
    import('./scroll-to-top.js').then(({ resetScrollToTop }) => resetScrollToTop()).catch(() => {})
    import('./header-scroll.js').then(({ resetHeaderScroll }) => resetHeaderScroll()).catch(() => {})
  } catch (err) {
    if (epoch !== renderEpoch) return
    main.innerHTML = `<div class="empty-state"><h2>Erro ao carregar</h2><p>${err.message}</p></div>`
  }
}

export function navigate(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (USE_HISTORY_ROUTER) {
    const href = `${APP_BASE_PATH}${normalized}`
    if (window.location.pathname !== href) {
      window.history.pushState({}, '', href)
    }
    render()
    return
  }

  const hash = `#${normalized}`
  if (window.location.hash !== hash) {
    window.location.hash = hash
  } else {
    render()
  }
}

function handleLinkClick(event) {
  const link = event.target.closest('a[href^="#/"]')
  if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  navigate(link.getAttribute('href').slice(1))
}

function syncHashFromPath(path) {
  if (!path || path === '/' || USE_HISTORY_ROUTER) return
  const want = `#${path}`
  if (window.location.hash === want) return
  history.replaceState(null, '', `${window.location.pathname}${window.location.search}${want}`)
}

export function initRouter() {
  if (USE_HISTORY_ROUTER) {
    window.addEventListener('popstate', render)
  } else {
    window.addEventListener('hashchange', render)
  }
  document.addEventListener('click', handleLinkClick)
  syncHashFromPath(getCurrentPath())
  render()
}