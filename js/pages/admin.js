/**
 * Painéis admin e moderador — conteúdo dinâmico; navegação no header.
 */
import {
  fetchAdminMetrics, fetchAdminOrdersAnalytics, fetchAdminOrders,
  buildOrderPeriodSeries, getOrderPeriodCutoff,
  fetchPendingStoreApprovals,
  approveStoreRegistration, rejectStoreRegistration,
  fetchPendingPlanChangeRequests, approvePlanChangeRequest, rejectPlanChangeRequest,
  setModeratorPlanApprovalPermission,
  updatePassword, updateEmail, fetchMerchants, fetchModerators, promoteUserToModerator, demoteModerator,
  fetchAllStoresAdmin,
  fetchAdminProducts, createStoreAsAdmin, createProduct, updateProduct,
  updateStoreAsAdmin, deleteProduct, fetchCategories,
} from '../api.js'
import { getUser, setAdminPendingCount } from '../state.js'
import { navigate } from '../router.js'
import {
  escapeHtml, formatDate, formatCurrency, showToast,
  formatDateTimeCsv, buildCsv, downloadTextFile, validateInstagramHandle,
} from '../utils.js'
import { STORE_THEME_COLORS } from '../config.js'
import { STAFF_PANELS, staffHref, getStaffMenuItem } from '../staff-nav.js'
import { canAccessPanel, isReadOnlyStaffTab, canApprovePlanChanges } from '../roles.js'
import {
  planAllowsStoreBranding, FREE_PLAN_BRANDING_MESSAGE,
  countProductsWithImages, canAddProductImage, canCreateProduct,
  planProductImageLimitMessage, planProductLimitMessage,
  formatProductLimitHint, formatProductImageLimitHint,
  getPlanById,
} from '../plans.js'
import {
  PRODUCT_IMAGE_UPLOAD_HINT, STORE_BRANDING_UPLOAD_HINT,
  validateImageFile, STORAGE_BUCKETS,
} from '../uploads.js'
import {
  isService, getCatalogItemIcon, getCatalogItemLabel,
  catalogItemTypeFieldHtml, catalogStockFieldHtml, bindCatalogItemTypeForm, readCatalogItemForm,
} from '../catalog.js'

function guardStaff(main, panel = 'admin') {
  const user = getUser()
  const panelConfig = STAFF_PANELS[panel]
  if (!canAccessPanel(user, panel)) {
    main.innerHTML = `<div class="empty-state"><h2>Acesso restrito</h2><p><a href="#${panelConfig.loginPath}">Entrar no ${escapeHtml(panelConfig.label.toLowerCase())}</a></p></div>`
    return null
  }
  return user
}

async function loadStaffApprovalQueue(user) {
  const pendingStores = await fetchPendingStoreApprovals()
  const planRequests = canApprovePlanChanges(user)
    ? await fetchPendingPlanChangeRequests()
    : []
  return {
    pendingStores,
    planRequests,
    pendingTotal: pendingStores.length + planRequests.length,
  }
}

function renderPlanChangeApprovalCards(requests) {
  if (requests.length === 0) return ''

  return `
    <section class="admin-section">
      <div class="admin-section__head">
        <h2>Pedidos de mudança de plano</h2>
        <span class="admin-stat-chip admin-stat-chip--pending">${requests.length} pendente${requests.length === 1 ? '' : 's'}</span>
      </div>
      <div class="admin-cards-list">
        ${requests.map((r) => `
          <article class="admin-approval-card">
            <div class="admin-approval-card__head">
              <div>
                <h3>${escapeHtml(r.store?.name ?? 'Loja')}</h3>
                <p>${escapeHtml(getPlanById(r.current_plan_id).name)} → <strong>${escapeHtml(getPlanById(r.requested_plan_id).name)}</strong> · ${formatDate(r.created_at)}</p>
              </div>
              <span class="badge badge-pending">Plano</span>
            </div>
            <dl class="admin-approval-card__details">
              <div><dt>Lojista</dt><dd>${escapeHtml(r.store?.owner?.name ?? '—')}</dd></div>
              <div><dt>Email</dt><dd>${escapeHtml(r.store?.owner?.email ?? '—')}</dd></div>
              <div><dt>Cidade</dt><dd>${escapeHtml(r.store?.city ?? '—')}, ${escapeHtml(r.store?.state ?? '—')}</dd></div>
            </dl>
            <div class="admin-approval-card__actions">
              <button type="button" class="btn btn-primary btn-sm" data-approve-plan-request="${r.id}">Aprovar plano</button>
              <button type="button" class="btn btn-outline btn-sm" data-reject-plan-request="${r.id}">Rejeitar</button>
            </div>
          </article>
        `).join('')}
      </div>
    </section>`
}

function rerenderStaff(main, tab, selectedStoreId = null) {
  return renderStaffDashboard(main, tab, selectedStoreId, main.dataset.staffPanel || 'admin')
}

function adminPage(title, subtitle, content, actions = '', panel = 'admin') {
  const panelConfig = STAFF_PANELS[panel]
  return `
    <div class="admin-page">
      <div class="admin-page__head">
        <div class="admin-page__head-main">
          <p class="admin-page__eyebrow">${escapeHtml(panelConfig.label)}</p>
          <h1 class="admin-page__title">${escapeHtml(title)}</h1>
          ${subtitle ? `<p class="admin-page__subtitle">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        ${actions ? `<div class="admin-page__actions">${actions}</div>` : ''}
      </div>
      <div class="admin-page__body admin-fade-in">${content}</div>
    </div>
  `
}

function adminEmptyState(icon, title, text, actionHtml = '') {
  return `
    <div class="admin-empty">
      <span class="admin-empty__icon">${icon}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${text}</p>
      ${actionHtml}
    </div>`
}

function storeStatusSummary(stores) {
  const counts = { approved: 0, pending: 0, blocked: 0 }
  for (const store of stores) counts[store.status] = (counts[store.status] ?? 0) + 1

  return `
    <div class="admin-stat-chips">
      <span class="admin-stat-chip admin-stat-chip--approved">${counts.approved} aprovadas</span>
      <span class="admin-stat-chip admin-stat-chip--pending">${counts.pending} pendentes</span>
      <span class="admin-stat-chip admin-stat-chip--blocked">${counts.blocked} bloqueadas</span>
    </div>`
}

function adminFilterBar({ searchId, searchPlaceholder, chips }) {
  return `
    <div class="admin-filter-bar">
      <input type="search" class="form-input admin-filter-bar__search" id="${searchId}" placeholder="${escapeHtml(searchPlaceholder)}" autocomplete="off" />
      <div class="admin-filter-chips" role="group">
        ${chips.map((c) => `
          <button type="button" class="admin-filter-chip ${c.active ? 'active' : ''}" data-filter="${c.id}">${escapeHtml(c.label)}</button>
        `).join('')}
      </div>
    </div>`
}

function storesFromOrders(orders) {
  const map = new Map()
  for (const order of orders) {
    const store = order.store
    if (store?.id) map.set(store.id, store)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

function adminOrdersFilterBar(stores) {
  return `
    <div class="admin-orders-filters">
      <input
        type="search"
        class="form-input admin-filter-bar__search"
        id="admin-orders-search"
        placeholder="Buscar cliente, telefone ou loja..."
        autocomplete="off"
      />
      <div class="admin-orders-filters__groups">
        <div class="admin-filter-group admin-filter-group--store">
          <label class="admin-filter-group__label" for="admin-orders-store">Loja</label>
          <select class="form-input admin-orders-store-select" id="admin-orders-store">
            <option value="all">Todas as lojas</option>
            ${stores.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="admin-filter-group">
          <span class="admin-filter-group__label">Status</span>
          <div class="admin-filter-chips" role="group">
            <button type="button" class="admin-filter-chip active" data-order-status="all">Todos</button>
            <button type="button" class="admin-filter-chip" data-order-status="sent">Enviados</button>
            <button type="button" class="admin-filter-chip" data-order-status="viewed">Visualizados</button>
            <button type="button" class="admin-filter-chip" data-order-status="pending">Pendentes</button>
          </div>
        </div>
        <div class="admin-filter-group">
          <span class="admin-filter-group__label">Período</span>
          <div class="admin-filter-chips" role="group">
            <button type="button" class="admin-filter-chip active" data-order-period="all">Todos</button>
            <button type="button" class="admin-filter-chip" data-order-period="7d">7 dias</button>
            <button type="button" class="admin-filter-chip" data-order-period="30d">30 dias</button>
            <button type="button" class="admin-filter-chip" data-order-period="12m">12 meses</button>
          </div>
        </div>
      </div>
    </div>`
}

const ORDERS_PAGE_SIZE = 20

function sortOrderRowsByDate(rows, direction = 'desc') {
  return [...rows].sort((a, b) => {
    const diff = new Date(a.dataset.orderCreated).getTime() - new Date(b.dataset.orderCreated).getTime()
    return direction === 'asc' ? diff : -diff
  })
}

function reorderOrderRowsInDom(tbody, matchedRows, emptyRow) {
  if (!tbody) return
  const anchor = emptyRow ?? null
  for (const row of matchedRows) tbody.insertBefore(row, anchor)
  tbody.querySelectorAll('[data-order-row]').forEach((row) => {
    if (row.dataset.orderMatch !== '1') tbody.insertBefore(row, anchor)
  })
}

function updateOrdersSortButton(button, direction) {
  if (!button) return
  button.dataset.orderSort = direction
  button.classList.toggle('active', true)
  const icon = button.querySelector('.admin-table-sort__icon')
  if (icon) icon.textContent = direction === 'asc' ? '↑' : '↓'
  button.setAttribute(
    'aria-label',
    direction === 'asc' ? 'Ordenar por data, mais antigos primeiro' : 'Ordenar por data, mais recentes primeiro',
  )
}

function renderOrdersPaginationHtml({ currentPage, totalPages, matchedCount }) {
  if (matchedCount === 0) return ''

  const start = (currentPage - 1) * ORDERS_PAGE_SIZE + 1
  const end = Math.min(currentPage * ORDERS_PAGE_SIZE, matchedCount)

  if (totalPages <= 1) {
    return `
      <div class="admin-pagination admin-pagination--single">
        <p class="admin-pagination__info">${matchedCount} pedido${matchedCount === 1 ? '' : 's'}</p>
      </div>`
  }

  return `
    <div class="admin-pagination">
      <p class="admin-pagination__info">${start}–${end} de ${matchedCount} pedido${matchedCount === 1 ? '' : 's'}</p>
      <div class="admin-pagination__controls">
        <button type="button" class="btn btn-outline btn-sm" data-page-prev ${currentPage <= 1 ? 'disabled' : ''}>← Anterior</button>
        <span class="admin-pagination__status">Página ${currentPage} de ${totalPages}</span>
        <button type="button" class="btn btn-outline btn-sm" data-page-next ${currentPage >= totalPages ? 'disabled' : ''}>Próxima →</button>
      </div>
    </div>`
}

function bindOrdersListFilters(main) {
  const search = main.querySelector('#admin-orders-search')
  const storeSelect = main.querySelector('#admin-orders-store')
  const sortButton = main.querySelector('#admin-orders-sort')
  const statusChips = main.querySelectorAll('[data-order-status]')
  const periodChips = main.querySelectorAll('[data-order-period]')
  const tbody = main.querySelector('#admin-orders-tbody')
  const emptyRow = main.querySelector('[data-orders-empty]')
  const paginationWrap = main.querySelector('#admin-orders-pagination-wrap')
  let activeStatus = 'all'
  let activePeriod = 'all'
  let sortDirection = sortButton?.dataset.orderSort ?? 'desc'
  let currentPage = 1
  let matchedRows = []

  const applyPagination = () => {
    const totalPages = Math.max(1, Math.ceil(matchedRows.length / ORDERS_PAGE_SIZE))
    if (currentPage > totalPages) currentPage = totalPages

    matchedRows.forEach((row, index) => {
      const onPage = index >= (currentPage - 1) * ORDERS_PAGE_SIZE && index < currentPage * ORDERS_PAGE_SIZE
      row.hidden = !onPage
    })

    if (paginationWrap) {
      paginationWrap.innerHTML = renderOrdersPaginationHtml({
        currentPage,
        totalPages,
        matchedCount: matchedRows.length,
      })
    }
  }

  const apply = ({ resetPage = false } = {}) => {
    if (resetPage) currentPage = 1

    const term = search?.value.trim().toLowerCase() ?? ''
    const activeStore = storeSelect?.value ?? 'all'
    const cutoff = getOrderPeriodCutoff(activePeriod)
    const rows = main.querySelectorAll('[data-order-row]')
    matchedRows = []

    rows.forEach((row) => {
      const matchesSearch = !term || (row.dataset.orderSearch ?? '').includes(term)
      const matchesStore = activeStore === 'all' || row.dataset.orderStoreId === activeStore
      const matchesStatus = activeStatus === 'all' || row.dataset.orderStatus === activeStatus
      const orderDate = new Date(row.dataset.orderCreated)
      const matchesPeriod = !cutoff || orderDate >= cutoff
      const matches = matchesSearch && matchesStore && matchesStatus && matchesPeriod
      row.dataset.orderMatch = matches ? '1' : '0'
      if (matches) matchedRows.push(row)
      else row.hidden = true
    })

    matchedRows = sortOrderRowsByDate(matchedRows, sortDirection)
    reorderOrderRowsInDom(tbody, matchedRows, emptyRow)

    if (emptyRow) emptyRow.hidden = matchedRows.length > 0
    applyPagination()
  }

  search?.addEventListener('input', () => apply({ resetPage: true }))
  storeSelect?.addEventListener('change', () => apply({ resetPage: true }))
  statusChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      activeStatus = chip.dataset.orderStatus
      statusChips.forEach((c) => c.classList.toggle('active', c === chip))
      apply({ resetPage: true })
    })
  })
  periodChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      activePeriod = chip.dataset.orderPeriod
      periodChips.forEach((c) => c.classList.toggle('active', c === chip))
      apply({ resetPage: true })
    })
  })

  sortButton?.addEventListener('click', () => {
    sortDirection = sortDirection === 'desc' ? 'asc' : 'desc'
    updateOrdersSortButton(sortButton, sortDirection)
    apply()
  })

  paginationWrap?.addEventListener('click', (event) => {
    const totalPages = Math.max(1, Math.ceil(matchedRows.length / ORDERS_PAGE_SIZE))
    if (event.target.closest('[data-page-prev]') && currentPage > 1) {
      currentPage--
      applyPagination()
      main.querySelector('.admin-orders-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    if (event.target.closest('[data-page-next]') && currentPage < totalPages) {
      currentPage++
      applyPagination()
      main.querySelector('.admin-orders-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  })

  updateOrdersSortButton(sortButton, sortDirection)
  apply()
}

function bindListFilters(main, {
  searchId, rowSelector, getSearchText, getFilterValue,
  chipSelector = '[data-filter]', linkedEditPrefix = null,
}) {
  const search = main.querySelector(`#${searchId}`)
  const chips = main.querySelectorAll(chipSelector)
  const rows = main.querySelectorAll(rowSelector)
  let activeFilter = 'all'

  const apply = () => {
    const term = search?.value.trim().toLowerCase() ?? ''
    rows.forEach((row) => {
      const matchesSearch = !term || getSearchText(row).includes(term)
      const matchesFilter = activeFilter === 'all' || getFilterValue(row) === activeFilter
      const visible = matchesSearch && matchesFilter
      row.hidden = !visible
      if (linkedEditPrefix && row.dataset.storeId) {
        const editRow = main.querySelector(`#${linkedEditPrefix}${row.dataset.storeId}`)
        if (editRow && !visible) editRow.hidden = true
      }
    })
  }

  search?.addEventListener('input', apply)
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      activeFilter = chip.dataset.filter
      chips.forEach((c) => c.classList.toggle('active', c === chip))
      apply()
    })
  })
}

