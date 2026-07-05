/**
 * Roteador SPA baseado em hash (#/caminho).
 *
 * Cada rota registra um handler async que recebe (mainElement, params).
 * Handlers podem retornar uma função de cleanup executada ao trocar de rota.
 *
 * Melhorias futuras:
 * - Suporte a query strings na rota (hoje só auth.js faz parse manual)
 * - Guards de autenticação centralizados (hoje cada página valida sozinha)
 * - Scroll-to-top automático após navegação
 */
const routes = new Map()
let currentCleanup = null

export function registerRoute(pattern, handler) {
  routes.set(pattern, handler)
}

export function navigate(path) {
  const hash = path.startsWith('#') ? path : `#${path}`
  if (window.location.hash !== hash) {
    window.location.hash = hash.slice(1)
  } else {
    render()
  }
}

function matchRoute(hash) {
  const path = hash.replace(/^#/, '') || '/'

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

  if (currentCleanup) {
    currentCleanup()
    currentCleanup = null
  }

  const hash = window.location.hash || '#/'
  const matched = matchRoute(hash)

  if (!matched) {
    main.innerHTML = '<div class="empty-state"><h2>Página não encontrada</h2><p><a href="#/">Voltar ao início</a></p></div>'
    return
  }

  main.innerHTML = '<div class="loading"><div class="spinner"></div></div>'

  try {
    const cleanup = await matched.handler(main, matched.params)
    if (typeof cleanup === 'function') currentCleanup = cleanup
  } catch (err) {
    main.innerHTML = `<div class="empty-state"><h2>Erro ao carregar</h2><p>${err.message}</p></div>`
  }
}

export function initRouter() {
  window.addEventListener('hashchange', render)
  render()
}

export function getCurrentPath() {
  return window.location.hash.replace(/^#/, '') || '/'
}