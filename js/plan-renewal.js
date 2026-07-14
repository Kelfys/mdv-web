/**
 * Vencimento e avisos de renovação de planos pagos (Plus/Premium).
 *
 * Ciclo: 30 dias (`SUBSCRIPTION_PERIOD_DAYS`). Aviso ao lojista com 72 h de
 * antecedência (`PLAN_RENEWAL_WARNING_HOURS`). Sem renovação, `api.js` faz
 * downgrade ao Gratuito e mantém só o produto mais recente ativo (limite do free).
 *
 * Migration: `045_store_subscription_expires.sql`, `046_downgrade_expired_plans.sql`
 */
import { getPlanById, getPlanProductLimit } from './plans.js'
import { t } from './strings.js'

export const SUBSCRIPTION_PERIOD_DAYS = 30
export const PLAN_RENEWAL_WARNING_HOURS = 72

export function isPaidStorePlan(planId) {
  const plan = getPlanById(planId)
  return Boolean(plan && plan.priceMonthly > 0)
}

export function addSubscriptionPeriod(fromDate = new Date()) {
  const base = new Date(fromDate)
  base.setDate(base.getDate() + SUBSCRIPTION_PERIOD_DAYS)
  return base.toISOString()
}

/**
 * Calcula a nova data de vencimento ao aprovar ou renovar um plano pago.
 */
export function resolveSubscriptionExpiresAt({
  planId,
  currentExpiresAt = null,
  approvedAt = null,
  isRenewal = false,
}, now = new Date()) {
  if (!isPaidStorePlan(planId)) return null

  const nowMs = now.getTime()
  if (isRenewal && currentExpiresAt) {
    const currentMs = new Date(currentExpiresAt).getTime()
    const base = currentMs > nowMs ? new Date(currentExpiresAt) : now
    return addSubscriptionPeriod(base)
  }

  if (currentExpiresAt && new Date(currentExpiresAt).getTime() > nowMs) {
    return currentExpiresAt
  }

  if (approvedAt) return addSubscriptionPeriod(new Date(approvedAt))
  return addSubscriptionPeriod(now)
}

export function getPlanRenewalState(store, now = new Date()) {
  if (!store || !isPaidStorePlan(store.plan_id)) {
    return { status: 'not_applicable' }
  }

  const expiresAt = store.subscription_expires_at
  if (!expiresAt) {
    return { status: 'unknown', planId: store.plan_id, planName: getPlanById(store.plan_id).name }
  }

  const expiresMs = new Date(expiresAt).getTime()
  const nowMs = now.getTime()
  const msRemaining = expiresMs - nowMs
  const hoursRemaining = msRemaining / (1000 * 60 * 60)
  const plan = getPlanById(store.plan_id)

  if (msRemaining <= 0) {
    return {
      status: 'expired',
      planId: store.plan_id,
      planName: plan.name,
      expiresAt,
      msRemaining: 0,
      hoursRemaining: 0,
    }
  }

  if (hoursRemaining <= PLAN_RENEWAL_WARNING_HOURS) {
    return {
      status: 'warning',
      planId: store.plan_id,
      planName: plan.name,
      expiresAt,
      msRemaining,
      hoursRemaining,
    }
  }

  return {
    status: 'active',
    planId: store.plan_id,
    planName: plan.name,
    expiresAt,
    msRemaining,
    hoursRemaining,
  }
}

export function formatRenewalRemaining(msRemaining) {
  if (msRemaining <= 0) return t('planRenewal.expiredNow')

  const hours = Math.ceil(msRemaining / (1000 * 60 * 60))
  if (hours < 24) {
    return hours === 1
      ? t('planRenewal.hoursRemainingOne', { hours })
      : t('planRenewal.hoursRemainingMany', { hours })
  }

  const days = Math.ceil(hours / 24)
  return days === 1
    ? t('planRenewal.daysRemainingOne', { days })
    : t('planRenewal.daysRemainingMany', { days })
}

export function storeNeedsRenewalAttention(store, now = new Date()) {
  const state = getPlanRenewalState(store, now)
  return state.status === 'warning' || state.status === 'expired'
}

/** IDs dos produtos que permanecem ativos após downgrade ao plano gratuito. */
export function pickProductIdsToKeepActive(products, limit = getPlanProductLimit('free')) {
  const sorted = [...(products ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  return new Set(sorted.slice(0, limit).map((product) => product.id))
}

export function storeWasDowngradedToFree(store, products) {
  if (store.plan_id !== 'free' || (products ?? []).length <= getPlanProductLimit('free')) return false
  const activeCount = products.filter((product) => product.active).length
  return activeCount === getPlanProductLimit('free')
}