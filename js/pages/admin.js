/**
 * Painéis admin e moderador — conteúdo dinâmico; navegação no header.
 */
import {
  fetchAdminMetrics, fetchAdminOrdersAnalytics, fetchAdminOrders,
  buildOrderPeriodSeries, getOrderPeriodCutoff,
  fetchPendingStoreApprovals,
  approveStoreRegistration, rejectStoreRegistration,
  fetchPendingPlanChangeRequests, approvePlanChangeRequest, rejectPlanChangeRequest,
  updateModeratorPermissions,
  updatePassword, updateEmail, fetchMerchants, fetchModerators, promoteUserToModerator, demoteModerator,
  fetchAllStoresAdmin,
  fetchAdminProducts, createStoreAsAdmin, createProduct, updateProduct,
  updateStoreAsAdmin, deleteProduct, fetchCategories,
  fetchNeighborhoods, createNeighborhood, updateNeighborhood, deleteNeighborhood,
} from '../api.js'
import { getStaffNeighborhoodScope, formatNeighborhoodLabel } from '../neighborhood.js'
import { getUser, loadUser, setAdminPendingCount } from '../state.js'
import { navigate } from '../router.js'
import {
  escapeHtml, formatDate, formatCurrency, showToast,
  formatDateTimeCsv, buildCsv, downloadTextFile, validateInstagramHandle,
} from '../utils.js'
import { STORE_THEME_COLORS, stringsEditorHref } from '../config.js'
import { STAFF_PANELS, staffHref, getStaffMenuItem } from '../staff-nav.js'
import {
  canAccessPanel, isReadOnlyStaffTab, canApprovePlanChanges,
  MODERATOR_PERMISSIONS, getModeratorPermissionValue,
} from '../roles.js'
import {
  planAllowsStoreBanner, FREE_PLAN_BANNER_MESSAGE,
  countProductsWithImages, canAddProductImage, canCreateProduct,
  planProductImageLimitMessage, planProductLimitMessage,
  formatProductLimitHint, formatProductImageLimitHint,
  getPlanById, SUBSCRIPTION_PLANS,
} from '../plans.js'
import {
  PRODUCT_IMAGE_UPLOAD_HINT, STORE_LOGO_UPLOAD_HINT, STORE_BANNER_UPLOAD_HINT,
  validateImageFile, STORAGE_BUCKETS,
} from '../uploads.js'
import {
  isService, getCatalogItemIcon, getCatalogItemLabel,
  catalogItemTypeFieldHtml, catalogStockFieldHtml, bindCatalogItemTypeForm, readCatalogItemForm,
} from '../catalog.js'
import { t } from '../strings.js'
import { bindPasswordToggles } from '../password-field.js'

async function guardStaff(main, panel = 'admin') {
  let user = getUser()
  if (!user) user = await loadUser()
  const panelConfig = STAFF_PANELS[panel]
  if (!canAccessPanel(user, panel)) {
    main.innerHTML = `<div class="empty-state"><h2>${t('admin.restrictedAccess')}</h2><p><a href="#${panelConfig.loginPath}">${t('nav.login')}</a></p></div>`
    return null
  }
  return user
}

function staffScopeSubtitle(user, panel) {
  if (panel !== 'moderator') return ''
  const name = user.neighborhood?.name
  return name ? t('admin.regionScope', { name: formatNeighborhoodLabel(user.neighborhood) }) : t('moderator.regionNotAssigned')
}

function renderNeighborhoodOptions(neighborhoods, selectedId = '') {
  return neighborhoods.map((n) => `
    <option value="${n.id}" ${selectedId === n.id ? 'selected' : ''}>${escapeHtml(formatNeighborhoodLabel(n))}</option>
  `).join('')
}

function renderModeratorPermissionBadges(moderator) {
  const active = MODERATOR_PERMISSIONS.filter((permission) => getModeratorPermissionValue(moderator, permission.id))
  if (active.length === 0) {
    return `<span class="admin-permission-badge admin-permission-badge--muted">${t('moderator.approvalOnlyBadge')}</span>`
  }
  return active.map((permission) => `
    <span class="admin-permission-badge">${escapeHtml(permission.label)}</span>
  `).join('')
}

function renderModeratorPermissionFields(moderator = null, { idPrefix = '' } = {}) {
  return MODERATOR_PERMISSIONS.map((permission) => {
    const inputId = `${idPrefix}${permission.id}`
    const checked = moderator ? getModeratorPermissionValue(moderator, permission.id) : false
    return `
      <label class="admin-check admin-permission-option" for="${inputId}">
        <input
          type="checkbox"
          id="${inputId}"
          name="${permission.id}"
          ${checked ? 'checked' : ''}
        />
        <span>
          <strong>${escapeHtml(permission.label)}</strong>
          <small>${escapeHtml(permission.description)}</small>
        </span>
      </label>`
  }).join('')
}

