/**
 * Painel administrativo — métricas e aprovação de lojas.
 *
 * Apenas usuários com role=admin acessam (guardAdmin).
 * Aprovar loja ativa plano free e subscription_status=active.
 *
 * Melhorias futuras:
 * - Listagem de todas as lojas com filtros e busca
 * - Moderação de comentários e denúncias
 * - Gestão de planos e assinaturas
 * - Logs de auditoria das ações do admin
 */
import {
  fetchAdminMetrics, fetchPendingStoreApprovals,
  approveStoreRegistration, rejectStoreRegistration,
} from '../api.js'
import { getUser } from '../state.js'
import { escapeHtml, formatDate } from '../utils.js'

function guardAdmin(main) {
  const user = getUser()
  if (!user || user.role !== 'admin') {
    main.innerHTML = `<div class="empty-state"><h2>Acesso restrito</h2><p><a href="#/admin/entrar">Entrar como admin</a></p></div>`
    return null
  }
  return user
}

export async function renderAdminDashboard(main) {
  if (!guardAdmin(main)) return

  const [metrics, pending] = await Promise.all([
    fetchAdminMetrics(),
    fetchPendingStoreApprovals(),
  ])

  main.innerHTML = `
    <div class="dashboard">
      <div class="dashboard__header"><h1>Painel Admin</h1></div>

      <div class="metrics">
        <div class="metric-card"><div class="metric-card__value">${metrics.totalStores}</div><div class="metric-card__label">Lojas</div></div>
        <div class="metric-card"><div class="metric-card__value">${metrics.totalProducts}</div><div class="metric-card__label">Produtos</div></div>
        <div class="metric-card"><div class="metric-card__value">${metrics.totalOrders}</div><div class="metric-card__label">Pedidos</div></div>
        <div class="metric-card"><div class="metric-card__value">${metrics.totalViews}</div><div class="metric-card__label">Visualizações</div></div>
        <div class="metric-card"><div class="metric-card__value">${metrics.pendingStores}</div><div class="metric-card__label">Pendentes</div></div>
      </div>

      <h2 style="font-size:1.125rem;margin-bottom:1rem">Aprovações pendentes (${pending.length})</h2>

      ${pending.length === 0
        ? '<div class="empty-state"><p>Nenhuma loja aguardando aprovação.</p></div>'
        : `<div class="table-wrap"><table>
            <thead><tr><th>Loja</th><th>Lojista</th><th>Cidade</th><th>Data</th><th>Ações</th></tr></thead>
            <tbody>
              ${pending.map((s) => `
                <tr>
                  <td><strong>${escapeHtml(s.name)}</strong><br><small>${escapeHtml(s.whatsapp)}</small></td>
                  <td>${escapeHtml(s.owner?.name ?? '—')}<br><small>${escapeHtml(s.owner?.email ?? '')}</small></td>
                  <td>${escapeHtml(s.city)}, ${escapeHtml(s.state)}</td>
                  <td>${formatDate(s.created_at)}</td>
                  <td style="white-space:nowrap">
                    <button type="button" class="btn btn-primary btn-sm" data-approve="${s.id}">Aprovar</button>
                    <button type="button" class="btn btn-outline btn-sm" data-reject="${s.id}">Rejeitar</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>`}
    </div>
  `

  main.querySelectorAll('[data-approve]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await approveStoreRegistration(btn.dataset.approve)
      renderAdminDashboard(main)
    })
  })

  main.querySelectorAll('[data-reject]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Rejeitar esta loja?')) return
      await rejectStoreRegistration(btn.dataset.reject)
      renderAdminDashboard(main)
    })
  })
}