function statusBadge(status) {
  const map = {
    pending: '<span class="badge badge-pending">Pendente</span>',
    approved: '<span class="badge badge-approved">Aprovada</span>',
    blocked: '<span class="badge badge-blocked">Bloqueada</span>',
  }
  return map[status] ?? escapeHtml(status)
}

const ORDER_STATUS_LABELS = {
  pending: 'Pendente',
  sent: 'Enviado',
  viewed: 'Visualizado',
}

function orderStatusBadge(status) {
  const map = {
    pending: '<span class="badge badge-order-pending">Pendente</span>',
    sent: '<span class="badge badge-order-sent">Enviado</span>',
    viewed: '<span class="badge badge-order-viewed">Visualizado</span>',
  }
  return map[status] ?? escapeHtml(status)
}

function ordersToCsv(orders) {
  const headers = ['Data', 'Loja', 'Cidade', 'UF', 'Cliente', 'Telefone', 'Endereço', 'Total (R$)', 'Status', 'ID']
  const rows = orders.map((o) => [
    formatDateTimeCsv(o.created_at),
    o.store?.name ?? '',
    o.store?.city ?? '',
    o.store?.state ?? '',
    o.customer_name,
    o.customer_phone,
    o.customer_address ?? '',
    Number(o.total).toFixed(2),
    ORDER_STATUS_LABELS[o.status] ?? o.status,
    o.id,
  ])
  return buildCsv(headers, rows)
}

function bindOrdersCsvExport(main, orders) {
  const btn = main.querySelector('#admin-orders-export')
  if (!btn) return

  btn.addEventListener('click', () => {
    const orderMap = new Map(orders.map((o) => [o.id, o]))
    const toExport = [...main.querySelectorAll('[data-order-row]')]
      .filter((row) => row.dataset.orderMatch === '1')
      .map((row) => orderMap.get(row.dataset.orderId))
      .filter(Boolean)
    if (toExport.length === 0) {
      showToast('Nenhum pedido para exportar')
      return
    }

    const date = new Date().toISOString().slice(0, 10)
    downloadTextFile(`pedidos-${date}.csv`, ordersToCsv(toExport))
    showToast(`${toExport.length} pedido(s) exportado(s)`)
  })
}

function orderMetricsChips(metrics) {
  return `
    <div class="admin-order-metrics">
      <div class="admin-order-metric">
        <span class="admin-order-metric__value">${metrics.totalOrders}</span>
        <span class="admin-order-metric__label">Total de pedidos</span>
      </div>
      <div class="admin-order-metric admin-order-metric--highlight">
        <span class="admin-order-metric__value">${formatCurrency(metrics.totalRevenue)}</span>
        <span class="admin-order-metric__label">Receita acumulada</span>
      </div>
      <div class="admin-order-metric">
        <span class="admin-order-metric__value">${metrics.ordersToday}</span>
        <span class="admin-order-metric__label">Hoje</span>
      </div>
      <div class="admin-order-metric">
        <span class="admin-order-metric__value">${metrics.ordersWeek}</span>
        <span class="admin-order-metric__label">Últimos 7 dias</span>
      </div>
    </div>
    <div class="admin-stat-chips" style="margin-top:0.75rem">
      <span class="admin-stat-chip admin-stat-chip--sent">${metrics.byStatus.sent} enviados</span>
      <span class="admin-stat-chip admin-stat-chip--viewed">${metrics.byStatus.viewed} visualizados</span>
      <span class="admin-stat-chip admin-stat-chip--order-pending">${metrics.byStatus.pending} pendentes</span>
    </div>`
}

function formatChartValue(value, metric) {
  return metric === 'revenue' ? formatCurrency(value) : String(value)
}

function renderOrdersChartPlot(series, metric = 'orders') {
  const max = Math.max(...series.map((b) => (metric === 'orders' ? b.orders : b.revenue)), 1)

  return `
    <div class="admin-chart__plot">
      ${series.map((bucket) => {
        const value = metric === 'orders' ? bucket.orders : bucket.revenue
        const height = Math.round((value / max) * 100)
        const tooltip = metric === 'orders'
          ? `${bucket.label}: ${value} pedido${value === 1 ? '' : 's'}`
          : `${bucket.label}: ${formatCurrency(value)}`
        return `
          <div class="admin-chart__column">
            <span class="admin-chart__value">${value > 0 ? formatChartValue(value, metric) : ''}</span>
            <div class="admin-chart__bar-track" title="${escapeHtml(tooltip)}">
              <div class="admin-chart__bar ${metric === 'revenue' ? 'admin-chart__bar--revenue' : ''}" style="height: ${height}%"></div>
            </div>
            <span class="admin-chart__label">${escapeHtml(bucket.label)}</span>
          </div>`
      }).join('')}
    </div>`
}

function renderOrdersChart(series, { period = '30d', metric = 'orders', compact = false } = {}) {
  const totalOrders = series.reduce((sum, b) => sum + b.orders, 0)
  const totalRevenue = series.reduce((sum, b) => sum + b.revenue, 0)

  return `
    <section class="admin-chart-panel ${compact ? 'admin-chart-panel--compact' : ''}">
      <div class="admin-chart-panel__head">
        <div>
          <h3>Pedidos por período</h3>
          <p class="admin-chart-panel__summary">
            ${totalOrders} pedido${totalOrders === 1 ? '' : 's'} · ${formatCurrency(totalRevenue)} no período
          </p>
        </div>
        ${compact ? '' : `
          <div class="admin-chart-panel__controls">
            <div class="admin-filter-chips" role="group" data-chart-period-group>
              <button type="button" class="admin-filter-chip ${period === '7d' ? 'active' : ''}" data-chart-period="7d">7 dias</button>
              <button type="button" class="admin-filter-chip ${period === '30d' ? 'active' : ''}" data-chart-period="30d">30 dias</button>
              <button type="button" class="admin-filter-chip ${period === '12m' ? 'active' : ''}" data-chart-period="12m">12 meses</button>
            </div>
            <div class="admin-filter-chips" role="group" data-chart-metric-group>
              <button type="button" class="admin-filter-chip ${metric === 'orders' ? 'active' : ''}" data-chart-metric="orders">Pedidos</button>
              <button type="button" class="admin-filter-chip ${metric === 'revenue' ? 'active' : ''}" data-chart-metric="revenue">Receita</button>
            </div>
          </div>`}
      </div>
      <div class="admin-chart" id="admin-orders-chart-body" role="img" aria-label="Gráfico de pedidos por período">
        ${renderOrdersChartPlot(series, metric)}
      </div>
    </section>`
}