async function loadStaffApprovalQueue(user, panel = 'admin') {
  const scopeId = getStaffNeighborhoodScope(user, panel)
  const pendingStores = await fetchPendingStoreApprovals(scopeId)
  const planRequests = canApprovePlanChanges(user)
    ? await fetchPendingPlanChangeRequests(scopeId)
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
        <h2>${t('admin.planChangeRequestsTitle')}</h2>
        <span class="admin-stat-chip admin-stat-chip--pending">${requests.length} ${requests.length === 1 ? t('common.pendingSingular') : t('common.pendingPlural')}</span>
      </div>
      <div class="admin-cards-list">
        ${requests.map((r) => `
          <article class="admin-approval-card">
            <div class="admin-approval-card__head">
              <div>
                <h3>${escapeHtml(r.store?.name ?? t('common.store'))}</h3>
                <p>${escapeHtml(getPlanById(r.current_plan_id).name)} → <strong>${escapeHtml(getPlanById(r.requested_plan_id).name)}</strong> · ${formatDate(r.created_at)}</p>
              </div>
              <span class="badge badge-pending">${t('labels.plan')}</span>
            </div>
            <dl class="admin-approval-card__details">
              <div><dt>${t('admin.merchant')}</dt><dd>${escapeHtml(r.store?.owner?.name ?? '—')}</dd></div>
              <div><dt>${t('labels.email')}</dt><dd>${escapeHtml(r.store?.owner?.email ?? '—')}</dd></div>
              <div><dt>${t('common.neighborhood')}</dt><dd>${escapeHtml(r.store?.neighborhood?.name ?? '—')}</dd></div>
              <div><dt>${t('labels.city')}</dt><dd>${escapeHtml(r.store?.city ?? '—')}, ${escapeHtml(r.store?.state ?? '—')}</dd></div>
            </dl>
            <div class="admin-approval-card__actions">
              <button type="button" class="btn btn-primary btn-sm" data-approve-plan-request="${r.id}">${t('admin.approvePlan')}</button>
              <button type="button" class="btn btn-outline btn-sm" data-reject-plan-request="${r.id}">${t('labels.reject')}</button>
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
      <span class="admin-stat-chip admin-stat-chip--approved">${t('storeStatus.approvedCount', { count: counts.approved })}</span>
      <span class="admin-stat-chip admin-stat-chip--pending">${t('storeStatus.pendingCount', { count: counts.pending })}</span>
      <span class="admin-stat-chip admin-stat-chip--blocked">${t('storeStatus.blockedCount', { count: counts.blocked })}</span>
    </div>`
}

function summarizeRegionalOverview(neighborhoods, stores, moderators) {
  const storeCounts = new Map()
  const pendingCounts = new Map()
  for (const store of stores) {
    const id = store.neighborhood_id
    if (!id) continue
    storeCounts.set(id, (storeCounts.get(id) ?? 0) + 1)
    if (store.status === 'pending') {
      pendingCounts.set(id, (pendingCounts.get(id) ?? 0) + 1)
    }
  }

  const moderatorsByNeighborhood = new Map()
  for (const moderator of moderators) {
    if (!moderator.neighborhood_id) continue
    moderatorsByNeighborhood.set(moderator.neighborhood_id, (moderatorsByNeighborhood.get(moderator.neighborhood_id) ?? 0) + 1)
  }

  const rows = neighborhoods.map((neighborhood) => ({
    neighborhood,
    storeCount: storeCounts.get(neighborhood.id) ?? 0,
    pendingCount: pendingCounts.get(neighborhood.id) ?? 0,
    moderatorCount: moderatorsByNeighborhood.get(neighborhood.id) ?? 0,
  }))

  return {
    totalNeighborhoods: neighborhoods.length,
    activeNeighborhoods: neighborhoods.filter((n) => n.active).length,
    totalModerators: moderators.length,
    unassignedStores: stores.filter((s) => !s.neighborhood_id).length,
    rows,
  }
}

function renderRegionalOverviewSection(summary) {
  const { totalNeighborhoods, activeNeighborhoods, totalModerators, unassignedStores, rows } = summary

  return `
    <section class="admin-section admin-regional-overview">
      <div class="admin-section__head">
        <h2>${t('admin.neighborhoodsAndModerators')}</h2>
        <div class="admin-section__head-actions">
          <a href="${staffHref('admin', 'bairros')}" class="btn btn-outline btn-sm">${t('admin.manageNeighborhoods')}</a>
          <a href="${staffHref('admin', 'moderadores')}" class="btn btn-outline btn-sm">${t('admin.manageModerators')}</a>
        </div>
      </div>
      <div class="admin-stat-chips" style="margin-bottom:1rem">
        <span class="admin-stat-chip admin-stat-chip--sent">${t('admin.activeNeighborhoodsChip', { count: activeNeighborhoods })}</span>
        <span class="admin-stat-chip admin-stat-chip--sent">${t('admin.totalRegionsChip', { count: totalNeighborhoods })}</span>
        <span class="admin-stat-chip admin-stat-chip--sent">${t('admin.moderatorsChip', { count: totalModerators })}</span>
        ${unassignedStores > 0 ? `<span class="admin-stat-chip admin-stat-chip--pending">${t('admin.unassignedStoresChip', { count: unassignedStores })}</span>` : ''}
      </div>
      ${rows.length === 0
        ? adminEmptyState('📍', t('admin.noNeighborhoodsTitle'), t('admin.noNeighborhoodsBody'), `<a href="${staffHref('admin', 'bairros')}" class="btn btn-primary btn-sm">${t('admin.createNeighborhood')}</a>`)
        : `<div class="table-wrap">
            <table>
              <thead><tr><th>${t('common.neighborhood')}</th><th>${t('nav.staffStores')}</th><th>${t('admin.metricPending')}</th><th>${t('nav.staffModerators')}</th><th>${t('labels.status')}</th></tr></thead>
              <tbody>
                ${rows.map(({ neighborhood, storeCount, pendingCount, moderatorCount }) => `
                  <tr>
                    <td><strong>${escapeHtml(neighborhood.name)}</strong><br><small>${escapeHtml(neighborhood.city)}, ${escapeHtml(neighborhood.state)}</small></td>
                    <td>${storeCount}</td>
                    <td>${pendingCount > 0 ? `<span class="admin-stat-chip admin-stat-chip--pending">${pendingCount}</span>` : '0'}</td>
                    <td>${moderatorCount > 0 ? moderatorCount : '<span class="admin-stat-chip admin-stat-chip--pending">0</span>'}</td>
                    <td>${neighborhood.active ? `<span class="badge badge-approved">${t('storeStatus.active')}</span>` : `<span class="badge badge-blocked">${t('storeStatus.inactive')}</span>`}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`}
    </section>`
}

function adminStoresFilterBar({ searchId, searchPlaceholder, chips, neighborhoods = [] }) {
  const neighborhoodFilter = neighborhoods.length > 0
    ? `
        <div class="admin-filter-group admin-filter-group--store">
          <label class="admin-filter-group__label" for="admin-stores-neighborhood">${t('common.neighborhood')}</label>
          <select class="form-input admin-orders-store-select" id="admin-stores-neighborhood">
            <option value="all">${t('admin.allNeighborhoods')}</option>
            ${neighborhoods.map((n) => `<option value="${n.id}">${escapeHtml(formatNeighborhoodLabel(n))}</option>`).join('')}
          </select>
        </div>`
    : ''

  return `
    <div class="admin-orders-filters">
      <input type="search" class="form-input admin-filter-bar__search" id="${searchId}" placeholder="${escapeHtml(searchPlaceholder)}" autocomplete="off" />
      <div class="admin-orders-filters__groups">
        ${neighborhoodFilter}
        <div class="admin-filter-group">
          <span class="admin-filter-group__label">${t('labels.status')}</span>
          <div class="admin-filter-chips" role="group">
            ${chips.map((c) => `
              <button type="button" class="admin-filter-chip ${c.active ? 'active' : ''}" data-filter="${c.id}">${escapeHtml(c.label)}</button>
            `).join('')}
          </div>
        </div>
      </div>
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
        placeholder="${t('admin.searchOrdersPlaceholder')}"
        autocomplete="off"
      />
      <div class="admin-orders-filters__groups">
        <div class="admin-filter-group admin-filter-group--store">
          <label class="admin-filter-group__label" for="admin-orders-store">${t('common.store')}</label>
          <select class="form-input admin-orders-store-select" id="admin-orders-store">
            <option value="all">${t('admin.allStores')}</option>
            ${stores.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="admin-filter-group">
          <span class="admin-filter-group__label">${t('labels.status')}</span>
          <div class="admin-filter-chips" role="group">
            <button type="button" class="admin-filter-chip active" data-order-status="all">${t('common.all')}</button>
            <button type="button" class="admin-filter-chip" data-order-status="sent">${t('orderStatus.sentPlural')}</button>
            <button type="button" class="admin-filter-chip" data-order-status="viewed">${t('orderStatus.viewedPlural')}</button>
            <button type="button" class="admin-filter-chip" data-order-status="pending">${t('storeStatus.pendingPlural')}</button>
          </div>
        </div>
        <div class="admin-filter-group">
          <span class="admin-filter-group__label">${t('common.period')}</span>
          <div class="admin-filter-chips" role="group">
            <button type="button" class="admin-filter-chip active" data-order-period="all">${t('common.all')}</button>
            <button type="button" class="admin-filter-chip" data-order-period="7d">${t('common.days7')}</button>
            <button type="button" class="admin-filter-chip" data-order-period="30d">${t('common.days30')}</button>
            <button type="button" class="admin-filter-chip" data-order-period="12m">${t('common.months12')}</button>
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
    direction === 'asc' ? t('common.sortByDateOldest') : t('common.sortByDateRecent'),
  )
}

function renderOrdersPaginationHtml({ currentPage, totalPages, matchedCount }) {
  if (matchedCount === 0) return ''

  const start = (currentPage - 1) * ORDERS_PAGE_SIZE + 1
  const end = Math.min(currentPage * ORDERS_PAGE_SIZE, matchedCount)

  if (totalPages <= 1) {
    return `
      <div class="admin-pagination admin-pagination--single">
        <p class="admin-pagination__info">${t('pagination.ordersCount', { count: matchedCount })}</p>
      </div>`
  }

  return `
    <div class="admin-pagination">
      <p class="admin-pagination__info">${start}–${end} de ${t('pagination.ordersCount', { count: matchedCount })}</p>
      <div class="admin-pagination__controls">
        <button type="button" class="btn btn-outline btn-sm" data-page-prev ${currentPage <= 1 ? 'disabled' : ''}>${t('pagination.previous')}</button>
        <span class="admin-pagination__status">${t('pagination.pageStatus', { current: currentPage, total: totalPages })}</span>
        <button type="button" class="btn btn-outline btn-sm" data-page-next ${currentPage >= totalPages ? 'disabled' : ''}>${t('pagination.next')}</button>
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

function bindStoreListFilters(main) {
  const search = main.querySelector('#admin-stores-search')
  const neighborhoodSelect = main.querySelector('#admin-stores-neighborhood')
  const chips = main.querySelectorAll('[data-filter]')
  const rows = main.querySelectorAll('[data-store-row]')
  let activeFilter = 'all'
  let activeNeighborhood = 'all'

  const apply = () => {
    const term = search?.value.trim().toLowerCase() ?? ''
    rows.forEach((row) => {
      const matchesSearch = !term || (row.dataset.storeSearch ?? '').includes(term)
      const matchesStatus = activeFilter === 'all' || row.dataset.storeStatus === activeFilter
      const matchesNeighborhood = activeNeighborhood === 'all' || row.dataset.storeNeighborhood === activeNeighborhood
      const visible = matchesSearch && matchesStatus && matchesNeighborhood
      row.hidden = !visible
      if (row.dataset.storeId) {
        const editRow = main.querySelector(`#edit-store-row-${row.dataset.storeId}`)
        if (editRow && !visible) editRow.hidden = true
      }
    })
  }

  search?.addEventListener('input', apply)
  neighborhoodSelect?.addEventListener('change', () => {
    activeNeighborhood = neighborhoodSelect.value
    apply()
  })
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
    pending: `<span class="badge badge-pending">${t('storeStatus.pending')}</span>`,
    approved: `<span class="badge badge-approved">${t('storeStatus.approved')}</span>`,
    blocked: `<span class="badge badge-blocked">${t('storeStatus.blocked')}</span>`,
  }
  return map[status] ?? escapeHtml(status)
}

const ORDER_STATUS_LABELS = {
  pending: t('orderStatus.pending'),
  sent: t('orderStatus.sent'),
  viewed: t('orderStatus.viewed'),
}

function orderStatusBadge(status) {
  const map = {
    pending: `<span class="badge badge-order-pending">${t('orderStatus.pending')}</span>`,
    sent: `<span class="badge badge-order-sent">${t('orderStatus.sent')}</span>`,
    viewed: `<span class="badge badge-order-viewed">${t('orderStatus.viewed')}</span>`,
  }
  return map[status] ?? escapeHtml(status)
}

function ordersToCsv(orders) {
  const headers = [t('common.date'), t('common.store'), t('labels.city'), t('labels.state'), t('common.customer'), t('labels.phone'), t('labels.address'), t('admin.csvTotal'), t('labels.status'), t('common.id')]
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
      showToast(t('toasts.noOrdersToExport'))
      return
    }

    const date = new Date().toISOString().slice(0, 10)
    downloadTextFile(`pedidos-${date}.csv`, ordersToCsv(toExport))
    showToast(t('common.ordersExported', { count: toExport.length }))
  })
}

