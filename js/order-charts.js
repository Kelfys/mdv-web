/**
 * Gráficos de pedidos compartilhados (admin e lojista).
 */
import { escapeHtml, formatCurrency } from './utils.js'
import { buildOrderPeriodSeries } from './api.js'

function formatChartValue(value, metric) {
  return metric === 'revenue' ? formatCurrency(value) : String(value)
}

export function renderOrdersChartPlot(series, metric = 'orders') {
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

export function renderOrdersChart(series, {
  period = '30d',
  metric = 'orders',
  compact = false,
  chartId = 'orders-chart-body',
} = {}) {
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
      <div class="admin-chart" id="${chartId}" role="img" aria-label="Gráfico de pedidos por período">
        ${renderOrdersChartPlot(series, metric)}
      </div>
    </section>`
}

export function updateOrdersChart(main, timeline, period, metric, chartId = 'orders-chart-body') {
  const series = buildOrderPeriodSeries(timeline, period)
  const body = main.querySelector(`#${chartId}`)
  const summary = main.querySelector('.admin-chart-panel__summary')
  if (!body) return

  const totalOrders = series.reduce((sum, b) => sum + b.orders, 0)
  const totalRevenue = series.reduce((sum, b) => sum + b.revenue, 0)

  if (summary) {
    summary.textContent = `${totalOrders} pedido${totalOrders === 1 ? '' : 's'} · ${formatCurrency(totalRevenue)} no período`
  }

  body.innerHTML = renderOrdersChartPlot(series, metric)
}

export function bindOrdersChart(main, timeline, chartId = 'orders-chart-body') {
  if (!main.querySelector('[data-chart-period]')) return

  let period = main.querySelector('[data-chart-period].active')?.dataset.chartPeriod ?? '30d'
  let metric = main.querySelector('[data-chart-metric].active')?.dataset.chartMetric ?? 'orders'

  main.querySelectorAll('[data-chart-period]').forEach((btn) => {
    btn.addEventListener('click', () => {
      period = btn.dataset.chartPeriod
      main.querySelectorAll('[data-chart-period]').forEach((b) => b.classList.toggle('active', b === btn))
      updateOrdersChart(main, timeline, period, metric, chartId)
    })
  })

  main.querySelectorAll('[data-chart-metric]').forEach((btn) => {
    btn.addEventListener('click', () => {
      metric = btn.dataset.chartMetric
      main.querySelectorAll('[data-chart-metric]').forEach((b) => b.classList.toggle('active', b === btn))
      updateOrdersChart(main, timeline, period, metric, chartId)
    })
  })
}