function updateOrdersChart(main, timeline, period, metric) {
  const series = buildOrderPeriodSeries(timeline, period)
  const body = main.querySelector('#admin-orders-chart-body')
  const summary = main.querySelector('.admin-chart-panel__summary')
  if (!body) return

  const totalOrders = series.reduce((sum, b) => sum + b.orders, 0)
  const totalRevenue = series.reduce((sum, b) => sum + b.revenue, 0)

  if (summary) {
    summary.textContent = `${totalOrders} pedido${totalOrders === 1 ? '' : 's'} · ${formatCurrency(totalRevenue)} no período`
  }

  body.innerHTML = renderOrdersChartPlot(series, metric)
}

function bindOrdersChart(main, timeline) {
  if (!main.querySelector('[data-chart-period]')) return

  let period = main.querySelector('[data-chart-period].active')?.dataset.chartPeriod ?? '30d'
  let metric = main.querySelector('[data-chart-metric].active')?.dataset.chartMetric ?? 'orders'

  main.querySelectorAll('[data-chart-period]').forEach((btn) => {
    btn.addEventListener('click', () => {
      period = btn.dataset.chartPeriod
      main.querySelectorAll('[data-chart-period]').forEach((b) => b.classList.toggle('active', b === btn))
      updateOrdersChart(main, timeline, period, metric)
    })
  })

  main.querySelectorAll('[data-chart-metric]').forEach((btn) => {
    btn.addEventListener('click', () => {
      metric = btn.dataset.chartMetric
      main.querySelectorAll('[data-chart-metric]').forEach((b) => b.classList.toggle('active', b === btn))
      updateOrdersChart(main, timeline, period, metric)
    })
  })
}

function renderAdminOrderRows(orders, { compact = false } = {}) {
  const emptyColspan = compact ? 5 : 6
  if (orders.length === 0) {
    return `<tr><td colspan="${emptyColspan}">Nenhum pedido registrado</td></tr>`
  }

  return orders.map((o) => `
    <tr
      data-order-row
      data-order-id="${escapeHtml(o.id)}"
      data-order-store-id="${escapeHtml(o.store_id ?? o.store?.id ?? '')}"
      data-order-status="${escapeHtml(o.status)}"
      data-order-created="${escapeHtml(o.created_at)}"
      data-order-search="${escapeHtml(`${o.customer_name} ${o.customer_phone} ${o.store?.name ?? ''} ${o.store?.city ?? ''}`.toLowerCase())}"
    >
      <td>${formatDate(o.created_at)}</td>
      <td>
        <strong>${escapeHtml(o.store?.name ?? '—')}</strong>
        ${o.store?.city ? `<br><small>${escapeHtml(o.store.city)}, ${escapeHtml(o.store.state ?? '')}</small>` : ''}
      </td>
      <td>${escapeHtml(o.customer_name)}${compact && o.customer_phone ? `<br><small>${escapeHtml(o.customer_phone)}</small>` : ''}</td>
      ${compact ? '' : `<td>${escapeHtml(o.customer_phone)}</td>`}
      <td><strong>${formatCurrency(o.total)}</strong></td>
      <td>${orderStatusBadge(o.status)}</td>
    </tr>
  `).join('')
}

function imagePreviewBlock(url, alt, variant = 'square') {
  if (!url) {
    return `<div class="admin-image-preview admin-image-preview--empty admin-image-preview--${variant}">Sem imagem</div>`
  }
  return `<img class="admin-image-preview admin-image-preview--${variant}" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" />`
}

function bindImagePreview(input, previewEl) {
  if (!input || !previewEl) return
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      previewEl.innerHTML = `<img class="admin-image-preview" src="${reader.result}" alt="Prévia" />`
    }
    reader.readAsDataURL(file)
  })
}

function storeBrandingFieldsHtml(planId, store = null) {
  const id = store?.id ?? ''
  const allowed = planAllowsStoreBranding(planId)

  if (!allowed) {
    return `
      <div class="form-group admin-form-grid__full" data-branding-locked>
        <p class="form-hint form-hint--info">${escapeHtml(FREE_PLAN_BRANDING_MESSAGE)}</p>
      </div>`
  }

  return `
    <div class="form-group" data-branding-field>
      <label class="form-label">Logo</label>
      ${store
        ? `<div class="admin-image-field">
            <div data-preview-logo="${id}">${imagePreviewBlock(store.logo, store.name, 'square')}</div>
            <input class="form-input" type="file" name="logo" accept="image/*" />
          </div>
          ${store.logo ? `<label class="admin-check"><input type="checkbox" name="remove_logo" /> Remover logo atual</label>` : ''}`
        : `<input class="form-input" type="file" name="logo" accept="image/*" />
           <small class="form-hint">${STORE_BRANDING_UPLOAD_HINT}</small>`}
    </div>
    <div class="form-group admin-form-grid__full" data-branding-field>
      <label class="form-label">Banner</label>
      ${store
        ? `<div class="admin-image-field">
            <div data-preview-banner="${id}">${imagePreviewBlock(store.banner, store.name, 'banner')}</div>
            <input class="form-input" type="file" name="banner" accept="image/*" />
          </div>
          ${store.banner ? `<label class="admin-check"><input type="checkbox" name="remove_banner" /> Remover banner atual</label>` : ''}`
        : `<input class="form-input" type="file" name="banner" accept="image/*" />
           <small class="form-hint">${STORE_BRANDING_UPLOAD_HINT}</small>`}
    </div>`
}

function staffProductsPath(panel, storeId = null) {
  const base = STAFF_PANELS[panel].basePath
  return storeId ? `${base}/produtos/${storeId}` : `${base}/produtos`
}

function productCountMap(products) {
  const counts = {}
  for (const product of products) {
    counts[product.store_id] = (counts[product.store_id] ?? 0) + 1
  }
  return counts
}

function productImageLimitHintHtml(store, products, product = null) {
  if (!store) return ''

  const withImages = countProductsWithImages(products)
  const allowed = canAddProductImage(store.plan_id, withImages, Boolean(product?.image))

  if (!allowed) {
    return `<p class="form-hint form-hint--info">${escapeHtml(planProductImageLimitMessage(store.plan_id))}</p>`
  }

  return `<p class="form-hint">${escapeHtml(formatProductImageLimitHint(store.plan_id, withImages))}</p>`
}