function orderMetricsChips(metrics) {
  return `
    <div class="admin-order-metrics">
      <div class="admin-order-metric">
        <span class="admin-order-metric__value">${metrics.totalOrders}</span>
        <span class="admin-order-metric__label">${t('admin.totalOrders')}</span>
      </div>
      <div class="admin-order-metric admin-order-metric--highlight">
        <span class="admin-order-metric__value">${formatCurrency(metrics.totalRevenue)}</span>
        <span class="admin-order-metric__label">${t('admin.accumulatedRevenue')}</span>
      </div>
      <div class="admin-order-metric">
        <span class="admin-order-metric__value">${metrics.ordersToday}</span>
        <span class="admin-order-metric__label">${t('common.today')}</span>
      </div>
      <div class="admin-order-metric">
        <span class="admin-order-metric__value">${metrics.ordersWeek}</span>
        <span class="admin-order-metric__label">${t('common.last7Days')}</span>
      </div>
    </div>
    <div class="admin-stat-chips" style="margin-top:0.75rem">
      <span class="admin-stat-chip admin-stat-chip--sent">${t('orderStatus.sentCount', { count: metrics.byStatus.sent })}</span>
      <span class="admin-stat-chip admin-stat-chip--viewed">${t('orderStatus.viewedCount', { count: metrics.byStatus.viewed })}</span>
      <span class="admin-stat-chip admin-stat-chip--order-pending">${t('storeStatus.pendingCount', { count: metrics.byStatus.pending })}</span>
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
          ? t('admin.chartOrdersTooltip', { label: bucket.label, count: value })
          : t('admin.chartRevenueTooltip', { label: bucket.label, value: formatCurrency(value) })
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
          <h3>${t('admin.ordersByPeriod')}</h3>
          <p class="admin-chart-panel__summary">
            ${t('admin.periodOrdersSummary', { count: totalOrders, revenue: formatCurrency(totalRevenue) })}
          </p>
        </div>
        ${compact ? '' : `
          <div class="admin-chart-panel__controls">
            <div class="admin-filter-chips" role="group" data-chart-period-group>
              <button type="button" class="admin-filter-chip ${period === '7d' ? 'active' : ''}" data-chart-period="7d">${t('common.days7')}</button>
              <button type="button" class="admin-filter-chip ${period === '30d' ? 'active' : ''}" data-chart-period="30d">${t('common.days30')}</button>
              <button type="button" class="admin-filter-chip ${period === '12m' ? 'active' : ''}" data-chart-period="12m">${t('common.months12')}</button>
            </div>
            <div class="admin-filter-chips" role="group" data-chart-metric-group>
              <button type="button" class="admin-filter-chip ${metric === 'orders' ? 'active' : ''}" data-chart-metric="orders">${t('nav.staffOrders')}</button>
              <button type="button" class="admin-filter-chip ${metric === 'revenue' ? 'active' : ''}" data-chart-metric="revenue">${t('admin.metricRevenue')}</button>
            </div>
          </div>`}
      </div>
      <div class="admin-chart" id="admin-orders-chart-body" role="img" aria-label="${t('admin.ordersChartAria')}">
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
    summary.textContent = t('admin.periodOrdersSummary', { count: totalOrders, revenue: formatCurrency(totalRevenue) })
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
    return `<tr><td colspan="${emptyColspan}">${t('admin.noOrdersRegistered')}</td></tr>`
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
    return `<div class="admin-image-preview admin-image-preview--empty admin-image-preview--${variant}">${t('app.noImage')}</div>`
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
      previewEl.innerHTML = `<img class="admin-image-preview" src="${reader.result}" alt="${t('common.preview')}" />`
    }
    reader.readAsDataURL(file)
  })
}

/** Logo sempre no DOM; banner fica hidden + aviso de upgrade quando plano é free. */
function storeBrandingFieldsHtml(planId, store = null) {
  const id = store?.id ?? ''
  const canBanner = planAllowsStoreBanner(planId)

  return `
    <div class="form-group" data-branding-field data-branding-logo>
      <label class="form-label">${t('admin.logo')}</label>
      ${store
        ? `<div class="admin-image-field">
            <div data-preview-logo="${id}">${imagePreviewBlock(store.logo, store.name, 'square')}</div>
            <input class="form-input" type="file" name="logo" accept="image/*" />
          </div>
          ${store.logo ? `<label class="admin-check"><input type="checkbox" name="remove_logo" /> ${t('admin.removeCurrentLogo')}</label>` : ''}`
        : `<input class="form-input" type="file" name="logo" accept="image/*" />
           <small class="form-hint">${STORE_LOGO_UPLOAD_HINT}</small>`}
    </div>
    <div class="form-group admin-form-grid__full" data-branding-field data-branding-banner ${canBanner ? '' : 'hidden'}>
      <label class="form-label">${t('admin.banner')}</label>
      ${store
        ? `<div class="admin-image-field">
            <div data-preview-banner="${id}">${imagePreviewBlock(store.banner, store.name, 'banner')}</div>
            <input class="form-input" type="file" name="banner" accept="image/*" />
          </div>
          ${store.banner ? `<label class="admin-check"><input type="checkbox" name="remove_banner" /> ${t('admin.removeCurrentBanner')}</label>` : ''}`
        : `<input class="form-input" type="file" name="banner" accept="image/*" />
           <small class="form-hint">${STORE_BANNER_UPLOAD_HINT}</small>`}
    </div>
    <div class="form-group admin-form-grid__full" data-branding-locked ${canBanner ? 'hidden' : ''}>
      <p class="form-hint form-hint--info">${escapeHtml(FREE_PLAN_BANNER_MESSAGE)}</p>
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
    return `<tr><td colspan="5">${t('admin.noProductsInStore')}</td></tr>`
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
        <button type="button" class="btn btn-outline btn-sm" data-edit-product="${p.id}">${t('labels.edit')}</button>
        <button type="button" class="btn btn-outline btn-sm" data-del-product="${p.id}">${t('labels.delete')}</button>`}
      </td>
    </tr>
    ${readOnly ? '' : `<tr class="admin-edit-row" id="edit-product-row-${p.id}" hidden>
      <td colspan="5">
        <form class="admin-edit-panel admin-form-grid" data-product-edit="${p.id}">
          ${catalogItemTypeFieldHtml(p.item_type)}
          <div class="form-group">
            <label class="form-label">${t('labels.name')}</label>
            <input class="form-input" name="name" value="${escapeHtml(p.name)}" required />
          </div>
          <div class="form-group">
            <label class="form-label">${t('common.priceWithCurrency')}</label>
            <input class="form-input" name="price" type="number" step="0.01" min="0" value="${p.price}" required />
          </div>
          ${catalogStockFieldHtml(p.stock ?? 0, p.item_type)}
          <div class="form-group">
            <label class="form-label">${t('labels.category')}</label>
            <select class="form-input" name="category_id">
              <option value="">${t('common.noCategory')}</option>
              ${categories.map((c) => `<option value="${c.id}" ${p.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">${t('common.active')}</label>
            <select class="form-input" name="active">
              <option value="true" ${p.active ? 'selected' : ''}>${t('common.yes')}</option>
              <option value="false" ${!p.active ? 'selected' : ''}>${t('common.no')}</option>
            </select>
          </div>
          <div class="form-group admin-form-grid__full">
            <label class="form-label">${t('labels.description')}</label>
            <textarea class="form-input" name="description" rows="2">${escapeHtml(p.description ?? '')}</textarea>
          </div>
          <div class="form-group admin-form-grid__full">
            <label class="form-label">${t('common.image')}</label>
            <div class="admin-image-field">
              <div data-preview-product="${p.id}">${imagePreviewBlock(p.image, p.name, 'square')}</div>
              ${productImageLimitHintHtml(store, products, p)}
              <input class="form-input" type="file" name="image" accept="image/*" ${canAddImage ? '' : 'disabled'} />
              ${canAddImage ? `<small class="form-hint">${PRODUCT_IMAGE_UPLOAD_HINT}</small>` : ''}
            </div>
          </div>
          <div class="admin-form-grid__full admin-edit-panel__actions">
            <button type="submit" class="btn btn-primary btn-sm">${t('admin.saveProduct')}</button>
            <button type="button" class="btn btn-outline btn-sm" data-cancel-product="${p.id}">${t('labels.cancel')}</button>
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
        <h2>${t('nav.staffStores')}</h2>
        <span class="admin-store-products-nav__count">${sorted.length}</span>
      </div>
      <input
        type="search"
        class="form-input admin-store-products-nav__search"
        id="admin-store-products-search"
        placeholder="${t('admin.searchStorePlaceholder')}"
        autocomplete="off"
      />
      <div class="admin-store-products-nav__list" id="admin-store-products-list">
        ${sorted.length === 0
          ? `<p class="admin-store-products-nav__empty">${t('admin.noStoresRegistered')}</p>`
          : sorted.map((s) => `
            <a
              href="#${staffProductsPath(panel, s.id)}"
              class="admin-store-products-nav__item ${s.id === selectedStoreId ? 'active' : ''}"
              data-store-nav="${s.id}"
              data-store-name="${escapeHtml(s.name.toLowerCase())}"
            >
              <span class="admin-store-products-nav__item-name">${escapeHtml(s.name)}</span>
              <span class="admin-store-products-nav__item-meta">
                ${t('admin.productCount', { count: counts[s.id] ?? 0 })}
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
          <h2>${t('admin.selectStoreTitle')}</h2>
          <p>${t('admin.selectStoreBody')}</p>
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
          ${store.status === 'approved' ? `<a href="#/loja/${escapeHtml(store.slug)}" class="btn btn-outline btn-sm">${t('merchant.viewPublicStore')}</a>` : ''}
        </div>
      </div>

      ${canCreate ? `
        <details class="admin-form-panel">
          <summary>${t('admin.newItemInStore', { name: escapeHtml(store.name) })}</summary>
          <form id="admin-product-form" class="admin-form-grid">
            <input type="hidden" name="store_id" value="${escapeHtml(store.id)}" />
            ${catalogItemTypeFieldHtml('product')}
            <div class="form-group">
              <label class="form-label">${t('labels.name')}</label>
              <input class="form-input" name="name" required />
            </div>
            <div class="form-group">
              <label class="form-label">${t('common.priceWithCurrency')}</label>
              <input class="form-input" name="price" type="number" step="0.01" min="0" required />
            </div>
            ${catalogStockFieldHtml(10, 'product')}
            <div class="form-group">
              <label class="form-label">${t('labels.category')}</label>
              <select class="form-input" name="category_id">
                <option value="">${t('common.noCategory')}</option>
                ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">${t('labels.description')}</label>
              <textarea class="form-input" name="description" rows="2"></textarea>
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">${t('admin.productImage')}</label>
              <div class="admin-image-field">
                <div data-preview-product-create>${imagePreviewBlock(null, t('admin.newProduct'), 'square')}</div>
                ${productImageLimitHintHtml(store, products)}
                <input class="form-input" type="file" name="image" accept="image/*" ${canAddImageOnCreate ? '' : 'disabled'} />
                ${canAddImageOnCreate ? `<small class="form-hint">${PRODUCT_IMAGE_UPLOAD_HINT}</small>` : ''}
              </div>
            </div>
            <div class="admin-form-grid__full">
              <button type="submit" class="btn btn-primary">${t('admin.createItem')}</button>
            </div>
          </form>
        </details>` : (!readOnly && store.status !== 'approved' ? `
        <div class="alert" style="margin-bottom:1rem">
          ${t('admin.storeNotApprovedHint')}
        </div>` : (!readOnly && store.status === 'approved' ? `
        <div class="alert" style="margin-bottom:1rem">
          ${escapeHtml(planProductLimitMessage(store.plan_id))}
        </div>` : ''))}

      ${products.length > 0 ? `
        <div class="admin-filter-bar admin-filter-bar--compact">
          <input type="search" class="form-input admin-filter-bar__search" id="admin-products-search" placeholder="${t('admin.searchProductPlaceholder')}" autocomplete="off" />
        </div>` : ''}
      <div class="table-wrap admin-store-products-table">
        <table>
          <thead><tr><th>${t('common.product')}</th><th>${t('common.price')}</th><th>${t('common.stock')}</th><th>${t('common.active')}</th><th></th></tr></thead>
          <tbody id="admin-products-tbody">
            ${renderProductTableRows(products, categories, store, { readOnly })}
          </tbody>
        </table>
      </div>
    </div>`
}

/** Alterna visibilidade do campo banner ao mudar plan_id no formulário admin. */
function bindPlanBrandingToggle(scope) {
  scope.querySelectorAll('[data-plan-branding-form]').forEach((form) => {
    const planSelect = form.querySelector('[name="plan_id"]')
    const brandingWrap = form.querySelector('[data-branding-wrap]')
    if (!planSelect || !brandingWrap) return

    const sync = () => {
      const canBanner = planAllowsStoreBanner(planSelect.value)
      brandingWrap.querySelectorAll('[data-branding-banner]').forEach((el) => {
        el.hidden = !canBanner
        el.querySelectorAll('input[type="file"]').forEach((inp) => {
          inp.disabled = !canBanner
          if (!canBanner) inp.value = ''
        })
      })
      const locked = brandingWrap.querySelector('[data-branding-locked]')
      if (locked) locked.hidden = canBanner
    }

    planSelect.addEventListener('change', sync)
    sync()
  })
}

function quickActions(panel = 'admin') {
  const cards = []
  if (panel === 'admin') {
    cards.push(
      { href: staffHref(panel, 'lojas'), icon: '🏪', title: t('admin.quickNewStore'), text: t('admin.quickNewStoreDesc') },
      { href: staffHref(panel, 'produtos'), icon: '📦', title: t('admin.newProduct'), text: t('admin.addToCatalog') },
      { href: staffHref(panel, 'bairros'), icon: '📍', title: t('nav.staffNeighborhoods'), text: t('admin.marketplaceRegions') },
      { href: staffHref(panel, 'moderadores'), icon: '🛡️', title: t('nav.staffModerators'), text: t('admin.regionalTeam') },
      { href: stringsEditorHref(), icon: '✏️', title: t('admin.stringsEditor'), text: t('admin.stringsEditorDesc'), external: true },
    )
  }
  cards.push(
    { href: staffHref(panel, 'pedidos'), icon: '🛒', title: t('nav.staffOrders'), text: t('admin.ordersMetricsHistory') },
    { href: staffHref(panel, 'aprovacoes'), icon: '✅', title: t('nav.staffApprovals'), text: t('admin.registrationsAndPlans') },
    { href: '#/', icon: '🌐', title: t('admin.viewSite'), text: t('admin.openMarketplace'), muted: true },
  )

  return `
    <div class="admin-quick-actions">
      ${cards.map((card) => `
        <a href="${card.href}"${card.external ? ' target="_blank" rel="noopener noreferrer"' : ''} class="admin-quick-card ${card.muted ? 'admin-quick-card--muted' : ''}">
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
    { label: t('admin.metricStores'), value: metrics.totalStores, href: staffHref(panel, 'lojas') },
    { label: t('admin.metricProducts'), value: metrics.totalProducts, href: staffHref(panel, 'produtos') },
    { label: t('admin.metricOrders'), value: orderMetrics?.totalOrders ?? metrics.totalOrders, href: staffHref(panel, 'pedidos') },
    { label: t('admin.metricRevenue'), value: formatCurrency(orderMetrics?.totalRevenue ?? 0), href: staffHref(panel, 'pedidos'), compact: true },
    { label: t('admin.metricViews'), value: metrics.totalViews, href: null },
    { label: t('admin.metricPending'), value: pendingCount, href: staffHref(panel, 'aprovacoes'), highlight: pendingCount > 0 },
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
  const user = await guardStaff(main, panel)
  if (!user) return

  main.dataset.staffPanel = panel
  const menuItem = getStaffMenuItem(tab, panel)
  const storesReadOnly = isReadOnlyStaffTab(panel, 'stores')
  const productsReadOnly = isReadOnlyStaffTab(panel, 'products')

  if (tab === 'overview') {
    const overviewFetches = [
      fetchAdminMetrics(),
      loadStaffApprovalQueue(user, panel),
      fetchAllStoresAdmin(getStaffNeighborhoodScope(user, panel)),
      fetchAdminOrdersAnalytics(),
      fetchAdminOrders(5),
    ]
    if (panel === 'admin') {
      overviewFetches.push(fetchNeighborhoods({ activeOnly: false }), fetchModerators())
    }
    const overviewResults = await Promise.all(overviewFetches)
    const [metrics, queue, stores, orderAnalytics, recentOrders] = overviewResults
    const neighborhoods = panel === 'admin' ? overviewResults[5] : []
    const moderators = panel === 'admin' ? overviewResults[6] : []
    const regionalSummary = panel === 'admin'
      ? summarizeRegionalOverview(neighborhoods, stores, moderators)
      : null
    const { pendingStores: pending, planRequests, pendingTotal } = queue
    const orderMetrics = orderAnalytics.metrics

    setAdminPendingCount(pendingTotal)
    import('../ui.js').then(({ renderHeader }) => renderHeader()).catch(() => {})

    const pendingPreview = pending.slice(0, 3)

    main.innerHTML = adminPage(
      menuItem.label,
      panel === 'moderator'
        ? staffScopeSubtitle(user, panel)
        : t('admin.overviewSubtitle'),
      `
        ${quickActions(panel)}
        ${metricCards(metrics, pendingTotal, orderMetrics, panel)}
        ${regionalSummary ? renderRegionalOverviewSection(regionalSummary) : ''}
        <section class="admin-section">
          <div class="admin-section__head">
            <h2>${t('nav.staffOrders')}</h2>
            <a href="${staffHref(panel, 'pedidos')}" class="btn btn-outline btn-sm">${t('common.viewAll')}</a>
          </div>
          ${orderMetricsChips(orderMetrics)}
          ${orderAnalytics.timeline.length > 0
            ? renderOrdersChart(buildOrderPeriodSeries(orderAnalytics.timeline, '7d'), { period: '7d', metric: 'orders', compact: true })
            : ''}
          ${recentOrders.length === 0
            ? adminEmptyState('🛒', t('admin.noOrdersTitle'), t('admin.noOrdersOnPlatform'))
            : `<div class="table-wrap admin-orders-table" style="margin-top:1rem">
                <table>
                  <thead><tr><th>${t('common.date')}</th><th>${t('common.store')}</th><th>${t('common.customer')}</th><th>${t('common.total')}</th><th>${t('labels.status')}</th></tr></thead>
                  <tbody>${renderAdminOrderRows(recentOrders, { compact: true })}</tbody>
                </table>
              </div>`}
        </section>
        <section class="admin-section">
          <div class="admin-section__head">
            <h2>${t('admin.storeStatusTitle')}</h2>
            <a href="${staffHref(panel, 'lojas')}" class="btn btn-outline btn-sm">${storesReadOnly ? t('admin.viewStores') : t('admin.manageStores')}</a>
          </div>
          ${storeStatusSummary(stores)}
        </section>
        <section class="admin-section">
          <div class="admin-section__head">
            <h2>${t('admin.recentApprovals')}</h2>
            ${pendingTotal > 0 ? `<a href="${staffHref(panel, 'aprovacoes')}" class="btn btn-outline btn-sm">${t('admin.viewAllPending', { count: pendingTotal })}</a>` : ''}
          </div>
          ${pendingPreview.length === 0 && planRequests.length === 0
            ? adminEmptyState('✅', t('admin.allCaughtUpTitle'), t('admin.allCaughtUpBody'))
            : `${pendingPreview.length > 0 ? `<div class="admin-cards-list">
                ${pendingPreview.map((s) => `
                  <article class="admin-list-card admin-list-card--highlight">
                    <div class="admin-list-card__main">
                      <strong>${escapeHtml(s.name)}</strong>
                      <p>${escapeHtml(s.neighborhood?.name ?? '—')} · ${escapeHtml(s.city)}, ${escapeHtml(s.state)} · ${formatDate(s.created_at)}</p>
                      <p class="admin-list-card__meta">${escapeHtml(s.owner?.name ?? t('admin.merchant'))} · ${escapeHtml(s.owner?.email ?? '')}</p>
                    </div>
                    <div class="admin-list-card__actions">
                      <button type="button" class="btn btn-primary btn-sm" data-approve="${s.id}">${t('labels.approve')}</button>
                      <button type="button" class="btn btn-outline btn-sm" data-reject="${s.id}">${t('labels.reject')}</button>
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
    const { pendingStores: pending, planRequests, pendingTotal } = await loadStaffApprovalQueue(user, panel)
    setAdminPendingCount(pendingTotal)
    import('../ui.js').then(({ renderHeader }) => renderHeader()).catch(() => {})

    main.innerHTML = adminPage(
      menuItem.label,
      panel === 'moderator'
        ? `${staffScopeSubtitle(user, panel)} · ${t('admin.pendingIssues', { count: pendingTotal })}`
        : t('admin.pendingAwaitingReview', { count: pendingTotal }),
      pendingTotal === 0
        ? adminEmptyState('✅', t('admin.emptyQueueTitle'), t('admin.emptyQueueBody'))
        : `${renderPlanChangeApprovalCards(planRequests)}
          ${pending.length > 0 ? `
            <section class="admin-section">
              <div class="admin-section__head">
                <h2>${t('admin.storeRegistrations')}</h2>
                <span class="admin-stat-chip admin-stat-chip--pending">${t('admin.pendingChip', { count: pending.length })}</span>
              </div>
              <div class="admin-cards-list">
                ${pending.map((s) => `
                  <article class="admin-approval-card">
                    <div class="admin-approval-card__head">
                      <div>
                        <h3>${escapeHtml(s.name)}</h3>
                        <p>${escapeHtml(s.neighborhood?.name ?? '—')} · ${escapeHtml(s.city)}, ${escapeHtml(s.state)} · ${formatDate(s.created_at)}</p>
                      </div>
                      ${statusBadge(s.status)}
                    </div>
                    <dl class="admin-approval-card__details">
                      <div><dt>${t('admin.merchant')}</dt><dd>${escapeHtml(s.owner?.name ?? '—')}</dd></div>
                      <div><dt>${t('labels.email')}</dt><dd>${escapeHtml(s.owner?.email ?? '—')}</dd></div>
                      <div><dt>${t('labels.whatsapp')}</dt><dd>${escapeHtml(s.whatsapp)}</dd></div>
                      <div><dt>${t('labels.category')}</dt><dd>${escapeHtml(s.category?.name ?? '—')}</dd></div>
                    </dl>
                    <div class="admin-approval-card__actions">
                      <button type="button" class="btn btn-primary btn-sm" data-approve="${s.id}">${t('admin.approveStore')}</button>
                      <button type="button" class="btn btn-outline btn-sm" data-reject="${s.id}">${t('labels.reject')}</button>
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
    const [stores, categories, queue, neighborhoods] = await Promise.all([
      fetchAllStoresAdmin(getStaffNeighborhoodScope(user, panel)),
      fetchCategories(),
      loadStaffApprovalQueue(user, panel),
      fetchNeighborhoods({ activeOnly: false }),
    ])
    const merchants = storesReadOnly ? [] : await fetchMerchants()

    setAdminPendingCount(queue.pendingTotal)
    import('../ui.js').then(({ renderHeader }) => renderHeader()).catch(() => {})

    main.innerHTML = adminPage(
      menuItem.label,
      panel === 'moderator'
        ? `${staffScopeSubtitle(user, panel)} · ${t('admin.storesInRegion', { count: stores.length })}`
        : storesReadOnly
          ? t('admin.storesReadOnly', { count: stores.length })
          : t('admin.storesRegistered', { count: stores.length }),
      `
        <div id="admin-store-msg"></div>
        ${storesReadOnly ? `<p class="admin-readonly-hint">${t('moderator.readonlyStoresHint')}</p>` : ''}
        ${!storesReadOnly && merchants.length === 0
          ? `<div class="empty-state" style="margin-bottom:1rem"><p>${t('admin.noMerchantsHint')}</p></div>`
          : ''}
        ${storesReadOnly ? '' : `<details class="admin-form-panel" open ${merchants.length === 0 ? 'style="opacity:0.6;pointer-events:none"' : ''}>
          <summary>${t('admin.newStoreSummary')}</summary>
          <form id="admin-store-form" class="admin-form-grid" data-plan-branding-form>
            <div class="form-group">
              <label class="form-label">${t('admin.responsibleMerchant')}</label>
              <select class="form-input" name="owner_id" required>
                <option value="">${t('app.selectPlaceholder')}</option>
                ${merchants.map((m) => `<option value="${m.id}">${escapeHtml(m.name)} (${escapeHtml(m.email)})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">${t('labels.storeName')}</label>
              <input class="form-input" name="name" required />
            </div>
            <div class="form-group">
              <label class="form-label">${t('labels.category')}</label>
              <select class="form-input" name="category_id" required>
                ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">${t('labels.whatsapp')}</label>
              <input class="form-input" name="whatsapp" required placeholder="${t('admin.whatsappPlaceholder')}" />
            </div>
            <div class="form-group">
              <label class="form-label">${t('labels.neighborhoodRegion')}</label>
              <select class="form-input" name="neighborhood_id" required>
                <option value="">${t('app.selectPlaceholder')}</option>
                ${renderNeighborhoodOptions(neighborhoods)}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">${t('labels.city')}</label>
              <input class="form-input" name="city" required />
            </div>
            <div class="form-group">
              <label class="form-label">${t('labels.state')}</label>
              <input class="form-input" name="state" required maxlength="2" value="RJ" />
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">${t('labels.description')}</label>
              <textarea class="form-input" name="description" rows="2"></textarea>
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="form-label">${t('labels.address')}</label>
              <input class="form-input" name="address" />
            </div>
            <div class="form-group">
              <label class="form-label">${t('admin.openingHours')}</label>
              <input class="form-input" name="opening_hours" placeholder="${t('admin.openingHoursPlaceholder')}" />
            </div>
            <div class="form-group">
              <label class="form-label">${t('admin.themeColor')}</label>
              <select class="form-input" name="theme_color">
                ${STORE_THEME_COLORS.map((c) => `<option value="${c.id}">${c.id}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">${t('labels.plan')}</label>
              <select class="form-input" name="plan_id">
                ${SUBSCRIPTION_PLANS.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
              </select>
            </div>
            <div data-branding-wrap class="admin-form-grid__full admin-form-grid">
              ${storeBrandingFieldsHtml('free')}
            </div>
            <div class="form-group admin-form-grid__full">
              <label class="admin-check">
                <input type="checkbox" name="approved" checked />
                ${t('admin.publishStoreImmediately')}
              </label>
            </div>
            <div class="admin-form-grid__full">
              <button type="submit" class="btn btn-primary">${t('admin.createStore')}</button>
            </div>
          </form>
        </details>`}
        ${stores.length > 0 ? (panel === 'admin'
          ? adminStoresFilterBar({
            searchId: 'admin-stores-search',
            searchPlaceholder: t('admin.searchStoresNeighborhood'),
            neighborhoods,
            chips: [
              { id: 'all', label: t('common.allFeminine'), active: true },
              { id: 'approved', label: t('storeStatus.approvedPlural'), active: false },
              { id: 'pending', label: t('storeStatus.pendingPlural'), active: false },
              { id: 'blocked', label: t('storeStatus.blockedPlural'), active: false },
            ],
          })
          : adminFilterBar({
            searchId: 'admin-stores-search',
            searchPlaceholder: t('admin.searchStoresCity'),
            chips: [
              { id: 'all', label: t('common.allFeminine'), active: true },
              { id: 'approved', label: t('storeStatus.approvedPlural'), active: false },
              { id: 'pending', label: t('storeStatus.pendingPlural'), active: false },
              { id: 'blocked', label: t('storeStatus.blockedPlural'), active: false },
            ],
          })) : ''}
        ${storeStatusSummary(stores)}
        <div class="table-wrap admin-stores-table" style="margin-top:1rem">
          <table>
            <thead><tr><th>${t('common.store')}</th><th>${t('common.neighborhood')}</th><th>${t('admin.merchant')}</th><th>${t('labels.city')}</th><th>${t('labels.status')}</th><th>${t('labels.plan')}</th><th></th></tr></thead>
            <tbody>
              ${stores.length === 0 ? `<tr><td colspan="7">${adminEmptyState('🏪', t('admin.noStoresTitle'), t('admin.noStoresBody'))}</td></tr>` : stores.map((s) => `
                <tr data-store-row data-store-id="${s.id}" data-store-status="${s.status}" data-store-neighborhood="${s.neighborhood_id ?? ''}" data-store-search="${escapeHtml(`${s.name} ${s.neighborhood?.name ?? ''} ${s.city} ${s.state} ${s.owner?.name ?? ''} ${s.owner?.email ?? ''}`.toLowerCase())}">
                  <td>
                    <div class="admin-table-thumb">
                      ${s.logo ? `<img src="${escapeHtml(s.logo)}" alt="" />` : '<span>🏪</span>'}
                    </div>
                    <strong>${escapeHtml(s.name)}</strong><br><small>/${escapeHtml(s.slug)}</small>
                  </td>
                  <td>${escapeHtml(s.neighborhood?.name ?? '—')}</td>
                  <td>${escapeHtml(s.owner?.name ?? '—')}<br><small>${escapeHtml(s.owner?.email ?? '')}</small></td>
                  <td>${escapeHtml(s.city)}, ${escapeHtml(s.state)}</td>
                  <td>${statusBadge(s.status)}</td>
                  <td>${escapeHtml(getPlanById(s.plan_id).name)}</td>
                  <td style="white-space:nowrap">
                    <a href="#${staffProductsPath(panel, s.id)}" class="btn btn-outline btn-sm">${t('nav.staffProducts')}</a>
                    ${storesReadOnly ? '' : `<button type="button" class="btn btn-outline btn-sm" data-edit-store="${s.id}">${t('labels.edit')}</button>`}
                    ${s.status === 'approved' ? `<a href="#/loja/${escapeHtml(s.slug)}" class="btn btn-outline btn-sm">${t('common.view')}</a>` : ''}
                  </td>
                </tr>
                ${storesReadOnly ? '' : `<tr class="admin-edit-row" id="edit-store-row-${s.id}" hidden>
                  <td colspan="7">
                    <form class="admin-edit-panel admin-form-grid" data-store-edit="${s.id}" data-plan-branding-form>
                      <div class="form-group">
                        <label class="form-label">${t('labels.name')}</label>
                        <input class="form-input" name="name" value="${escapeHtml(s.name)}" required />
                      </div>
                      <div class="form-group">
                        <label class="form-label">${t('labels.neighborhoodRegion')}</label>
                        <select class="form-input" name="neighborhood_id" required>
                          ${renderNeighborhoodOptions(neighborhoods, s.neighborhood_id)}
                        </select>
                      </div>
                      <div class="form-group">
                        <label class="form-label">${t('labels.whatsapp')}</label>
                        <input class="form-input" name="whatsapp" value="${escapeHtml(s.whatsapp)}" required />
                      </div>
                      <div class="form-group">
                        <label class="form-label">${t('labels.city')}</label>
                        <input class="form-input" name="city" value="${escapeHtml(s.city)}" required />
                      </div>
                      <div class="form-group">
                        <label class="form-label">${t('labels.state')}</label>
                        <input class="form-input" name="state" value="${escapeHtml(s.state)}" maxlength="2" required />
                      </div>
                      <div class="form-group">
                        <label class="form-label">${t('labels.category')}</label>
                        <select class="form-input" name="category_id">
                          ${categories.map((c) => `<option value="${c.id}" ${s.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                        </select>
                      </div>
                      <div class="form-group">
                        <label class="form-label">${t('admin.themeColor')}</label>
                        <select class="form-input" name="theme_color">
                          ${STORE_THEME_COLORS.map((c) => `<option value="${c.id}" ${s.theme_color === c.id ? 'selected' : ''}>${c.id}</option>`).join('')}
                        </select>
                      </div>
                      <div class="form-group">
                        <label class="form-label">${t('labels.status')}</label>
                        <select class="form-input" name="status">
                          <option value="pending" ${s.status === 'pending' ? 'selected' : ''}>${t('storeStatus.pending')}</option>
                          <option value="approved" ${s.status === 'approved' ? 'selected' : ''}>${t('storeStatus.approved')}</option>
                          <option value="blocked" ${s.status === 'blocked' ? 'selected' : ''}>${t('storeStatus.blocked')}</option>
                        </select>
                      </div>
                      <div class="form-group">
                        <label class="form-label">${t('labels.plan')}</label>
                        <select class="form-input" name="plan_id">
                          ${SUBSCRIPTION_PLANS.map((p) => `<option value="${p.id}" ${s.plan_id === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
                        </select>
                      </div>
                      <div class="form-group admin-form-grid__full">
                        <label class="form-label">${t('labels.description')}</label>
                        <textarea class="form-input" name="description" rows="2">${escapeHtml(s.description ?? '')}</textarea>
                      </div>
                      <div class="form-group admin-form-grid__full">
                        <label class="form-label">${t('labels.address')}</label>
                        <input class="form-input" name="address" value="${escapeHtml(s.address ?? '')}" />
                      </div>
                      <div class="form-group admin-form-grid__full">
                        <label class="form-label">${t('admin.openingHours')}</label>
                        <input class="form-input" name="opening_hours" value="${escapeHtml(s.opening_hours ?? '')}" />
                      </div>
                      <div class="form-group admin-form-grid__full">
                        <label class="form-label">${t('admin.instagram')}</label>
                        <input class="form-input" name="instagram" value="${escapeHtml(s.instagram ?? '')}" placeholder="${t('admin.instagramPlaceholder')}" />
                      </div>
                      <div data-branding-wrap class="admin-form-grid__full admin-form-grid">
                        ${storeBrandingFieldsHtml(s.plan_id, s)}
                      </div>
                      <div class="admin-form-grid__full admin-edit-panel__actions">
                        <button type="submit" class="btn btn-primary btn-sm">${t('admin.saveStore')}</button>
                        <button type="button" class="btn btn-outline btn-sm" data-cancel-store="${s.id}">${t('labels.cancel')}</button>
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
    if (panel === 'admin') bindStoreListFilters(main)
    else {
      bindListFilters(main, {
        searchId: 'admin-stores-search',
        rowSelector: '[data-store-row]',
        getSearchText: (row) => row.dataset.storeSearch ?? '',
        getFilterValue: (row) => row.dataset.storeStatus ?? '',
        linkedEditPrefix: 'edit-store-row-',
      })
    }
    return
  }

  if (tab === 'products') {
    const [allProducts, stores, categories, queue] = await Promise.all([
      fetchAdminProducts(),
      fetchAllStoresAdmin(getStaffNeighborhoodScope(user, panel)),
      fetchCategories(),
      loadStaffApprovalQueue(user, panel),
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
        ? (productsReadOnly ? t('admin.productsReadOnly', { name: selectedStore.name }) : t('admin.managingProducts', { name: selectedStore.name }))
        : t('admin.productsAcrossStores', { products: allProducts.length, stores: stores.length }),
      `
        ${productsReadOnly ? `<p class="admin-readonly-hint">${t('admin.readonlyProductsHint')}</p>` : ''}
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
      loadStaffApprovalQueue(user, panel),
    ])
    const orderMetrics = orderAnalytics.metrics

    setAdminPendingCount(queue.pendingTotal)
    import('../ui.js').then(({ renderHeader }) => renderHeader()).catch(() => {})

    main.innerHTML = adminPage(
      menuItem.label,
      t('admin.ordersSalesSubtitle', { count: orderMetrics.totalOrders, revenue: formatCurrency(orderMetrics.totalRevenue) }),
      `
        ${orderMetricsChips(orderMetrics)}
        ${renderOrdersChart(buildOrderPeriodSeries(orderAnalytics.timeline, '30d'), { period: '30d', metric: 'orders' })}
        ${orders.length > 0 ? `
          <div class="admin-orders-toolbar">
            ${adminOrdersFilterBar(storesFromOrders(orders))}
            <button type="button" class="btn btn-outline btn-sm" id="admin-orders-export">${t('common.exportCsv')}</button>
          </div>` : ''}
        <div class="table-wrap admin-orders-table" style="margin-top:1rem">
          <table>
            <thead><tr>
              <th class="admin-table-sortable">
                <button type="button" class="admin-table-sort active" id="admin-orders-sort" data-order-sort="desc" aria-label="${t('common.sortByDateRecent')}">
                  ${t('common.date')} <span class="admin-table-sort__icon" aria-hidden="true">↓</span>
                </button>
              </th>
              <th>${t('common.store')}</th><th>${t('common.customer')}</th><th>${t('labels.phone')}</th><th>${t('common.total')}</th><th>${t('labels.status')}</th>
            </tr></thead>
            <tbody id="admin-orders-tbody">
              ${orders.length === 0
                ? `<tr><td colspan="6">${adminEmptyState('🛒', t('admin.noOrdersTitle'), t('admin.noOrdersBody'))}</td></tr>`
                : `${renderAdminOrderRows(orders)}
                  <tr data-orders-empty hidden>
                    <td colspan="6">${adminEmptyState('🔍', t('common.noResults'), t('common.noOrdersFilter'))}</td>
                  </tr>`}
            </tbody>
          </table>
        </div>
        ${orders.length > 0 ? '<div id="admin-orders-pagination-wrap"></div>' : ''}
      `,
      orders.length > 0
        ? `<span class="admin-export-hint">${t('admin.exportFilteredHint')}</span>`
        : '',
      panel
    )

    bindOrdersChart(main, orderAnalytics.timeline)
    bindOrdersCsvExport(main, orders)
    bindOrdersListFilters(main)
    return
  }

  if (tab === 'neighborhoods') {
    if (panel !== 'admin') {
      navigate('/moderador')
      return
    }

    const [neighborhoods, stores, moderators] = await Promise.all([
      fetchNeighborhoods({ activeOnly: false }),
      fetchAllStoresAdmin(),
      fetchModerators(),
    ])
    const regionalSummary = summarizeRegionalOverview(neighborhoods, stores, moderators)
    const summaryById = Object.fromEntries(regionalSummary.rows.map((row) => [row.neighborhood.id, row]))

    main.innerHTML = adminPage(
      menuItem.label,
      t('admin.neighborhoodsSubtitle'),
      `
        <section class="admin-section">
          <div class="admin-section__head"><h2>${t('admin.newNeighborhood')}</h2></div>
          <form id="neighborhood-form" class="admin-form-grid">
            <div class="form-group">
              <label class="form-label">${t('labels.name')}</label>
              <input class="form-input" name="name" required placeholder="${t('admin.neighborhoodNamePlaceholder')}" />
            </div>
            <div class="form-group">
              <label class="form-label">${t('labels.city')}</label>
              <input class="form-input" name="city" required placeholder="${t('admin.cityPlaceholder')}" />
            </div>
            <div class="form-group">
              <label class="form-label">${t('labels.state')}</label>
              <input class="form-input" name="state" maxlength="2" required value="RJ" />
            </div>
            <div class="admin-form-grid__full">
              <div id="neighborhood-form-msg"></div>
              <button type="submit" class="btn btn-primary btn-sm">${t('admin.createNeighborhood')}</button>
            </div>
          </form>
        </section>
        <section class="admin-section">
          <div class="admin-section__head">
            <h2>${t('admin.registeredNeighborhoods')}</h2>
            <span class="admin-stat-chip admin-stat-chip--sent">${t('admin.regionsCount', { count: neighborhoods.length })}</span>
          </div>
          ${neighborhoods.length === 0
            ? adminEmptyState('📍', t('admin.noNeighborhoodsTitle'), t('admin.createFirstNeighborhood'))
            : `<div class="table-wrap">
                <table>
                  <thead><tr><th>${t('labels.name')}</th><th>${t('labels.city')}</th><th>${t('nav.staffStores')}</th><th>${t('nav.staffModerators')}</th><th>${t('common.slug')}</th><th>${t('labels.status')}</th><th></th></tr></thead>
                  <tbody>
                    ${neighborhoods.map((n) => {
                      const row = summaryById[n.id]
                      const storeCount = row?.storeCount ?? 0
                      const pendingCount = row?.pendingCount ?? 0
                      const moderatorCount = row?.moderatorCount ?? 0
                      const canDelete = storeCount === 0 && moderatorCount === 0
                      const deleteTitle = !canDelete
                        ? (storeCount > 0
                          ? t('admin.neighborhoodHasStores', { count: storeCount })
                          : t('admin.neighborhoodHasModerators', { count: moderatorCount }))
                        : t('admin.deleteNeighborhoodPermanent')
                      return `
                      <tr data-neighborhood-row data-neighborhood-id="${n.id}">
                        <td><strong>${escapeHtml(n.name)}</strong></td>
                        <td>${escapeHtml(n.city)}, ${escapeHtml(n.state)}</td>
                        <td>
                          ${storeCount}${pendingCount > 0 ? `<br><small>${t('admin.pendingChip', { count: pendingCount })}</small>` : ''}
                        </td>
                        <td>${moderatorCount > 0 ? moderatorCount : '<span class="admin-stat-chip admin-stat-chip--pending">0</span>'}</td>
                        <td><code>/${escapeHtml(n.slug)}</code></td>
                        <td>${n.active ? `<span class="badge badge-approved">${t('storeStatus.active')}</span>` : `<span class="badge badge-blocked">${t('storeStatus.inactive')}</span>`}</td>
                        <td style="white-space:nowrap">
                          <button type="button" class="btn btn-outline btn-sm" data-edit-neighborhood="${n.id}">${t('labels.edit')}</button>
                          <button type="button" class="btn btn-outline btn-sm" data-toggle-neighborhood="${n.id}" data-active="${n.active ? '0' : '1'}">
                            ${n.active ? t('common.deactivate') : t('common.activate')}
                          </button>
                          <button
                            type="button"
                            class="btn btn-outline btn-sm"
                            data-delete-neighborhood="${n.id}"
                            data-neighborhood-name="${escapeHtml(n.name)}"
                            ${canDelete ? '' : 'disabled'}
                            title="${escapeHtml(deleteTitle)}"
                          >${t('labels.delete')}</button>
                        </td>
                      </tr>
                      <tr class="admin-edit-row" id="edit-neighborhood-row-${n.id}" hidden>
                        <td colspan="7">
                          <form class="admin-edit-panel admin-form-grid" data-neighborhood-edit="${n.id}">
                            <div class="form-group">
                              <label class="form-label">${t('labels.name')}</label>
                              <input class="form-input" name="name" value="${escapeHtml(n.name)}" required />
                            </div>
                            <div class="form-group">
                              <label class="form-label">${t('labels.city')}</label>
                              <input class="form-input" name="city" value="${escapeHtml(n.city)}" required />
                            </div>
                            <div class="form-group">
                              <label class="form-label">${t('labels.state')}</label>
                              <input class="form-input" name="state" value="${escapeHtml(n.state)}" maxlength="2" required />
                            </div>
                            <div class="form-group admin-form-grid__full">
                              <p class="form-hint">${t('admin.slugAutoUpdateHint')}</p>
                            </div>
                            <div class="admin-form-grid__full admin-edit-panel__actions">
                              <button type="submit" class="btn btn-primary btn-sm">${t('admin.saveNeighborhood')}</button>
                              <button type="button" class="btn btn-outline btn-sm" data-cancel-neighborhood="${n.id}">${t('labels.cancel')}</button>
                            </div>
                          </form>
                        </td>
                      </tr>`
                    }).join('')}
                  </tbody>
                </table>
              </div>`}
        </section>
      `,
      '',
      panel
    )

    bindNeighborhoodManagement(main)
    return
  }

  if (tab === 'moderators') {
    if (panel !== 'admin') {
      navigate('/moderador')
      return
    }

    const [moderators, neighborhoods] = await Promise.all([
      fetchModerators(),
      fetchNeighborhoods({ activeOnly: false }),
    ])

    main.innerHTML = adminPage(
      menuItem.label,
      t('admin.moderatorsSubtitle'),
      `
        <section class="admin-section admin-moderators-promote">
          <div class="admin-section__head">
            <h2>${t('admin.promoteUser')}</h2>
          </div>
          <p class="admin-moderators-promote__hint">
            ${t('admin.promoteUserHint')}
          </p>
          <form id="promote-moderator-form" class="admin-moderators-promote__form">
            <div class="form-group">
              <label class="form-label" for="promote-moderator-email">${t('admin.userEmail')}</label>
              <input class="form-input" type="email" id="promote-moderator-email" name="email" placeholder="${t('admin.userEmailPlaceholder')}" required autocomplete="off" />
            </div>
            <div class="form-group">
              <label class="form-label" for="promote-moderator-neighborhood">${t('labels.neighborhoodRegion')}</label>
              <select class="form-input" id="promote-moderator-neighborhood" name="neighborhood_id" required>
                <option value="">${t('app.selectPlaceholder')}</option>
                ${renderNeighborhoodOptions(neighborhoods.filter((n) => n.active))}
              </select>
            </div>
            <div class="form-group admin-form-grid__full">
              <span class="form-label">${t('labels.permissions')}</span>
              <div class="admin-permission-list">
                ${renderModeratorPermissionFields(null, { idPrefix: 'promote-' })}
              </div>
            </div>
            <div id="promote-moderator-msg"></div>
            <button type="submit" class="btn btn-primary btn-sm">${t('admin.promoteModerator')}</button>
          </form>
        </section>
        <section class="admin-section">
          <div class="admin-section__head">
            <h2>${t('admin.activeModerators')}</h2>
            <span class="admin-stat-chip admin-stat-chip--sent" id="admin-moderators-count">${t('admin.moderatorsRegistered', { count: moderators.length })}</span>
          </div>
          <p class="form-hint" style="margin-bottom:1rem">
            ${t('admin.moderatorsPermissionsHint')}
          </p>
          ${moderators.length === 0
            ? adminEmptyState('🛡️', t('admin.noModeratorsTitle'), t('admin.noModeratorsBody'))
            : `
              <div class="admin-filter-bar admin-filter-bar--compact">
                <input
                  type="search"
                  class="form-input admin-filter-bar__search"
                  id="admin-moderators-search"
                  placeholder="${t('admin.searchModeratorsPlaceholder')}"
                  autocomplete="off"
                />
              </div>
              <div class="table-wrap admin-moderators-table">
                <table>
                  <thead><tr>
                    <th class="admin-table-sortable">
                      <button type="button" class="admin-table-sort" id="admin-moderators-sort-name" data-moderator-sort="name" aria-label="${t('admin.sortNameAsc')}">
                        ${t('labels.name')} <span class="admin-table-sort__icon" aria-hidden="true"></span>
                      </button>
                    </th>
                    <th class="admin-table-sortable">
                      <button type="button" class="admin-table-sort" id="admin-moderators-sort-email" data-moderator-sort="email" aria-label="${t('admin.sortEmailAsc')}">
                        ${t('labels.email')} <span class="admin-table-sort__icon" aria-hidden="true"></span>
                      </button>
                    </th>
                    <th>${t('common.neighborhood')}</th>
                    <th>${t('labels.permissions')}</th>
                    <th class="admin-table-sortable">
                      <button type="button" class="admin-table-sort active" id="admin-moderators-sort-created" data-moderator-sort="created" data-moderator-sort-dir="desc" aria-label="${t('common.sortByDateRecent')}">
                        ${t('common.since')} <span class="admin-table-sort__icon" aria-hidden="true">↓</span>
                      </button>
                    </th>
                    <th></th>
                  </tr></thead>
                  <tbody id="admin-moderators-tbody">
                    ${renderModeratorTableRows(moderators, neighborhoods)}
                    <tr data-moderators-empty hidden>
                      <td colspan="6">${adminEmptyState('🔍', t('common.noResults'), t('admin.noModeratorsFilter'))}</td>
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

    bindModeratorManagement(main, neighborhoods)
    return
  }

  if (tab === 'account') {
    const emailSection = panel === 'admin'
      ? `
          <form id="admin-email-form" class="admin-password-form">
            <h3 class="admin-account-card__section-title">${t('admin.changeEmail')}</h3>
            <div class="form-group">
              <label class="form-label">${t('admin.newEmail')}</label>
              <input class="form-input" type="email" name="email" required autocomplete="email" placeholder="${t('admin.emailPlaceholder')}" />
            </div>
            <p class="form-hint">${t('admin.emailConfirmationHint')}</p>
            <div id="admin-email-msg"></div>
            <button type="submit" class="btn btn-primary btn-sm">${t('admin.changeEmail')}</button>
          </form>
          <hr class="admin-account-card__divider" />
        `
      : ''

    main.innerHTML = adminPage(
      menuItem.label,
      panel === 'admin' ? t('admin.accountSubtitleAdmin') : t('admin.accountSubtitleModerator'),
      `
        <div class="admin-account-card">
          <p class="admin-account-card__email"><span>${t('common.account')}</span> ${escapeHtml(user.email)}</p>
          ${panel === 'moderator' ? `
            <p class="form-hint" style="margin-bottom:1rem">
              <strong>${t('admin.regionLabel')}</strong> ${user.neighborhood ? escapeHtml(formatNeighborhoodLabel(user.neighborhood)) : t('admin.regionNotAssignedAdmin')}
            </p>
          ` : ''}
          ${emailSection}
          <form id="admin-password-form" class="admin-password-form">
            <h3 class="admin-account-card__section-title">${t('admin.changePassword')}</h3>
            <div class="form-group">
              <label class="form-label">${t('labels.newPassword')}</label>
              <input class="form-input" type="password" name="password" required minlength="6" autocomplete="new-password" />
            </div>
            <div class="form-group">
              <label class="form-label">${t('labels.confirmNewPassword')}</label>
              <input class="form-input" type="password" name="confirm" required minlength="6" autocomplete="new-password" />
            </div>
            <div id="admin-password-msg"></div>
            <button type="submit" class="btn btn-primary btn-sm">${t('admin.changePassword')}</button>
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
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t('common.creating') }
    try {
      const store = await createStoreAsAdmin({
        owner_id: f.owner_id.value,
        name: f.name.value.trim(),
        category_id: f.category_id.value,
        whatsapp: f.whatsapp.value.trim(),
        neighborhood_id: f.neighborhood_id.value,
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
        if (bannerFile && !planAllowsStoreBanner(f.plan_id.value)) {
          throw new Error(FREE_PLAN_BANNER_MESSAGE)
        }
        await updateStoreAsAdmin(store.id, {
          plan_id: f.plan_id.value,
          logo: logoFile ?? undefined,
          banner: bannerFile ?? undefined,
        })
      }

      showToast(t('admin.storeCreatedNamed', { name: store.name }))
      navigate(`${STAFF_PANELS[main.dataset.staffPanel || 'admin'].basePath}/lojas`)
    } catch (err) {
      msgEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = t('admin.createStore') }
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
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t('common.saving') }
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
          neighborhood_id: form.neighborhood_id.value,
          description: form.description.value.trim(),
          address: form.address.value.trim(),
          opening_hours: form.opening_hours.value.trim(),
          instagram: instagramCheck.handle || null,
          logo: logoInput?.files?.[0],
          banner: bannerInput?.files?.[0],
          remove_logo: !logoInput?.files?.[0] && form.remove_logo?.checked,
          remove_banner: !bannerInput?.files?.[0] && form.remove_banner?.checked,
        })
        showToast(t('admin.storeUpdated'))
        rerenderStaff(main, 'stores')
      } catch (err) {
        showToast(err.message)
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = t('admin.saveStore') }
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
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t('common.creating') }
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
      showToast(t('admin.itemCreated'))
      navigate(staffProductsPath(main.dataset.staffPanel || 'admin', storeId || selectedStoreId))
    } catch (err) {
      msgEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = t('admin.createProduct') }
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
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t('common.saving') }
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
        showToast(t('admin.itemUpdated'))
        rerenderStaff(main, 'products', selectedStoreId)
      } catch (err) {
        showToast(err.message)
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = t('admin.saveProduct') }
      }
    })
  })

  main.querySelectorAll('[data-del-product]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm(t('admin.confirmDeleteProduct'))) return
      await deleteProduct(btn.dataset.delProduct)
      showToast(t('admin.productDeleted'))
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
      asc: t('admin.sortNameAsc'),
      desc: t('admin.sortNameDesc'),
    },
    email: {
      asc: t('admin.sortEmailAsc'),
      desc: t('admin.sortEmailDesc'),
    },
    created: {
      asc: t('common.sortByDateOldest'),
      desc: t('common.sortByDateRecent'),
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

function renderModeratorTableRows(moderators, neighborhoods = []) {
  if (moderators.length === 0) return ''

  return moderators.map((m) => `
    <tr
      data-moderator-row
      data-moderator-search="${escapeHtml(`${m.name} ${m.email} ${m.neighborhood?.name ?? ''}`.toLowerCase())}"
      data-moderator-name="${escapeHtml(m.name)}"
      data-moderator-email="${escapeHtml(m.email)}"
      data-moderator-created="${m.created_at}"
    >
      <td><strong>${escapeHtml(m.name)}</strong></td>
      <td>${escapeHtml(m.email)}</td>
      <td>${m.neighborhood ? escapeHtml(formatNeighborhoodLabel(m.neighborhood)) : `<span class="admin-permission-badge admin-permission-badge--muted">${t('admin.noNeighborhoodAssigned')}</span>`}</td>
      <td><div class="admin-permission-badges">${renderModeratorPermissionBadges(m)}</div></td>
      <td>${formatDate(m.created_at)}</td>
      <td style="white-space:nowrap">
        <button type="button" class="btn btn-outline btn-sm" data-edit-moderator="${m.id}">${t('labels.permissions')}</button>
        <button type="button" class="btn btn-outline btn-sm" data-demote-moderator="${m.id}" data-moderator-name="${escapeHtml(m.name)}">
          ${t('admin.removeAccess')}
        </button>
      </td>
    </tr>
    <tr class="admin-edit-row" id="edit-moderator-row-${m.id}" hidden>
      <td colspan="6">
        <form class="admin-edit-panel admin-moderator-permissions-form" data-moderator-edit="${m.id}">
          <h3 class="admin-account-card__section-title">${t('admin.permissionsOf', { name: escapeHtml(m.name) })}</h3>
          <div class="admin-form-grid">
            <div class="form-group">
              <label class="form-label">${t('labels.neighborhoodRegion')}</label>
              <select class="form-input" name="neighborhood_id" required>
                <option value="">${t('app.selectPlaceholder')}</option>
                ${renderNeighborhoodOptions(neighborhoods.filter((n) => n.active), m.neighborhood_id)}
              </select>
            </div>
            <div class="form-group admin-form-grid__full">
              <span class="form-label">${t('admin.extraPermissions')}</span>
              <div class="admin-permission-list">
                ${renderModeratorPermissionFields(m, { idPrefix: `edit-${m.id}-` })}
              </div>
              <p class="form-hint">${t('admin.storeApprovalAlwaysAllowed')}</p>
            </div>
          </div>
          <div class="admin-edit-panel__actions">
            <button type="submit" class="btn btn-primary btn-sm">${t('admin.savePermissions')}</button>
            <button type="button" class="btn btn-outline btn-sm" data-cancel-moderator="${m.id}">${t('labels.cancel')}</button>
          </div>
        </form>
      </td>
    </tr>
  `).join('')
}

function renderModeratorsPaginationHtml({ currentPage, totalPages, matchedCount }) {
  if (matchedCount === 0) return ''

  const start = (currentPage - 1) * MODERATORS_PAGE_SIZE + 1
  const end = Math.min(currentPage * MODERATORS_PAGE_SIZE, matchedCount)
  const label = matchedCount === 1 ? t('pagination.moderatorSingular') : t('pagination.moderatorPlural')

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
        <button type="button" class="btn btn-outline btn-sm" data-moderator-page-prev ${currentPage <= 1 ? 'disabled' : ''}>${t('pagination.previous')}</button>
        <span class="admin-pagination__status">${t('pagination.pageStatus', { current: currentPage, total: totalPages })}</span>
        <button type="button" class="btn btn-outline btn-sm" data-moderator-page-next ${currentPage >= totalPages ? 'disabled' : ''}>${t('pagination.next')}</button>
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
        ? t('admin.moderatorsFiltered', { matched: matchedRows.length, total: rows.length })
        : t('admin.moderatorsRegistered', { count: rows.length })
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

function bindNeighborhoodManagement(main) {
  main.querySelector('#neighborhood-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const msgEl = main.querySelector('#neighborhood-form-msg')
    try {
      await createNeighborhood({
        name: form.name.value,
        city: form.city.value,
        state: form.state.value,
      })
      showToast(t('admin.neighborhoodCreated'))
      rerenderStaff(main, 'neighborhoods')
    } catch (err) {
      msgEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    }
  })

  main.querySelectorAll('[data-edit-neighborhood]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editNeighborhood
      main.querySelectorAll('.admin-edit-row[id^="edit-neighborhood-row-"]').forEach((row) => {
        row.hidden = row.id !== `edit-neighborhood-row-${id}`
      })
      main.querySelector(`#edit-neighborhood-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  })

  main.querySelectorAll('[data-cancel-neighborhood]').forEach((btn) => {
    btn.addEventListener('click', () => {
      main.querySelector(`#edit-neighborhood-row-${btn.dataset.cancelNeighborhood}`).hidden = true
    })
  })

  main.querySelectorAll('[data-neighborhood-edit]').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const id = form.dataset.neighborhoodEdit
      const submitBtn = form.querySelector('button[type="submit"]')
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t('common.saving') }
      try {
        await updateNeighborhood(id, {
          name: form.name.value,
          city: form.city.value,
          state: form.state.value,
        })
        showToast(t('admin.neighborhoodUpdated'))
        rerenderStaff(main, 'neighborhoods')
      } catch (err) {
        showToast(err.message)
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = t('admin.saveNeighborhood') }
      }
    })
  })

  main.querySelectorAll('[data-toggle-neighborhood]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await updateNeighborhood(btn.dataset.toggleNeighborhood, { active: btn.dataset.active === '1' })
        showToast(btn.dataset.active === '1' ? t('admin.neighborhoodActivated') : t('admin.neighborhoodDeactivated'))
        rerenderStaff(main, 'neighborhoods')
      } catch (err) {
        showToast(err.message)
      }
    })
  })

  main.querySelectorAll('[data-delete-neighborhood]:not([disabled])').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.neighborhoodName || t('admin.thisNeighborhood')
      if (!window.confirm(t('admin.confirmDeleteNeighborhood', { name }))) return
      try {
        await deleteNeighborhood(btn.dataset.deleteNeighborhood)
        showToast(t('toasts.neighborhoodDeleted'))
        rerenderStaff(main, 'neighborhoods')
      } catch (err) {
        showToast(err.message)
      }
    })
  })
}

function readModeratorPermissionForm(form) {
  return {
    canApprovePlanChanges: Boolean(form.can_approve_plan_changes?.checked),
  }
}

function bindModeratorManagement(main, neighborhoods = []) {
  bindModeratorsList(main)

  main.querySelectorAll('[data-edit-moderator]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editModerator
      main.querySelectorAll('.admin-edit-row[id^="edit-moderator-row-"]').forEach((row) => {
        row.hidden = row.id !== `edit-moderator-row-${id}`
      })
      main.querySelector(`#edit-moderator-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  })

  main.querySelectorAll('[data-cancel-moderator]').forEach((btn) => {
    btn.addEventListener('click', () => {
      main.querySelector(`#edit-moderator-row-${btn.dataset.cancelModerator}`).hidden = true
    })
  })

  main.querySelectorAll('[data-moderator-edit]').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const id = form.dataset.moderatorEdit
      const submitBtn = form.querySelector('button[type="submit"]')
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t('common.saving') }
      try {
        const permissions = readModeratorPermissionForm(form)
        await updateModeratorPermissions(id, {
          neighborhoodId: form.neighborhood_id.value,
          canApprovePlanChanges: permissions.canApprovePlanChanges,
        })
        showToast(t('admin.moderatorPermissionsUpdated'))
        rerenderStaff(main, 'moderators')
      } catch (err) {
        showToast(err.message)
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = t('admin.savePermissions') }
      }
    })
  })

  main.querySelector('#promote-moderator-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const msgEl = main.querySelector('#promote-moderator-msg')
    const submitBtn = form.querySelector('button[type="submit"]')
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t('admin.promoting') }
    try {
      const permissions = readModeratorPermissionForm(form)
      const promoted = await promoteUserToModerator(form.email.value, form.neighborhood_id.value, {
        canApprovePlanChanges: permissions.canApprovePlanChanges,
      })
      showToast(t('admin.userPromotedToModerator', { name: promoted.name }))
      rerenderStaff(main, 'moderators')
    } catch (err) {
      msgEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = t('admin.promoteModerator') }
    }
  })

  main.querySelectorAll('[data-demote-moderator]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = btn.dataset.moderatorName
      if (!confirm(t('admin.confirmRemoveModerator', { name }))) return
      try {
        await demoteModerator(btn.dataset.demoteModerator)
        showToast(t('admin.moderatorAccessRemoved'))
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

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t('common.sending') }

    try {
      const result = await updateEmail(form.email.value)
      form.reset()
      const { loadUser } = await import('../state.js')
      await loadUser()

      if (result.pendingEmail) {
        msgEl.innerHTML = `<div class="alert" style="background:var(--primary-50);color:var(--primary-700);padding:0.75rem;border-radius:var(--radius)">${t('admin.confirmNewEmail', { email: escapeHtml(result.pendingEmail) })}</div>`
        showToast(t('admin.confirmationLinkSent'))
      } else {
        msgEl.innerHTML = `<div class="alert alert-success">${t('admin.emailChangedSuccess')}</div>`
        showToast(t('admin.emailUpdated'))
        rerenderStaff(main, 'account')
      }
    } catch (err) {
      msgEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = t('admin.changeEmail') }
    }
  })
}

