/**
 * Roteador SPA — History API em produção (GitHub Pages) ou hash em localhost.
 * 404.html + sessionStorage redirecionam rotas diretas para o shell da SPA.
 */
import { APP_BASE_PATH, USE_HISTORY_ROUTER } from './config.js'

const routes = new Map()
let currentCleanup = null

export function registerRoute(pattern, handler) {
  routes.set(pattern, handler)
}

export function routeHref(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (USE_HISTORY_ROUTER) return `${APP_BASE_PATH}${normalized}`
  return `#${normalized}`
}

export function getCurrentPath() {
  if (USE_HISTORY_ROUTER) {
    let path = window.location.pathname
    if (APP_BASE_PATH && path.startsWith(APP_BASE_PATH)) {
      path = path.slice(APP_BASE_PATH.length) || '/'
    }
    return path.startsWith('/') ? path : `/${path}`
  }
  return window.location.hash.replace(/^#/, '') || '/'
}

function matchRoute(path) {
  for (const [pattern, handler] of routes) {
    const paramNames = []
    const regexStr = pattern.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name)
      return '([^/]+)'
    })
    const regex = new RegExp(`^${regexStr}$`)
    const match = path.match(regex)
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

  import('./ui.js').then(({ renderHeader }) => renderHeader()).catch(() => {})

  if (currentCleanup) {
    currentCleanup()
    currentCleanup = null
  }

  const matched = matchRoute(getCurrentPath())

  if (!matched) {
    main.innerHTML = `<div class="empty-state"><h2>Página não encontrada</h2><p><a href="${routeHref('/')}">Voltar ao início</a></p></div>`
    return
  }

  main.innerHTML = '<div class="loading"><div class="spinner"></div></div>'

  try {
    const cleanup = await matched.handler(main, matched.params)
    if (typeof cleanup === 'function') currentCleanup = cleanup
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (err) {
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

export function initRouter() {
  if (USE_HISTORY_ROUTER) {
    window.addEventListener('popstate', render)
  } else {
    window.addEventListener('hashchange', render)
  }
  document.addEventListener('click', handleLinkClick)
  render()
}