function renderProductTableRows(products, categories, store = null, { readOnly = false } = {}) {
  if (products.length === 0) {
    return '<tr><td colspan="5">Nenhum produto nesta loja</td></tr>'
  }

  const withImages = countProductsWithImages(products)

  return products.map((p) => {
    const canAddImage = canAddProductImage(store?.plan_id, withImages, Boolean(p.image))

    return `
    <tr data-product-row data-product-name="${escapeHtml(p.name.toLowerCase())}">
      <td>
        <div class="admin-table-thumb">
          ${p.image ? `<img src="${escapeHtml(p.image)}" alt="" />` : `<span>${getCatalogItemIcon(p)}</span>`}
        </div>
        ${escapeHtml(p.name)}
        <br><small class="form-hint">${escapeHtml(getCatalogItemLabel(p))}</small>
      </td>
      <td>${formatCurrency(p.price)}</td>
      <td>${isService(p) ? '—' : (p.stock ?? 0)}</td>
      <td>${p.active ? '✓' : '✗'}</td>
      <td style="white-space:nowrap">
        ${readOnly ? '—' : `
        <button type="button" class="btn btn-outline btn-sm" data-edit-product="${p.id}">Editar</button>
        <button type="button" class="btn btn-outline btn-sm" data-del-product="${p.id}">Excluir</button>`}
      </td>
    </tr>
    ${readOnly ? '' : `<tr class="admin-edit-row" id="edit-product-row-${p.id}" hidden>
      <td colspan="5">
        <form class="admin-edit-panel admin-form-grid" data-product-edit="${p.id}">
          ${catalogItemTypeFieldHtml(p.item_type)}
          <div class="form-group">
            <label class="form-label">Nome</label>
            <input class="form-input" name="name" value="${escapeHtml(p.name)}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Preço (R$)</label>
            <input class="form-input" name="price" type="number" step="0.01" min="0" value="${p.price}" required />
          </div>
          ${catalogStockFieldHtml(p.stock ?? 0, p.item_type)}
          <div class="form-group">
            <label class="form-label">Categoria</label>
            <select class="form-input" name="category_id">
              <option value="">Sem categoria</option>
              ${categories.map((c) => `<option value="${c.id}" ${p.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Ativo</label>
            <select class="form-input" name="active">
              <option value="true" ${p.active ? 'selected' : ''}>Sim</option>
              <option value="false" ${!p.active ? 'selected' : ''}>Não</option>
            </select>
          </div>
          <div class="form-group admin-form-grid__full">
            <label class="form-label">Descrição</label>
            <textarea class="form-input" name="description" rows="2">${escapeHtml(p.description ?? '')}</textarea>
          </div>
          <div class="form-group admin-form-grid__full">
            <label class="form-label">Imagem</label>
            <div class="admin-image-field">
              <div data-preview-product="${p.id}">${imagePreviewBlock(p.image, p.name, 'square')}</div>
              ${productImageLimitHintHtml(store, products, p)}
              <input class="form-input" type="file" name="image" accept="image/*" ${canAddImage ? '' : 'disabled'} />
              ${canAddImage ? `<small class="form-hint">${PRODUCT_IMAGE_UPLOAD_HINT}</small>` : ''}
            </div>
          </div>
          <div class="admin-form-grid__full admin-edit-panel__actions">
            <button type="submit" class="btn btn-primary btn-sm">Salvar produto</button>
            <button type="button" class="btn btn-outline btn-sm" data-cancel-product="${p.id}">Cancelar</button>
          </div>
        </form>
      </td>
    </tr>`}
  `}).join('')
}

function renderStoreProductsSidebar(stores, counts, selectedStoreId, panel = 'admin') {
  const sorted = [...stores].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  return `
    <aside class="admin-store-products-nav">
      <div class="admin-store-products-nav__head">
        <h2>Lojas</h2>
        <span class="admin-store-products-nav__count">${sorted.length}</span>
      </div>
      <input
        type="search"
        class="form-input admin-store-products-nav__search"
        id="admin-store-products-search"
        placeholder="Buscar loja..."
        autocomplete="off"
      />
      <div class="admin-store-products-nav__list" id="admin-store-products-list">
        ${sorted.length === 0
          ? '<p class="admin-store-products-nav__empty">Nenhuma loja cadastrada</p>'
          : sorted.map((s) => `
            <a
              href="#${staffProductsPath(panel, s.id)}"
              class="admin-store-products-nav__item ${s.id === selectedStoreId ? 'active' : ''}"
              data-store-nav="${s.id}"
              data-store-name="${escapeHtml(s.name.toLowerCase())}"
            >
              <span class="admin-store-products-nav__item-name">${escapeHtml(s.name)}</span>
              <span class="admin-store-products-nav__item-meta">
                ${counts[s.id] ?? 0} produto${(counts[s.id] ?? 0) === 1 ? '' : 's'}
              </span>
            </a>
          `).join('')}
      </div>
    </aside>`
}

function renderStoreProductsPanel({ store, products, categories, readOnly = false }) {
  const withImages = store ? countProductsWithImages(products) : 0
  const canAddImageOnCreate = store
    ? canAddProductImage(store.plan_id, withImages)
    : true
  const canCreate = Boolean(
    store
    && store.status === 'approved'
    && !readOnly
    && canCreateProduct(store.plan_id, products.length),
  )

  if (!store) {
    return `
      <div class="admin-store-products-main admin-store-products-main--empty">
        <div class="empty-state">
          <h2>Selecione uma loja</h2>
          <p>Escolha uma loja na lista ao lado para ver os produtos.</p>
        </div>
      </div>`
  }

  return `
    <div class="admin-store-products-main">
      <div class="admin-store-products-main__head">
        <div>
          <h2>${escapeHtml(store.name)}</h2>
          <p class="admin-store-products-main__meta">
            ${escapeHtml(store.city)}, ${escapeHtml(store.state)}
            · ${statusBadge(store.status)}
            · ${escapeHtml(formatProductLimitHint(store.plan_id, products.length))}
            · ${escapeHtml(formatProductImageLimitHint(store.plan_id, withImages))}
          </p>
        </div>
        <div class="admin-store-products-main__actions">
          ${store.status === 'approved' ? `<a href="#/loja/${escapeHtml(store.slug)}" class="btn btn-outline btn-sm">Ver loja</a>` : ''}
        </div>
      </div>

      ${canCreate ? `
        <details class="admin-form-panel">
          <summary>+ Novo item em ${escapeHtml(store.name)}</summary>
          <form id="admin-product-form" class="admin-form-grid">
            <input type="hidden" name="store_id" value="${escapeHtml(store.id)}" />
            ${catalogItemTypeFieldHtml('product')}
            <div class="form-group">
              <label class="form-label">Nome</label>
              <input class="form-input" name="name" required />
            </div>
            <div class="form-group">
              <label class="form-label">Preço (R$)</label>
              <input class="form-input" name="price" type="number" step="0.01" min="0" required />
            </div>
            ${catalogStockFieldHtml(10, 'product')}
            <div class="form-group">
              <label class="form-label">Categoria</label>
              <select class="form-input" name="category_id">
                <option value="">Sem categoria</option>
                ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">Descrição</label>
              <textarea class="form-input" name="description" rows="2"></textarea>
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">Imagem do produto</label>
              <div class="admin-image-field">
                <div data-preview-product-create>${imagePreviewBlock(null, 'Novo produto', 'square')}</div>
                ${productImageLimitHintHtml(store, products)}
                <input class="form-input" type="file" name="image" accept="image/*" ${canAddImageOnCreate ? '' : 'disabled'} />
                ${canAddImageOnCreate ? `<small class="form-hint">${PRODUCT_IMAGE_UPLOAD_HINT}</small>` : ''}
              </div>
            </div>
            <div class="admin-form-grid__full">
              <button type="submit" class="btn btn-primary">Criar item</button>
            </div>
          </form>
        </details>` : (!readOnly && store.status !== 'approved' ? `
        <div class="alert" style="margin-bottom:1rem">
          Esta loja ainda não está aprovada. Aprove-a em Aprovações para cadastrar novos produtos.
        </div>` : (!readOnly && store.status === 'approved' ? `
        <div class="alert" style="margin-bottom:1rem">
          ${escapeHtml(planProductLimitMessage(store.plan_id))}
        </div>` : ''))}

      ${products.length > 0 ? `
        <div class="admin-filter-bar admin-filter-bar--compact">
          <input type="search" class="form-input admin-filter-bar__search" id="admin-products-search" placeholder="Buscar produto..." autocomplete="off" />
        </div>` : ''}
      <div class="table-wrap admin-store-products-table">
        <table>
          <thead><tr><th>Produto</th><th>Preço</th><th>Estoque</th><th>Ativo</th><th></th></tr></thead>
          <tbody id="admin-products-tbody">
            ${renderProductTableRows(products, categories, store, { readOnly })}
          </tbody>
        </table>
      </div>
    </div>`
}

function bindPlanBrandingToggle(scope) {
  scope.querySelectorAll('[data-plan-branding-form]').forEach((form) => {
    const planSelect = form.querySelector('[name="plan_id"]')
    const brandingWrap = form.querySelector('[data-branding-wrap]')
    if (!planSelect || !brandingWrap) return

    const sync = () => {
      const allowed = planAllowsStoreBranding(planSelect.value)
      brandingWrap.querySelectorAll('[data-branding-field]').forEach((el) => {
        el.hidden = !allowed
        el.querySelectorAll('input[type="file"]').forEach((inp) => {
          inp.disabled = !allowed
          if (!allowed) inp.value = ''
        })
      })
      const locked = brandingWrap.querySelector('[data-branding-locked]')
      if (locked) locked.hidden = allowed
    }

    planSelect.addEventListener('change', sync)
    sync()
  })
}

function quickActions(panel = 'admin') {
  const cards = []
  if (panel === 'admin') {
    cards.push(
      { href: staffHref(panel, 'lojas'), icon: '🏪', title: 'Nova loja', text: 'Cadastrar vitrine' },
      { href: staffHref(panel, 'produtos'), icon: '📦', title: 'Novo produto', text: 'Adicionar ao catálogo' },
    )
  }
  cards.push(
    { href: staffHref(panel, 'pedidos'), icon: '🛒', title: 'Pedidos', text: 'Métricas e histórico' },
    { href: staffHref(panel, 'aprovacoes'), icon: '✅', title: 'Aprovações', text: 'Cadastros e planos' },
    { href: '#/', icon: '🌐', title: 'Ver site', text: 'Abrir marketplace', muted: true },
  )

  return `
    <div class="admin-quick-actions">
      ${cards.map((card) => `
        <a href="${card.href}" class="admin-quick-card ${card.muted ? 'admin-quick-card--muted' : ''}">
          <span class="admin-quick-card__icon">${card.icon}</span>
          <strong>${card.title}</strong>
          <span>${card.text}</span>
        </a>
      `).join('')}
    </div>
  `
}

function metricCards(metrics, pendingCount, orderMetrics = null, panel = 'admin') {
  const items = [
    { label: 'Lojas', value: metrics.totalStores, href: staffHref(panel, 'lojas') },
    { label: 'Produtos', value: metrics.totalProducts, href: staffHref(panel, 'produtos') },
    { label: 'Pedidos', value: orderMetrics?.totalOrders ?? metrics.totalOrders, href: staffHref(panel, 'pedidos') },
    { label: 'Receita', value: formatCurrency(orderMetrics?.totalRevenue ?? 0), href: staffHref(panel, 'pedidos'), compact: true },
    { label: 'Visualizações', value: metrics.totalViews, href: null },
    { label: 'Pendentes', value: pendingCount, href: staffHref(panel, 'aprovacoes'), highlight: pendingCount > 0 },
  ]

  return `
    <div class="metrics admin-metrics">
      ${items.map((m) => `
        ${m.href
          ? `<a href="${m.href}" class="metric-card metric-card--link ${m.highlight ? 'metric-card--alert' : ''} ${m.compact ? 'metric-card--compact' : ''}">
              <div class="metric-card__value">${m.value}</div>
              <div class="metric-card__label">${m.label}</div>
            </a>`
          : `<div class="metric-card ${m.compact ? 'metric-card--compact' : ''}">
              <div class="metric-card__value">${m.value}</div>
              <div class="metric-card__label">${m.label}</div>
            </div>`}
      `).join('')}
    </div>
  `
}

export async function renderStaffDashboard(main, tab = 'overview', selectedStoreId = null, panel = 'admin') {
  const user = guardStaff(main, panel)
  if (!user) return

  main.dataset.staffPanel = panel
  const menuItem = getStaffMenuItem(tab, panel)
  const storesReadOnly = isReadOnlyStaffTab(panel, 'stores')
  const productsReadOnly = isReadOnlyStaffTab(panel, 'products')

  if (tab === 'overview') {
    const [metrics, queue, stores, orderAnalytics, recentOrders] = await Promise.all([
      fetchAdminMetrics(),
      loadStaffApprovalQueue(user),
      fetchAllStoresAdmin(),
      fetchAdminOrdersAnalytics(),
      fetchAdminOrders(5),
    ])
    const { pendingStores: pending, planRequests, pendingTotal } = queue
    const orderMetrics = orderAnalytics.metrics

    setAdminPendingCount(pendingTotal)
    import('../ui.js').then(({ renderHeader }) => renderHeader()).catch(() => {})

    const pendingPreview = pending.slice(0, 3)

    main.innerHTML = adminPage(
      menuItem.label,
      'Resumo da plataforma e atalhos rápidos',
      `
        ${quickActions(panel)}
        ${metricCards(metrics, pendingTotal, orderMetrics, panel)}
        <section class="admin-section">
          <div class="admin-section__head">
            <h2>Pedidos</h2>
            <a href="${staffHref(panel, 'pedidos')}" class="btn btn-outline btn-sm">Ver todos</a>
          </div>
          ${orderMetricsChips(orderMetrics)}
          ${orderAnalytics.timeline.length > 0
            ? renderOrdersChart(buildOrderPeriodSeries(orderAnalytics.timeline, '7d'), { period: '7d', metric: 'orders', compact: true })
            : ''}
          ${recentOrders.length === 0
            ? adminEmptyState('🛒', 'Sem pedidos', 'Nenhum pedido foi registrado na plataforma ainda.')
            : `<div class="table-wrap admin-orders-table" style="margin-top:1rem">
                <table>
                  <thead><tr><th>Data</th><th>Loja</th><th>Cliente</th><th>Total</th><th>Status</th></tr></thead>
                  <tbody>${renderAdminOrderRows(recentOrders, { compact: true })}</tbody>
                </table>
              </div>`}
        </section>
        <section class="admin-section">
          <div class="admin-section__head">
            <h2>Status das lojas</h2>
            <a href="${staffHref(panel, 'lojas')}" class="btn btn-outline btn-sm">${storesReadOnly ? 'Ver lojas' : 'Gerenciar lojas'}</a>
          </div>
          ${storeStatusSummary(stores)}
        </section>
        <section class="admin-section">
          <div class="admin-section__head">
            <h2>Aprovações recentes</h2>
            ${pendingTotal > 0 ? `<a href="${staffHref(panel, 'aprovacoes')}" class="btn btn-outline btn-sm">Ver todas (${pendingTotal})</a>` : ''}
          </div>
          ${pendingPreview.length === 0 && planRequests.length === 0
            ? adminEmptyState('✅', 'Tudo em dia', 'Nenhuma loja ou pedido de plano aguardando aprovação.')
            : `${pendingPreview.length > 0 ? `<div class="admin-cards-list">
                ${pendingPreview.map((s) => `
                  <article class="admin-list-card admin-list-card--highlight">
                    <div class="admin-list-card__main">
                      <strong>${escapeHtml(s.name)}</strong>
                      <p>${escapeHtml(s.city)}, ${escapeHtml(s.state)} · ${formatDate(s.created_at)}</p>
                      <p class="admin-list-card__meta">${escapeHtml(s.owner?.name ?? 'Lojista')} · ${escapeHtml(s.owner?.email ?? '')}</p>
                    </div>
                    <div class="admin-list-card__actions">
                      <button type="button" class="btn btn-primary btn-sm" data-approve="${s.id}">Aprovar</button>
                      <button type="button" class="btn btn-outline btn-sm" data-reject="${s.id}">Rejeitar</button>
                    </div>
                  </article>
                `).join('')}
              </div>` : ''}
              ${planRequests.length > 0 ? renderPlanChangeApprovalCards(planRequests.slice(0, 3)) : ''}`}
        </section>
      `,
      `<span class="admin-user-badge">${escapeHtml(user.email)}</span>`,
      panel
    )

    bindApprovalActions(main, 'overview')
    bindPlanChangeApprovalActions(main, 'overview')
    return
  }

  if (tab === 'approvals') {
    const { pendingStores: pending, planRequests, pendingTotal } = await loadStaffApprovalQueue(user)
    setAdminPendingCount(pendingTotal)
    import('../ui.js').then(({ renderHeader }) => renderHeader()).catch(() => {})

    main.innerHTML = adminPage(
      menuItem.label,
      `${pendingTotal} pendência${pendingTotal === 1 ? '' : 's'} aguardando sua revisão`,
      pendingTotal === 0
        ? adminEmptyState('✅', 'Fila vazia', 'Nenhuma loja ou pedido de plano aguardando aprovação.')
        : `${renderPlanChangeApprovalCards(planRequests)}
          ${pending.length > 0 ? `
            <section class="admin-section">
              <div class="admin-section__head">
                <h2>Cadastros de loja</h2>
                <span class="admin-stat-chip admin-stat-chip--pending">${pending.length} pendente${pending.length === 1 ? '' : 's'}</span>
              </div>
              <div class="admin-cards-list">
                ${pending.map((s) => `
                  <article class="admin-approval-card">
                    <div class="admin-approval-card__head">
                      <div>
                        <h3>${escapeHtml(s.name)}</h3>
                        <p>${escapeHtml(s.city)}, ${escapeHtml(s.state)} · ${formatDate(s.created_at)}</p>
                      </div>
                      ${statusBadge(s.status)}
                    </div>
                    <dl class="admin-approval-card__details">
                      <div><dt>Lojista</dt><dd>${escapeHtml(s.owner?.name ?? '—')}</dd></div>
                      <div><dt>Email</dt><dd>${escapeHtml(s.owner?.email ?? '—')}</dd></div>
                      <div><dt>WhatsApp</dt><dd>${escapeHtml(s.whatsapp)}</dd></div>
                      <div><dt>Categoria</dt><dd>${escapeHtml(s.category?.name ?? '—')}</dd></div>
                    </dl>
                    <div class="admin-approval-card__actions">
                      <button type="button" class="btn btn-primary btn-sm" data-approve="${s.id}">Aprovar loja</button>
                      <button type="button" class="btn btn-outline btn-sm" data-reject="${s.id}">Rejeitar</button>
                    </div>
                  </article>
                `).join('')}
              </div>
            </section>` : ''}`,
      '',
      panel
    )

    bindApprovalActions(main, 'approvals')
    bindPlanChangeApprovalActions(main, 'approvals')
    return
  }

  if (tab === 'stores') {
    const [stores, categories, queue] = await Promise.all([
      fetchAllStoresAdmin(),
      fetchCategories(),
      loadStaffApprovalQueue(user),
    ])
    const merchants = storesReadOnly ? [] : await fetchMerchants()

    setAdminPendingCount(queue.pendingTotal)
    import('../ui.js').then(({ renderHeader }) => renderHeader()).catch(() => {})

    main.innerHTML = adminPage(
      menuItem.label,
      storesReadOnly ? `${stores.length} loja(s) — somente leitura` : `${stores.length} loja(s) cadastradas`,
      `
        <div id="admin-store-msg"></div>
        ${storesReadOnly ? '<p class="admin-readonly-hint">Moderadores podem visualizar lojas, mas não criar nem editar.</p>' : ''}
        ${!storesReadOnly && merchants.length === 0
          ? '<div class="empty-state" style="margin-bottom:1rem"><p>Nenhum lojista cadastrado. Crie contas em <a href="#/lojista/cadastro">Área do Lojista</a> primeiro.</p></div>'
          : ''}
        ${storesReadOnly ? '' : `<details class="admin-form-panel" open ${merchants.length === 0 ? 'style="opacity:0.6;pointer-events:none"' : ''}>
          <summary>+ Nova loja</summary>
          <form id="admin-store-form" class="admin-form-grid" data-plan-branding-form>
            <div class="form-group">
              <label class="form-label">Lojista responsável</label>
              <select class="form-input" name="owner_id" required>
                <option value="">Selecione...</option>
                ${merchants.map((m) => `<option value="${m.id}">${escapeHtml(m.name)} (${escapeHtml(m.email)})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Nome da loja</label>
              <input class="form-input" name="name" required />
            </div>
            <div class="form-group">
              <label class="form-label">Categoria</label>
              <select class="form-input" name="category_id" required>
                ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">WhatsApp</label>
              <input class="form-input" name="whatsapp" required placeholder="5521999999999" />
            </div>
            <div class="form-group">
              <label class="form-label">Cidade</label>
              <input class="form-input" name="city" required />
            </div>
            <div class="form-group">
              <label class="form-label">UF</label>
              <input class="form-input" name="state" required maxlength="2" value="RJ" />
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">Descrição</label>
              <textarea class="form-input" name="description" rows="2"></textarea>
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">Endereço</label>
              <input class="form-input" name="address" />
            </div>
            <div class="form-group">
              <label class="form-label">Horário</label>
              <input class="form-input" name="opening_hours" placeholder="Seg–Sáb 8h–20h" />
            </div>
            <div class="form-group">
              <label class="form-label">Cor do tema</label>
              <select class="form-input" name="theme_color">
                ${STORE_THEME_COLORS.map((c) => `<option value="${c.id}">${c.id}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Plano</label>
              <select class="form-input" name="plan_id">
                <option value="free">Gratuito</option>
                <option value="starter">Starter</option>
                <option value="plus">Plus</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div data-branding-wrap class="admin-form-grid__full admin-form-grid">
              ${storeBrandingFieldsHtml('free')}
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="admin-check">
                <input type="checkbox" name="approved" checked />
                Publicar loja imediatamente (aprovada e ativa)
              </label>
            </div>
            <div class="admin-form-grid__full">
              <button type="submit" class="btn btn-primary">Criar loja</button>
            </div>
          </form>
        </details>`}
        ${stores.length > 0 ? adminFilterBar({
          searchId: 'admin-stores-search',
          searchPlaceholder: 'Buscar loja, cidade ou lojista...',
          chips: [
            { id: 'all', label: 'Todas', active: true },
            { id: 'approved', label: 'Aprovadas', active: false },
            { id: 'pending', label: 'Pendentes', active: false },
            { id: 'blocked', label: 'Bloqueadas', active: false },
          ],
        }) : ''}
        ${storeStatusSummary(stores)}
        <div class="table-wrap admin-stores-table" style="margin-top:1rem">
          <table>
            <thead><tr><th>Loja</th><th>Lojista</th><th>Cidade</th><th>Status</th><th>Plano</th><th></th></tr></thead>
            <tbody>
              ${stores.length === 0 ? `<tr><td colspan="6">${adminEmptyState('🏪', 'Nenhuma loja', 'Cadastre a primeira loja usando o formulário acima.')}</td></tr>` : stores.map((s) => `
                <tr data-store-row data-store-id="${s.id}" data-store-status="${s.status}" data-store-search="${escapeHtml(`${s.name} ${s.city} ${s.state} ${s.owner?.name ?? ''} ${s.owner?.email ?? ''}`.toLowerCase())}">
                  <td>
                    <div class="admin-table-thumb">
                      ${s.logo ? `<img src="${escapeHtml(s.logo)}" alt="" />` : '<span>🏪</span>'}
                    </div>
                    <strong>${escapeHtml(s.name)}</strong><br><small>/${escapeHtml(s.slug)}</small>
                  </td>
                  <td>${escapeHtml(s.owner?.name ?? '—')}<br><small>${escapeHtml(s.owner?.email ?? '')}</small></td>
                  <td>${escapeHtml(s.city)}, ${escapeHtml(s.state)}</td>
                  <td>${statusBadge(s.status)}</td>
                  <td>${escapeHtml(getPlanById(s.plan_id).name)}</td>
                  <td style="white-space:nowrap">
                    <a href="#${staffProductsPath(panel, s.id)}" class="btn btn-outline btn-sm">Produtos</a>
                    ${storesReadOnly ? '' : `<button type="button" class="btn btn-outline btn-sm" data-edit-store="${s.id}">Editar</button>`}
                    ${s.status === 'approved' ? `<a href="#/loja/${escapeHtml(s.slug)}" class="btn btn-outline btn-sm">Ver</a>` : ''}
                  </td>
                </tr>
                ${storesReadOnly ? '' : `<tr class="admin-edit-row" id="edit-store-row-${s.id}" hidden>
                  <td colspan="6">
                    <form class="admin-edit-panel admin-form-grid" data-store-edit="${s.id}" data-plan-branding-form>
                      <div class="form-group">
                        <label class="form-label">Nome</label>
                        <input class="form-input" name="name" value="${escapeHtml(s.name)}" required />
                      </div>
                      <div class="form-group">
                        <label class="form-label">WhatsApp</label>
                        <input class="form-input" name="whatsapp" value="${escapeHtml(s.whatsapp)}" required />
                      </div>
                      <div class="form-group">
                        <label class="form-label">Cidade</label>
                        <input class="form-input" name="city" value="${escapeHtml(s.city)}" required />
                      </div>
                      <div class="form-group">
                        <label class="form-label">UF</label>
                        <input class="form-input" name="state" value="${escapeHtml(s.state)}" maxlength="2" required />
                      </div>
                      <div class="form-group">
                        <label class="form-label">Categoria</label>
                        <select class="form-input" name="category_id">
                          ${categories.map((c) => `<option value="${c.id}" ${s.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                        </select>
                      </div>
                      <div class="form-group">
                        <label class="form-label">Cor do tema</label>
                        <select class="form-input" name="theme_color">
                          ${STORE_THEME_COLORS.map((c) => `<option value="${c.id}" ${s.theme_color === c.id ? 'selected' : ''}>${c.id}</option>`).join('')}
                        </select>
                      </div>
                      <div class="form-group">
                        <label class="form-label">Status</label>
                        <select class="form-input" name="status">
                          <option value="pending" ${s.status === 'pending' ? 'selected' : ''}>Pendente</option>
                          <option value="approved" ${s.status === 'approved' ? 'selected' : ''}>Aprovada</option>
                          <option value="blocked" ${s.status === 'blocked' ? 'selected' : ''}>Bloqueada</option>
                        </select>
                      </div>
                      <div class="form-group">
                        <label class="form-label">Plano</label>
                        <select class="form-input" name="plan_id">
                          ${['free', 'starter', 'plus', 'premium'].map((p) => `<option value="${p}" ${s.plan_id === p ? 'selected' : ''}>${escapeHtml(getPlanById(p).name)}</option>`).join('')}
                        </select>
                      </div>
                      <div class="form-group admin-form-grid__full">
                        <label class="form-label">Descrição</label>
                        <textarea class="form-input" name="description" rows="2">${escapeHtml(s.description ?? '')}</textarea>
                      </div>
                      <div class="form-group admin-form-grid__full">
                        <label class="form-label">Endereço</label>
                        <input class="form-input" name="address" value="${escapeHtml(s.address ?? '')}" />
                      </div>
                      <div class="form-group admin-form-grid__full">
                        <label class="form-label">Horário</label>
                        <input class="form-input" name="opening_hours" value="${escapeHtml(s.opening_hours ?? '')}" />
                      </div>
                      <div class="form-group admin-form-grid__full">
                        <label class="form-label">Instagram</label>
                        <input class="form-input" name="instagram" value="${escapeHtml(s.instagram ?? '')}" placeholder="@minhaloja" />
                      </div>
                      <div data-branding-wrap class="admin-form-grid__full admin-form-grid">
                        ${storeBrandingFieldsHtml(s.plan_id, s)}
                      </div>
                      <div class="admin-form-grid__full admin-edit-panel__actions">
                        <button type="submit" class="btn btn-primary btn-sm">Salvar loja</button>
                        <button type="button" class="btn btn-outline btn-sm" data-cancel-store="${s.id}">Cancelar</button>
                      </div>
                    </form>
                  </td>
                </tr>`}
              `).join('')}
            </tbody>
          </table>
        </div>
      `,
      '',
      panel
    )

    if (!storesReadOnly) {
      bindStoreForm(main)
      bindStoreEdits(main)
      bindPlanBrandingToggle(main)
    }
    bindListFilters(main, {
      searchId: 'admin-stores-search',
      rowSelector: '[data-store-row]',
      getSearchText: (row) => row.dataset.storeSearch ?? '',
      getFilterValue: (row) => row.dataset.storeStatus ?? '',
      linkedEditPrefix: 'edit-store-row-',
    })
    return
  }

  if (tab === 'products') {
    const [allProducts, stores, categories, queue] = await Promise.all([
      fetchAdminProducts(),
      fetchAllStoresAdmin(),
      fetchCategories(),
      loadStaffApprovalQueue(user),
    ])

    setAdminPendingCount(queue.pendingTotal)
    import('../ui.js').then(({ renderHeader }) => renderHeader()).catch(() => {})

    if (!selectedStoreId && stores.length > 0) {
      const first = [...stores].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))[0]
      navigate(staffProductsPath(panel, first.id))
      return
    }

    const counts = productCountMap(allProducts)
    const selectedStore = selectedStoreId ? stores.find((s) => s.id === selectedStoreId) : null
    const storeProducts = selectedStoreId
      ? allProducts.filter((p) => p.store_id === selectedStoreId)
      : []

    main.innerHTML = adminPage(
      menuItem.label,
      selectedStore
        ? (productsReadOnly ? `Produtos de ${selectedStore.name} — somente leitura` : `Gerenciando produtos de ${selectedStore.name}`)
        : `${allProducts.length} produto(s) em ${stores.length} loja(s)`,
      `
        ${productsReadOnly ? '<p class="admin-readonly-hint">Moderadores podem visualizar produtos, mas não criar nem editar.</p>' : ''}
        <div id="admin-product-msg"></div>
        <div class="admin-store-products-layout">
          ${renderStoreProductsSidebar(stores, counts, selectedStoreId, panel)}
          ${renderStoreProductsPanel({
            store: selectedStore,
            products: storeProducts,
            categories,
            readOnly: productsReadOnly,
          })}
        </div>
      `,
      '',
      panel
    )

    bindStoreProductsNav(main)
    bindProductSearch(main)
    if (!productsReadOnly) bindProductForm(main, selectedStoreId)
    return
  }

  if (tab === 'pedidos') {
    const [orders, orderAnalytics, queue] = await Promise.all([
      fetchAdminOrders(),
      fetchAdminOrdersAnalytics(),
      loadStaffApprovalQueue(user),
    ])
    const orderMetrics = orderAnalytics.metrics

    setAdminPendingCount(queue.pendingTotal)
    import('../ui.js').then(({ renderHeader }) => renderHeader()).catch(() => {})

    main.innerHTML = adminPage(
      menuItem.label,
      `${orderMetrics.totalOrders} pedido(s) · ${formatCurrency(orderMetrics.totalRevenue)} em vendas`,
      `
        ${orderMetricsChips(orderMetrics)}
        ${renderOrdersChart(buildOrderPeriodSeries(orderAnalytics.timeline, '30d'), { period: '30d', metric: 'orders' })}
        ${orders.length > 0 ? `
          <div class="admin-orders-toolbar">
            ${adminOrdersFilterBar(storesFromOrders(orders))}
            <button type="button" class="btn btn-outline btn-sm" id="admin-orders-export">⬇ Exportar CSV</button>
          </div>` : ''}
        <div class="table-wrap admin-orders-table" style="margin-top:1rem">
          <table>
            <thead><tr>
              <th class="admin-table-sortable">
                <button type="button" class="admin-table-sort active" id="admin-orders-sort" data-order-sort="desc" aria-label="Ordenar por data, mais recentes primeiro">
                  Data <span class="admin-table-sort__icon" aria-hidden="true">↓</span>
                </button>
              </th>
              <th>Loja</th><th>Cliente</th><th>Telefone</th><th>Total</th><th>Status</th>
            </tr></thead>
            <tbody id="admin-orders-tbody">
              ${orders.length === 0
                ? `<tr><td colspan="6">${adminEmptyState('🛒', 'Nenhum pedido', 'Os pedidos feitos pelos clientes aparecerão aqui.')}</td></tr>`
                : `${renderAdminOrderRows(orders)}
                  <tr data-orders-empty hidden>
                    <td colspan="6">${adminEmptyState('🔍', 'Nenhum resultado', 'Nenhum pedido corresponde aos filtros selecionados.')}</td>
                  </tr>`}
            </tbody>
          </table>
        </div>
        ${orders.length > 0 ? '<div id="admin-orders-pagination-wrap"></div>' : ''}
      `,
      orders.length > 0
        ? '<span class="admin-export-hint">Exporta todos os pedidos filtrados (todas as páginas)</span>'
        : '',
      panel
    )

    bindOrdersChart(main, orderAnalytics.timeline)
    bindOrdersCsvExport(main, orders)
    bindOrdersListFilters(main)
    return
  }

  if (tab === 'moderators') {
    if (panel !== 'admin') {
      navigate('/moderador')
      return
    }

    const moderators = await fetchModerators()

    main.innerHTML = adminPage(
      menuItem.label,
      'Promova usuários existentes ao papel de moderador',
      `
        <section class="admin-section admin-moderators-promote">
          <div class="admin-section__head">
            <h2>Promover usuário</h2>
          </div>
          <p class="admin-moderators-promote__hint">
            O usuário precisa já ter conta como cliente ou lojista. Após a promoção, ele acessa em
            <a href="#/moderador/entrar">#/moderador/entrar</a>.
          </p>
          <form id="promote-moderator-form" class="admin-moderators-promote__form">
            <div class="form-group">
              <label class="form-label" for="promote-moderator-email">Email do usuário</label>
              <input class="form-input" type="email" id="promote-moderator-email" name="email" placeholder="usuario@email.com" required autocomplete="off" />
            </div>
            <div id="promote-moderator-msg"></div>
            <button type="submit" class="btn btn-primary btn-sm">Promover a moderador</button>
          </form>
        </section>
        <section class="admin-section">
          <div class="admin-section__head">
            <h2>Moderadores ativos</h2>
            <span class="admin-stat-chip admin-stat-chip--sent" id="admin-moderators-count">${moderators.length} cadastrado${moderators.length === 1 ? '' : 's'}</span>
          </div>
          <p class="form-hint" style="margin-bottom:1rem">Marque quais moderadores podem aprovar pedidos de mudança de plano na aba Aprovações.</p>
          ${moderators.length === 0
            ? adminEmptyState('🛡️', 'Nenhum moderador', 'Promova o primeiro usuário usando o formulário acima.')
            : `
              <div class="admin-filter-bar admin-filter-bar--compact">
                <input
                  type="search"
                  class="form-input admin-filter-bar__search"
                  id="admin-moderators-search"
                  placeholder="Buscar por nome ou email..."
                  autocomplete="off"
                />
              </div>
              <div class="table-wrap admin-moderators-table">
                <table>
                  <thead><tr>
                    <th class="admin-table-sortable">
                      <button type="button" class="admin-table-sort" id="admin-moderators-sort-name" data-moderator-sort="name" aria-label="Ordenar por nome, A–Z">
                        Nome <span class="admin-table-sort__icon" aria-hidden="true"></span>
                      </button>
                    </th>
                    <th class="admin-table-sortable">
                      <button type="button" class="admin-table-sort" id="admin-moderators-sort-email" data-moderator-sort="email" aria-label="Ordenar por email, A–Z">
                        Email <span class="admin-table-sort__icon" aria-hidden="true"></span>
                      </button>
                    </th>
                    <th class="admin-table-sortable">
                      <button type="button" class="admin-table-sort active" id="admin-moderators-sort-created" data-moderator-sort="created" data-moderator-sort-dir="desc" aria-label="Ordenar por data, mais recentes primeiro">
                        Desde <span class="admin-table-sort__icon" aria-hidden="true">↓</span>
                      </button>
                    </th>
                    <th>Aprovar planos</th>
                    <th></th>
                  </tr></thead>
                  <tbody id="admin-moderators-tbody">
                    ${renderModeratorTableRows(moderators)}
                    <tr data-moderators-empty hidden>
                      <td colspan="5">${adminEmptyState('🔍', 'Nenhum resultado', 'Nenhum moderador corresponde à busca.')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div id="admin-moderators-pagination-wrap"></div>`}
        </section>
      `,
      '',
      panel
    )

    bindModeratorManagement(main)
    return
  }

  if (tab === 'account') {
    const emailSection = panel === 'admin'
      ? `
          <form id="admin-email-form" class="admin-password-form">
            <h3 class="admin-account-card__section-title">Alterar email</h3>
            <div class="form-group">
              <label class="form-label">Novo email</label>
              <input class="form-input" type="email" name="email" required autocomplete="email" placeholder="seu@email.com" />
            </div>
            <p class="form-hint">Enviaremos um link de confirmação para o novo endereço.</p>
            <div id="admin-email-msg"></div>
            <button type="submit" class="btn btn-primary btn-sm">Alterar email</button>
          </form>
          <hr class="admin-account-card__divider" />
        `
      : ''

    main.innerHTML = adminPage(
      menuItem.label,
      panel === 'admin' ? 'Altere seu email e senha de acesso ao painel' : 'Altere sua senha de acesso ao painel',
      `
        <div class="admin-account-card">
          <p class="admin-account-card__email"><span>Conta</span> ${escapeHtml(user.email)}</p>
          ${emailSection}
          <form id="admin-password-form" class="admin-password-form">
            <h3 class="admin-account-card__section-title">Alterar senha</h3>
            <div class="form-group">
              <label class="form-label">Nova senha</label>
              <input class="form-input" type="password" name="password" required minlength="6" autocomplete="new-password" />
            </div>
            <div class="form-group">
              <label class="form-label">Confirmar nova senha</label>
              <input class="form-input" type="password" name="confirm" required minlength="6" autocomplete="new-password" />
            </div>
            <div id="admin-password-msg"></div>
            <button type="submit" class="btn btn-primary btn-sm">Alterar senha</button>
          </form>
        </div>
      `,
      '',
      panel
    )

    bindEmailForm(main)
    bindPasswordForm(main)
  }
}

export async function renderAdminDashboard(main, tab = 'overview', selectedStoreId = null) {
  return renderStaffDashboard(main, tab, selectedStoreId, 'admin')
}

export async function renderModeratorDashboard(main, tab = 'overview', selectedStoreId = null) {
  return renderStaffDashboard(main, tab, selectedStoreId, 'moderator')
}

function bindProductSearch(main) {
  const search = main.querySelector('#admin-products-search')
  if (!search) return

  search.addEventListener('input', () => {
    const term = search.value.trim().toLowerCase()
    main.querySelectorAll('[data-product-row]').forEach((row) => {
      const name = row.dataset.productName ?? ''
      const show = !term || name.includes(term)
      row.hidden = !show
      const editRow = main.querySelector(`#edit-product-row-${row.querySelector('[data-edit-product]')?.dataset.editProduct}`)
      if (editRow?.hidden === false && !show) editRow.hidden = true
    })
  })
}

function bindStoreForm(main) {
  main.querySelector('#admin-store-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const f = e.target
    const msgEl = main.querySelector('#admin-store-msg')
    const submitBtn = f.querySelector('button[type="submit"]')
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Criando...' }
    try {
      const store = await createStoreAsAdmin({
        owner_id: f.owner_id.value,
        name: f.name.value.trim(),
        category_id: f.category_id.value,
        whatsapp: f.whatsapp.value.trim(),
        city: f.city.value.trim(),
        state: f.state.value.trim().toUpperCase(),
        description: f.description.value.trim(),
        address: f.address.value.trim(),
        opening_hours: f.opening_hours.value.trim(),
        theme_color: f.theme_color.value,
        plan_id: f.plan_id.value,
        approved: f.approved.checked,
      })

      const logoFile = f.logo?.files?.[0]
      const bannerFile = f.banner?.files?.[0]
      if (logoFile || bannerFile) {
        if (!planAllowsStoreBranding(f.plan_id.value)) {
          throw new Error(FREE_PLAN_BRANDING_MESSAGE)
        }
        await updateStoreAsAdmin(store.id, {
          plan_id: f.plan_id.value,
          logo: logoFile ?? undefined,
          banner: bannerFile ?? undefined,
        })
      }

      showToast(`Loja "${store.name}" criada!`)
      navigate(`${STAFF_PANELS[main.dataset.staffPanel || 'admin'].basePath}/lojas`)
    } catch (err) {
      msgEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Criar loja' }
    }
  })
}

function bindStoreEdits(main) {
  main.querySelectorAll('[data-edit-store]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editStore
      main.querySelectorAll('.admin-edit-row[id^="edit-store-row-"]').forEach((row) => {
        row.hidden = row.id !== `edit-store-row-${id}`
      })
      const row = main.querySelector(`#edit-store-row-${id}`)
      row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  })

  main.querySelectorAll('[data-cancel-store]').forEach((btn) => {
    btn.addEventListener('click', () => {
      main.querySelector(`#edit-store-row-${btn.dataset.cancelStore}`).hidden = true
    })
  })

  main.querySelectorAll('[data-store-edit]').forEach((form) => {
    const id = form.dataset.storeEdit
    const logoInput = form.querySelector('input[name="logo"]')
    const bannerInput = form.querySelector('input[name="banner"]')
    bindImagePreview(logoInput, form.querySelector(`[data-preview-logo="${id}"]`))
    bindImagePreview(bannerInput, form.querySelector(`[data-preview-banner="${id}"]`))

    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const submitBtn = form.querySelector('button[type="submit"]')
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Salvando...' }
      try {
        const instagramCheck = validateInstagramHandle(form.instagram?.value ?? '')
        if (!instagramCheck.ok) throw new Error(instagramCheck.message)

        await updateStoreAsAdmin(id, {
          name: form.name.value.trim(),
          whatsapp: form.whatsapp.value.trim(),
          city: form.city.value.trim(),
          state: form.state.value.trim().toUpperCase(),
          category_id: form.category_id.value,
          theme_color: form.theme_color.value,
          status: form.status.value,
          plan_id: form.plan_id.value,
          description: form.description.value.trim(),
          address: form.address.value.trim(),
          opening_hours: form.opening_hours.value.trim(),
          instagram: instagramCheck.handle || null,
          logo: logoInput?.files?.[0],
          banner: bannerInput?.files?.[0],
          remove_logo: !logoInput?.files?.[0] && form.remove_logo?.checked,
          remove_banner: !bannerInput?.files?.[0] && form.remove_banner?.checked,
        })
        showToast('Loja atualizada!')
        rerenderStaff(main, 'stores')
      } catch (err) {
        showToast(err.message)
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Salvar loja' }
      }
    })
  })
}

function bindStoreProductsNav(main) {
  const search = main.querySelector('#admin-store-products-search')
  const items = main.querySelectorAll('[data-store-nav]')

  search?.addEventListener('input', () => {
    const term = search.value.trim().toLowerCase()
    items.forEach((item) => {
      const name = item.dataset.storeName ?? ''
      item.hidden = term.length > 0 && !name.includes(term)
    })
  })
}

function bindProductForm(main, selectedStoreId = null) {
  const createForm = main.querySelector('#admin-product-form')
  const createImageInput = createForm?.querySelector('input[name="image"]')
  bindImagePreview(createImageInput, main.querySelector('[data-preview-product-create]'))
  bindCatalogItemTypeForm(createForm)

  createForm?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const f = e.target
    const msgEl = main.querySelector('#admin-product-msg')
    const submitBtn = f.querySelector('button[type="submit"]')
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Criando...' }
    try {
      const imageFile = f.image?.files?.[0]
      if (imageFile) {
        const err = validateImageFile(imageFile, STORAGE_BUCKETS.products)
        if (err) throw new Error(err)
      }
      const storeId = f.store_id.value
      const catalogFields = readCatalogItemForm(f)
      await createProduct(storeId, {
        name: f.name.value.trim(),
        description: f.description.value.trim(),
        price: parseFloat(f.price.value),
        item_type: catalogFields.item_type,
        stock: catalogFields.stock,
        category_id: f.category_id.value,
        active: true,
        image: imageFile,
      })
      showToast('Item criado!')
      navigate(staffProductsPath(main.dataset.staffPanel || 'admin', storeId || selectedStoreId))
    } catch (err) {
      msgEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Criar produto' }
    }
  })

  bindProductEdits(main, selectedStoreId)
}