function bindPasswordForm(main) {
  bindPasswordToggles(main)
  main.querySelector('#admin-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const msgEl = main.querySelector('#admin-password-msg')
    const password = form.password.value
    const confirm = form.confirm.value

    if (password !== confirm) {
      msgEl.innerHTML = `<div class="alert alert-error">${t('admin.passwordsMismatch')}</div>`
      return
    }

    const submitBtn = form.querySelector('button[type="submit"]')
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t('common.saving') }

    try {
      await updatePassword(password)
      form.reset()
      msgEl.innerHTML = `<div class="alert alert-success">${t('admin.passwordChangedSuccess')}</div>`
      showToast(t('customer.passwordUpdated'))
    } catch (err) {
      msgEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = t('admin.changePassword') }
    }
  })
}

function bindApprovalActions(main, tab) {
  main.querySelectorAll('[data-approve]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await approveStoreRegistration(btn.dataset.approve)
      showToast(t('admin.storeApproved'))
      rerenderStaff(main, tab)
    })
  })

  main.querySelectorAll('[data-reject]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm(t('admin.confirmRejectStore'))) return
      await rejectStoreRegistration(btn.dataset.reject)
      showToast(t('admin.storeRejected'))
      rerenderStaff(main, tab)
    })
  })
}

function bindPlanChangeApprovalActions(main, tab) {
  main.querySelectorAll('[data-approve-plan-request]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await approvePlanChangeRequest(btn.dataset.approvePlanRequest)
        showToast(t('admin.planApproved'))
        rerenderStaff(main, tab)
      } catch (err) {
        showToast(err.message)
      }
    })
  })

  main.querySelectorAll('[data-reject-plan-request]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm(t('admin.confirmRejectPlanChange'))) return
      try {
        await rejectPlanChangeRequest(btn.dataset.rejectPlanRequest)
        showToast(t('admin.planChangeRejected'))
        rerenderStaff(main, tab)
      } catch (err) {
        showToast(err.message)
      }
    })
  })
}