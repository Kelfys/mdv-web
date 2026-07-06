/** Página de lojas favoritas do cliente logado. */
import { fetchFavorites } from '../api.js'
import { getUser } from '../state.js'
import { renderStoreCard } from '../ui.js'

export async function renderFavorites(main) {
  const user = getUser()
  if (!user || user.role !== 'customer') {
    main.innerHTML = `
      <div class="empty-state">
        <h2>Faça login</h2>
        <p>Entre na sua conta para ver lojas favoritas.</p>
        <a href="#/conta/entrar?redirect=/favoritos" class="btn btn-primary">Entrar</a>
      </div>
    `
    return
  }

  const stores = await fetchFavorites(user.id)

  main.innerHTML = `
    <div class="container" style="padding:1.5rem 1rem 3rem">
      <h1 style="font-size:1.5rem;margin-bottom:1.5rem">Favoritos</h1>
      ${stores.length === 0
        ? '<div class="empty-state"><h2>Nenhum favorito</h2><p>Explore lojas e favorite as que mais gostar.</p><a href="#/" class="btn btn-primary">Ver lojas</a></div>'
        : `<div class="feed">${stores.map(renderStoreCard).join('')}</div>`}
    </div>
  `
}