function bindProductEdits(main, selectedStoreId = null) {
  main.querySelectorAll('[data-edit-product]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editProduct
      main.querySelectorAll('.admin-edit-row[id^="edit-product-row-"]').forEach((row) => {
        row.hidden = row.id !== `edit-product-row-${id}`
      })
      const row = main.querySelector(`#edit-product-row-${id}`)
      row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  })

  main.querySelectorAll('[data-cancel-product]').forEach((btn) => {
    btn.addEventListener('click', () => {
      main.querySelector(`#edit-product-row-${btn.dataset.cancelProduct}`).hidden = true
    })
  })

  main.querySelectorAll('[data-product-edit]').forEach((form) => {
    const id = form.dataset.productEdit
    const imageInput = form.querySelector('input[name="image"]')
    bindImagePreview(imageInput, form.querySelector(`[data-preview-product="${id}"]`))
    bindCatalogItemTypeForm(form)

    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const submitBtn = form.querySelector('button[type="submit"]')
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Salvando...' }
      try {
        const imageFile = imageInput?.files?.[0]
        if (imageFile) {
          const err = validateImageFile(imageFile, STORAGE_BUCKETS.products)
          if (err) throw new Error(err)
        }
        const catalogFields = readCatalogItemForm(form)
        await updateProduct(id, {
          name: form.name.value.trim(),
          description: form.description.value.trim(),
          price: parseFloat(form.price.value),
          item_type: catalogFields.item_type,
          stock: catalogFields.stock,
          category_id: form.category_id.value,
          active: form.active.value === 'true',
          image: imageFile,
        })
        showToast('Item atualizado!')
        rerenderStaff(main, 'products', selectedStoreId)
      } catch (err) {
        showToast(err.message)
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Salvar produto' }
      }
    })
  })

  main.querySelectorAll('[data-del-product]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este produto?')) return
      await deleteProduct(btn.dataset.delProduct)
      showToast('Produto excluído')
      rerenderStaff(main, 'products', selectedStoreId)
    })
  })
}

