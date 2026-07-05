/**
 * Página inicial — feed de lojas com busca e filtro por categoria.
 *
 * Exibe apenas lojas aprovadas com assinatura ativa (marketplaceVisible).
 *
 * Melhorias futuras:
 * - Paginação / scroll infinito no feed
 * - Ordenação (mais recentes, mais visualizadas, por cidade)
 * - Destaques patrocinados (tabela store_ads já existe no schema)
 */
import { fetchCategories, fetchStores } from '../api.js'
import { renderStoreCard } from '../ui.js'
import { escapeHtml } from '../utils.js'

export async function renderHome(main) {
  let search = ''
  let categoryId = null
  let categories = []
  let stores = []

  async function load() {
    const feed = main.querySelector('#feed')
    if (feed) feed.innerHTML = '<div class="loading"><div class="spinner"></div></div>'

    try {
      ;[categories, stores] = await Promise.all([
        fetchCategories(),
        fetchStores({
          search: search || undefined,
          categoryId: categoryId ?? undefined,
          marketplaceVisible: true,
        }),
      ])
      paint()
    } catch (err) {
      main.querySelector('#feed').innerHTML = `
        <div class="empty-state">
          <h2>Erro ao conectar</h2>
          <p>${escapeHtml(err.message)}</p>
        </div>
      `
    }
  }

  function paint() {
    const label = search
      ? `Resultados para "${search}"`
      : categoryId
        ? `Lojas em ${categories.find((c) => c.id === categoryId)?.name ?? ''}`
        : 'Feed de lojas'

    main.innerHTML = `
      <div class="toolbar">
        <div class="container" style="display:flex;flex-direction:column;gap:0.5rem;padding:0.5rem 0">
          <input type="search" class="search-input" id="search" placeholder="Buscar loja por nome ou cidade..." value="${escapeHtml(search)}" />
          <div class="category-scroll" id="categories">
            <button type="button" class="chip ${!categoryId ? 'active' : ''}" data-cat="">Todas</button>
            ${categories.map((c) => `
              <button type="button" class="chip ${categoryId === c.id ? 'active' : ''}" data-cat="${c.id}">${escapeHtml(c.name)}</button>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="container">
        <p class="feed-label">${escapeHtml(label)}</p>
        <div class="feed" id="feed">
          ${stores.length === 0
            ? '<div class="empty-state"><h2>Nenhuma loja encontrada</h2><p>Tente outra categoria ou limpe a busca.</p></div>'
            : stores.map(renderStoreCard).join('')}
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
  }

  paint()
  await load()
}