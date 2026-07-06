/**
 * Paginação e ordenação reutilizáveis para listas do painel.
 */
import { t } from './strings.js'

export function renderPaginationHtml({
  currentPage,
  totalPages,
  matchedCount,
  pageSize,
  labelSingular,
  labelPlural,
  prevAttr = 'data-page-prev',
  nextAttr = 'data-page-next',
}) {
  if (matchedCount === 0) return ''

  const label = matchedCount === 1 ? labelSingular : labelPlural
  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, matchedCount)

  if (totalPages <= 1) {
    return `
      <div class="admin-pagination admin-pagination--single">
        <p class="admin-pagination__info">${matchedCount} ${label}</p>
      </div>`
  }

  return `
    <div class="admin-pagination">
      <p class="admin-pagination__info">${t('pagination.rangeOf', { start, end, count: matchedCount, label })}</p>
      <div class="admin-pagination__controls">
        <button type="button" class="btn btn-outline btn-sm" ${prevAttr} ${currentPage <= 1 ? 'disabled' : ''}>${t('pagination.previous')}</button>
        <span class="admin-pagination__status">${t('pagination.pageStatus', { current: currentPage, total: totalPages })}</span>
        <button type="button" class="btn btn-outline btn-sm" ${nextAttr} ${currentPage >= totalPages ? 'disabled' : ''}>${t('pagination.next')}</button>
      </div>
    </div>`
}

export function bindPaginatedSortableList(main, {
  searchId,
  rowSelector,
  tbodyId,
  emptyRowSelector,
  paginationWrapId,
  sortButtonsSelector,
  pageSize,
  defaultSortField,
  defaultSortDirection,
  sortDefaults,
  getSearchText,
  getFilterValue,
  chipSelector = '[data-filter]',
  sortRow,
  getSortValue,
  scrollTarget,
  prevAttr = 'data-page-prev',
  nextAttr = 'data-page-next',
  onSortButtonUpdate,
}) {
  const search = searchId ? main.querySelector(`#${searchId}`) : null
  const tbody = tbodyId ? main.querySelector(`#${tbodyId}`) : null
  const emptyRow = emptyRowSelector ? main.querySelector(emptyRowSelector) : null
  const paginationWrap = paginationWrapId ? main.querySelector(`#${paginationWrapId}`) : null
  const chips = main.querySelectorAll(chipSelector)
  const sortButtons = main.querySelectorAll(sortButtonsSelector)
  let sortField = defaultSortField
  let sortDirection = defaultSortDirection
  let activeFilter = 'all'
  let currentPage = 1
  let matchedRows = []

  const reorderRows = () => {
    if (!tbody) return
    const anchor = emptyRow ?? null
    for (const row of matchedRows) tbody.insertBefore(row, anchor)
    tbody.querySelectorAll(rowSelector).forEach((row) => {
      if (row.dataset.listMatch !== '1') tbody.insertBefore(row, anchor)
    })
  }

  const applyPagination = () => {
    const totalPages = Math.max(1, Math.ceil(matchedRows.length / pageSize))
    if (currentPage > totalPages) currentPage = totalPages

    matchedRows.forEach((row, index) => {
      const onPage = index >= (currentPage - 1) * pageSize && index < currentPage * pageSize
      row.hidden = !onPage
    })

    if (paginationWrap) {
      paginationWrap.innerHTML = renderPaginationHtml({
        currentPage,
        totalPages,
        matchedCount: matchedRows.length,
        pageSize,
        labelSingular: t('pagination.itemSingular'),
        labelPlural: t('pagination.itemPlural'),
        prevAttr,
        nextAttr,
      })
    }
  }

  const apply = ({ resetPage = false } = {}) => {
    if (resetPage) currentPage = 1

    const rows = main.querySelectorAll(rowSelector)
    const term = search?.value.trim().toLowerCase() ?? ''
    matchedRows = []

    rows.forEach((row) => {
      const matchesSearch = !term || getSearchText(row).includes(term)
      const matchesFilter = !getFilterValue || activeFilter === 'all' || getFilterValue(row) === activeFilter
      const matches = matchesSearch && matchesFilter
      row.dataset.listMatch = matches ? '1' : '0'
      if (matches) matchedRows.push(row)
      else row.hidden = true
    })

    if (sortRow) {
      matchedRows = sortRow(matchedRows, sortField, sortDirection, getSortValue)
      reorderRows()
    }

    if (emptyRow) emptyRow.hidden = matchedRows.length > 0
    applyPagination()
  }

  search?.addEventListener('input', () => apply({ resetPage: true }))
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      activeFilter = chip.dataset.filter ?? chip.dataset.orderStatus ?? 'all'
      chips.forEach((c) => c.classList.toggle('active', c === chip))
      apply({ resetPage: true })
    })
  })

  sortButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const field = button.dataset.sortField
      if (field === sortField) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'
      } else {
        sortField = field
        sortDirection = sortDefaults[field] ?? 'asc'
      }
      onSortButtonUpdate?.(main, sortField, sortDirection)
      apply()
    })
  })

  paginationWrap?.addEventListener('click', (event) => {
    const totalPages = Math.max(1, Math.ceil(matchedRows.length / pageSize))
    if (event.target.closest(`[${prevAttr}]`) && currentPage > 1) {
      currentPage--
      applyPagination()
      scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    if (event.target.closest(`[${nextAttr}]`) && currentPage < totalPages) {
      currentPage++
      applyPagination()
      scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  })

  onSortButtonUpdate?.(main, sortField, sortDirection)
  apply()

  return { apply, getMatchedRows: () => matchedRows }
}