const MODERATORS_PAGE_SIZE = 10

const MODERATOR_SORT_DEFAULTS = {
  name: 'asc',
  email: 'asc',
  created: 'desc',
}

function sortModeratorRows(rows, field = 'created', direction = 'desc') {
  return [...rows].sort((a, b) => {
    let diff = 0
    if (field === 'created') {
      diff = new Date(a.dataset.moderatorCreated).getTime() - new Date(b.dataset.moderatorCreated).getTime()
    } else if (field === 'email') {
      diff = (a.dataset.moderatorEmail ?? '').localeCompare(b.dataset.moderatorEmail ?? '', 'pt-BR', { sensitivity: 'base' })
    } else {
      diff = (a.dataset.moderatorName ?? '').localeCompare(b.dataset.moderatorName ?? '', 'pt-BR', { sensitivity: 'base' })
    }
    return direction === 'asc' ? diff : -diff
  })
}

function reorderModeratorRowsInDom(tbody, matchedRows, emptyRow) {
  if (!tbody) return
  const anchor = emptyRow ?? null
  for (const row of matchedRows) tbody.insertBefore(row, anchor)
  tbody.querySelectorAll('[data-moderator-row]').forEach((row) => {
    if (row.dataset.moderatorMatch !== '1') tbody.insertBefore(row, anchor)
  })
}

function updateModeratorsSortButtons(main, sortField, sortDirection) {
  const labels = {
    name: {
      asc: 'Ordenar por nome, A–Z',
      desc: 'Ordenar por nome, Z–A',
    },
    email: {
      asc: 'Ordenar por email, A–Z',
      desc: 'Ordenar por email, Z–A',
    },
    created: {
      asc: 'Ordenar por data, mais antigos primeiro',
      desc: 'Ordenar por data, mais recentes primeiro',
    },
  }

  main.querySelectorAll('[data-moderator-sort]').forEach((button) => {
    const field = button.dataset.moderatorSort
    const isActive = field === sortField
    button.classList.toggle('active', isActive)
    button.dataset.moderatorSortDir = isActive ? sortDirection : ''
    const icon = button.querySelector('.admin-table-sort__icon')
    if (icon) icon.textContent = isActive ? (sortDirection === 'asc' ? '↑' : '↓') : ''
    button.setAttribute('aria-label', labels[field]?.[isActive ? sortDirection : MODERATOR_SORT_DEFAULTS[field]] ?? '')
  })
}

function renderModeratorTableRows(moderators) {
  if (moderators.length === 0) return ''

  return moderators.map((m) => `
    <tr
      data-moderator-row
      data-moderator-search="${escapeHtml(`${m.name} ${m.email}`.toLowerCase())}"
      data-moderator-name="${escapeHtml(m.name)}"
      data-moderator-email="${escapeHtml(m.email)}"
      data-moderator-created="${m.created_at}"
    >
      <td><strong>${escapeHtml(m.name)}</strong></td>
      <td>${escapeHtml(m.email)}</td>
      <td>${formatDate(m.created_at)}</td>
      <td>
        <label class="admin-check">
          <input type="checkbox" data-moderator-plan-approval="${m.id}" ${m.can_approve_plan_changes ? 'checked' : ''} />
          Pode aprovar
        </label>
      </td>
      <td>
        <button type="button" class="btn btn-outline btn-sm" data-demote-moderator="${m.id}" data-moderator-name="${escapeHtml(m.name)}">
          Remover acesso
        </button>
      </td>
    </tr>
  `).join('')
}

function renderModeratorsPaginationHtml({ currentPage, totalPages, matchedCount }) {
  if (matchedCount === 0) return ''

  const start = (currentPage - 1) * MODERATORS_PAGE_SIZE + 1
  const end = Math.min(currentPage * MODERATORS_PAGE_SIZE, matchedCount)
  const label = matchedCount === 1 ? 'moderador' : 'moderadores'

  if (totalPages <= 1) {
    return `
      <div class="admin-pagination admin-pagination--single">
        <p class="admin-pagination__info">${matchedCount} ${label}</p>
      </div>`
  }

  return `
    <div class="admin-pagination">
      <p class="admin-pagination__info">${start}–${end} de ${matchedCount} ${label}</p>
      <div class="admin-pagination__controls">
        <button type="button" class="btn btn-outline btn-sm" data-moderator-page-prev ${currentPage <= 1 ? 'disabled' : ''}>← Anterior</button>
        <span class="admin-pagination__status">Página ${currentPage} de ${totalPages}</span>
        <button type="button" class="btn btn-outline btn-sm" data-moderator-page-next ${currentPage >= totalPages ? 'disabled' : ''}>Próxima →</button>
      </div>
    </div>`
}

function bindModeratorsList(main) {
  const search = main.querySelector('#admin-moderators-search')
  const tbody = main.querySelector('#admin-moderators-tbody')
  const emptyRow = main.querySelector('[data-moderators-empty]')
  const countEl = main.querySelector('#admin-moderators-count')
  const paginationWrap = main.querySelector('#admin-moderators-pagination-wrap')
  const sortButtons = main.querySelectorAll('[data-moderator-sort]')
  let sortField = 'created'
  let sortDirection = 'desc'
  let currentPage = 1
  let matchedRows = []

  const applyPagination = () => {
    const totalPages = Math.max(1, Math.ceil(matchedRows.length / MODERATORS_PAGE_SIZE))
    if (currentPage > totalPages) currentPage = totalPages

    matchedRows.forEach((row, index) => {
      const onPage = index >= (currentPage - 1) * MODERATORS_PAGE_SIZE && index < currentPage * MODERATORS_PAGE_SIZE
      row.hidden = !onPage
    })

    if (paginationWrap) {
      paginationWrap.innerHTML = renderModeratorsPaginationHtml({
        currentPage,
        totalPages,
        matchedCount: matchedRows.length,
      })
    }
  }

  const apply = ({ resetPage = false } = {}) => {
    if (resetPage) currentPage = 1

    const rows = main.querySelectorAll('[data-moderator-row]')
    const term = search?.value.trim().toLowerCase() ?? ''
    matchedRows = []

    rows.forEach((row) => {
      const matches = !term || (row.dataset.moderatorSearch ?? '').includes(term)
      row.dataset.moderatorMatch = matches ? '1' : '0'
      if (matches) matchedRows.push(row)
      else row.hidden = true
    })

    matchedRows = sortModeratorRows(matchedRows, sortField, sortDirection)
    reorderModeratorRowsInDom(tbody, matchedRows, emptyRow)

    if (emptyRow) emptyRow.hidden = matchedRows.length > 0
    if (countEl) {
      countEl.textContent = term && matchedRows.length !== rows.length
        ? `${matchedRows.length} de ${rows.length} moderador${rows.length === 1 ? '' : 'es'}`
        : `${rows.length} cadastrado${rows.length === 1 ? '' : 's'}`
    }

    applyPagination()
  }

  search?.addEventListener('input', () => apply({ resetPage: true }))

  sortButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const field = button.dataset.moderatorSort
      if (field === sortField) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'
      } else {
        sortField = field
        sortDirection = MODERATOR_SORT_DEFAULTS[field] ?? 'asc'
      }
      updateModeratorsSortButtons(main, sortField, sortDirection)
      apply()
    })
  })

  paginationWrap?.addEventListener('click', (event) => {
    const totalPages = Math.max(1, Math.ceil(matchedRows.length / MODERATORS_PAGE_SIZE))
    if (event.target.closest('[data-moderator-page-prev]') && currentPage > 1) {
      currentPage--
      applyPagination()
      main.querySelector('.admin-moderators-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    if (event.target.closest('[data-moderator-page-next]') && currentPage < totalPages) {
      currentPage++
      applyPagination()
      main.querySelector('.admin-moderators-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  })

  updateModeratorsSortButtons(main, sortField, sortDirection)
  apply()
}

function bindModeratorManagement(main) {
  bindModeratorsList(main)

  main.querySelectorAll('[data-moderator-plan-approval]').forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      const moderatorId = checkbox.dataset.moderatorPlanApproval
      try {
        await setModeratorPlanApprovalPermission(moderatorId, checkbox.checked)
        showToast(checkbox.checked ? 'Moderador pode aprovar mudanças de plano' : 'Permissão de plano removida')
      } catch (err) {
        checkbox.checked = !checkbox.checked
        showToast(err.message)
      }
    })
  })

  main.querySelector('#promote-moderator-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const msgEl = main.querySelector('#promote-moderator-msg')
    const submitBtn = form.querySelector('button[type="submit"]')
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Promovendo...' }
    try {
      const promoted = await promoteUserToModerator(form.email.value)
      showToast(`${promoted.name} agora é moderador`)
      rerenderStaff(main, 'moderators')
    } catch (err) {
      msgEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Promover a moderador' }
    }
  })

  main.querySelectorAll('[data-demote-moderator]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.moderatorName
      if (!confirm(`Remover acesso de moderador de ${name}?`)) return
      try {
        await demoteModerator(btn.dataset.demoteModerator)
        showToast('Acesso de moderador removido')
        rerenderStaff(main, 'moderators')
      } catch (err) {
        showToast(err.message)
      }
    })
  })
}

function bindEmailForm(main) {
  main.querySelector('#admin-email-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const msgEl = main.querySelector('#admin-email-msg')
    const submitBtn = form.querySelector('button[type="submit"]')

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Enviando...' }

    try {
      const result = await updateEmail(form.email.value)
      form.reset()
      const { loadUser } = await import('../state.js')
      await loadUser()

      if (result.pendingEmail) {
        msgEl.innerHTML = `<div class="alert" style="background:var(--primary-50);color:var(--primary-700);padding:0.75rem;border-radius:var(--radius)">Confirme o novo email em <strong>${escapeHtml(result.pendingEmail)}</strong> pelo link enviado.</div>`
        showToast('Link de confirmação enviado!')
      } else {
        msgEl.innerHTML = '<div class="alert alert-success">Email alterado com sucesso.</div>'
        showToast('Email atualizado!')
        rerenderStaff(main, 'account')
      }
    } catch (err) {
      msgEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Alterar email' }
    }
  })
}

function bindPasswordForm(main) {
  main.querySelector('#admin-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const msgEl = main.querySelector('#admin-password-msg')
    const password = form.password.value
    const confirm = form.confirm.value

    if (password !== confirm) {
      msgEl.innerHTML = '<div class="alert alert-error">As senhas não coincidem.</div>'
      return
    }

    const submitBtn = form.querySelector('button[type="submit"]')
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Salvando...' }

    try {
      await updatePassword(password)
      form.reset()
      msgEl.innerHTML = '<div class="alert alert-success">Senha alterada com sucesso.</div>'
      showToast('Senha atualizada!')
    } catch (err) {
      msgEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Alterar senha' }
    }
  })
}

function bindApprovalActions(main, tab) {
  main.querySelectorAll('[data-approve]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await approveStoreRegistration(btn.dataset.approve)
      showToast('Loja aprovada!')
      rerenderStaff(main, tab)
    })
  })

  main.querySelectorAll('[data-reject]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Rejeitar esta loja?')) return
      await rejectStoreRegistration(btn.dataset.reject)
      showToast('Loja rejeitada')
      rerenderStaff(main, tab)
    })
  })
}

function bindPlanChangeApprovalActions(main, tab) {
  main.querySelectorAll('[data-approve-plan-request]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await approvePlanChangeRequest(btn.dataset.approvePlanRequest)
        showToast('Plano aprovado!')
        rerenderStaff(main, tab)
      } catch (err) {
        showToast(err.message)
      }
    })
  })

  main.querySelectorAll('[data-reject-plan-request]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Rejeitar este pedido de mudança de plano?')) return
      try {
        await rejectPlanChangeRequest(btn.dataset.rejectPlanRequest)
        showToast('Pedido de plano rejeitado')
        rerenderStaff(main, tab)
      } catch (err) {
        showToast(err.message)
      }
    })
  })
}