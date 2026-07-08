/**
 * Planos de assinatura para lojistas.
 * Fonte de verdade para limites, exibição na página de regras e fluxos de billing.
 *
 * Plano Gratuito (free) — ver PLAN_LIMITS e README § Planos de assinatura:
 *   • até 2 itens no catálogo (produto ou serviço)
 *   • 1 foto no catálogo (productImages: 1 — total entre os produtos)
 *   • logo da loja sim; banner personalizado não (planAllowsStoreBanner)
 *   • alteração de preço a cada 24 h (PLAN_COOLDOWN_HOURS.free)
 * Anúncios no feed (store_ads): exclusivo Premium — até 2 inclusos/mês; extras R$ 5 (STORE_AD_EXTRA_FEE), 24h após aprovação.
 * Validação na API: js/api.js (assertProductCountAllowed, assertProductImageAllowed, assertStoreAdAllowed).
 */
import { formatCurrency, escapeHtml } from './utils.js'
import { buildWhatsAppUrl } from './whatsapp.js'
import { t } from './strings.js'

/** WhatsApp para envio de comprovante de pagamento do plano */
export const PAYMENT_WHATSAPP = '5521975286720'

function priceCooldownLabel(hours) {
  if (hours === null) return t('plans.priceChangeAnytime')
  if (hours < 24) return t('plans.priceChangeEveryHours', { hours })
  const days = Math.round(hours / 24)
  return t('plans.priceChangeEveryDays', { days })
}

function buildPlanFeatures(featureKeys, cooldownHours, cooldownAfterIndex) {
  const features = featureKeys.map((key) => t(key))
  features.splice(cooldownAfterIndex, 0, priceCooldownLabel(cooldownHours))
  return features
}

/** Mensagem exibida quando lojista free tenta enviar banner personalizado. */
export const FREE_PLAN_BANNER_MESSAGE = t('plans.freeBannerMessage')

/** @deprecated Use FREE_PLAN_BANNER_MESSAGE */
export const FREE_PLAN_BRANDING_MESSAGE = FREE_PLAN_BANNER_MESSAGE

/** Logo (foto de perfil da loja) — liberado em todos os planos, inclusive Gratuito. */
export function planAllowsStoreLogo() {
  return true
}

/** Banner da vitrine — somente planos pagos (plus, premium). */
export function planAllowsStoreBanner(planId) {
  return Boolean(planId && planId !== 'free')
}

/**
 * Anúncios no feed (store_ads):
 * - Premium: 2 inclusos/mês calendário (is_extra=false).
 * - Acima do limite: extras pagos (STORE_AD_EXTRA_FEE), duração STORE_AD_DURATION_HOURS após aprovação staff.
 * - Aprovação obrigatória antes de aparecer no feed (status pending → approved).
 */
export const PLAN_MONTHLY_AD_LIMIT = {
  free: 0,
  plus: 0,
  premium: 2,
}

/** Duração de exibição após aprovação (horas). */
export const STORE_AD_DURATION_HOURS = 24

/** Taxa por anúncio extra (acima do limite incluso do plano). */
export const STORE_AD_EXTRA_FEE = 5

export function planAllowsStoreAds(planId) {
  return planId === 'premium'
}

export function getPlanMonthlyAdLimit(planId) {
  return PLAN_MONTHLY_AD_LIMIT[planId] ?? 0
}

/** Conta anúncios criados no mês calendário atual (qualquer status). */
export function countStoreAdsThisMonth(ads, now = new Date()) {
  const month = now.getMonth()
  const year = now.getFullYear()
  return (ads ?? []).filter((ad) => {
    const created = new Date(ad.created_at)
    return created.getMonth() === month && created.getFullYear() === year
  }).length
}

/** Conta apenas slots inclusos (não extras) criados no mês. */
export function countIncludedStoreAdsThisMonth(ads, now = new Date()) {
  const month = now.getMonth()
  const year = now.getFullYear()
  return (ads ?? []).filter((ad) => {
    if (ad.is_extra) return false
    const created = new Date(ad.created_at)
    return created.getMonth() === month && created.getFullYear() === year
  }).length
}

export function isExtraStoreAdSlot(planId, includedAdsThisMonth) {
  if (!planAllowsStoreAds(planId)) return false
  return includedAdsThisMonth >= getPlanMonthlyAdLimit(planId)
}

export function canCreateIncludedStoreAd(planId, includedAdsThisMonth) {
  if (!planAllowsStoreAds(planId)) return false
  return includedAdsThisMonth < getPlanMonthlyAdLimit(planId)
}

export function canCreateExtraStoreAd(planId) {
  return planAllowsStoreAds(planId)
}

/** @deprecated Use canCreateIncludedStoreAd ou canCreateExtraStoreAd */
export function canCreateStoreAd(planId, adsThisMonth) {
  return canCreateIncludedStoreAd(planId, adsThisMonth) || canCreateExtraStoreAd(planId)
}

export function planStoreAdLimitMessage(planId) {
  if (!planAllowsStoreAds(planId)) return t('plans.premiumAdsOnlyMessage')
  const limit = getPlanMonthlyAdLimit(planId)
  return t('plans.monthlyAdLimitMessage', { limit })
}

export function formatStoreAdLimitHint(planId, includedAdsThisMonth) {
  const limit = getPlanMonthlyAdLimit(planId)
  const remaining = Math.max(0, limit - includedAdsThisMonth)
  return t('plans.monthlyAdLimitHint', { count: includedAdsThisMonth, limit, remaining })
}

export function formatStoreAdExtraFeeHint() {
  return t('plans.extraAdFeeHint', { fee: formatCurrency(STORE_AD_EXTRA_FEE), hours: STORE_AD_DURATION_HOURS })
}

/** @deprecated Use planAllowsStoreBanner — banner exige plano pago; logo é liberado em todos os planos */
export function planAllowsStoreBranding(planId) {
  return planAllowsStoreBanner(planId)
}

/**
 * Limites de catálogo por plano (itens totais e quantos podem ter foto).
 * products: teto de cadastro; productImages: teto de produtos com foto no catálogo.
 */
export const PLAN_LIMITS = {
  // Gratuito: 2 itens publicáveis, 1 produto com foto
  free: { products: 2, productImages: 1 },
  plus: { products: 6, productImages: 6 },
  premium: { products: 30, productImages: 30 },
}

export function getPlanProductLimit(planId) {
  return PLAN_LIMITS[planId]?.products ?? PLAN_LIMITS.free.products
}

export function getPlanProductImageLimit(planId) {
  return PLAN_LIMITS[planId]?.productImages ?? PLAN_LIMITS.free.productImages
}

export function planProductLimitMessage(planId) {
  const plan = getPlanById(planId)
  const limit = getPlanProductLimit(planId)
  return t('plans.productLimitMessage', { plan: plan.name, limit })
}

/** Planos com productImages > 0 permitem foto nos produtos (Gratuito: 1 no total). */
export function planAllowsProductImages(planId) {
  return getPlanProductImageLimit(planId) > 0
}

export function planProductImageLimitMessage(planId) {
  const plan = getPlanById(planId)
  const limit = getPlanProductImageLimit(planId)
  if (limit === 0) return t('plans.freeProductImageMessage')
  return t('plans.productImageLimitMessage', { plan: plan.name, limit })
}

export function countProductsWithImages(products) {
  return (products ?? []).filter((p) => Boolean(p.image?.trim?.() ?? p.image)).length
}

export function planProductsRemaining(planId, productCount) {
  return Math.max(0, getPlanProductLimit(planId) - productCount)
}

export function planProductImagesRemaining(planId, productsWithImages) {
  return Math.max(0, getPlanProductImageLimit(planId) - productsWithImages)
}

export function canCreateProduct(planId, productCount) {
  return productCount < getPlanProductLimit(planId)
}

/** productImages === 0 nega upload; no limite, só troca em produto que já tem foto. */
export function canAddProductImage(planId, productsWithImages, productAlreadyHasImage = false) {
  const limit = getPlanProductImageLimit(planId)
  if (limit === 0) return false
  if (productAlreadyHasImage) return true
  return productsWithImages < limit
}

export function formatProductLimitHint(planId, productCount) {
  const plan = getPlanById(planId)
  const limit = getPlanProductLimit(planId)
  const remaining = planProductsRemaining(planId, productCount)
  const hint = t('plans.productLimitHint', { plan: plan.name, count: productCount, limit })
  return remaining > 0 ? `${hint}${t('plans.productLimitRemaining', { remaining })}` : hint
}

export function formatProductImageLimitHint(planId, productsWithImages) {
  const plan = getPlanById(planId)
  const limit = getPlanProductImageLimit(planId)
  const remaining = planProductImagesRemaining(planId, productsWithImages)
  const hint = t('plans.productImageLimitHint', { plan: plan.name, count: productsWithImages, limit })
  return remaining > 0 ? `${hint}${t('plans.productLimitRemaining', { remaining })}` : hint
}

/** Intervalo mínimo entre mudanças de preço (horas). */
const PLAN_COOLDOWN_HOURS = {
  free: 24,
  plus: 12,
  premium: 6,
}

const PLAN_CONFIGS = [
  /** Gratuito — ativado na aprovação da loja; limites em PLAN_LIMITS.free */
  {
    id: 'free',
    nameKey: 'plans.planFree',
    descriptionKey: 'plans.planFreeDesc',
    priceMonthly: 0,
    priceCooldownHours: PLAN_COOLDOWN_HOURS.free,
    featureKeys: [
      'plans.featureFreeItems2',
      'plans.featureFreeOneImage',
      'plans.featureStoreLogo',
      'plans.featureDefaultBanner',
      'plans.featureToggleProducts',
      'plans.featureWhatsappOrders',
    ],
    cooldownAfterIndex: 4,
  },
  {
    id: 'plus',
    nameKey: 'plans.planPlus',
    descriptionKey: 'plans.planPlusDesc',
    priceMonthly: 2.99,
    priceCooldownHours: PLAN_COOLDOWN_HOURS.plus,
    featureKeys: [
      'plans.featurePlusItems6',
      'plans.featurePlusImages6',
      'plans.featureCustomBanner',
      'plans.featureHomeHighlight',
      'plans.featureToggleProducts',
    ],
    cooldownAfterIndex: 3,
  },
  {
    id: 'premium',
    nameKey: 'plans.planPremium',
    descriptionKey: 'plans.planPremiumDesc',
    priceMonthly: 20,
    priceCooldownHours: PLAN_COOLDOWN_HOURS.premium,
    featureKeys: [
      'plans.featurePremiumItems30',
      'plans.featurePlusImagesAll',
      'plans.featureCustomBanner',
      'plans.featureToggleProducts',
      'plans.featurePremiumAds2',
      'plans.featurePremiumAdsRotation24h',
      'plans.featureFeedRotation24h',
    ],
    cooldownAfterIndex: 4,
  },
]

function buildSubscriptionPlans() {
  return PLAN_CONFIGS.map((cfg) => ({
    id: cfg.id,
    name: t(cfg.nameKey),
    description: t(cfg.descriptionKey),
    priceMonthly: cfg.priceMonthly,
    priceCooldownHours: cfg.priceCooldownHours,
    features: buildPlanFeatures(cfg.featureKeys, cfg.priceCooldownHours, cfg.cooldownAfterIndex),
  }))
}

export const SUBSCRIPTION_PLANS = buildSubscriptionPlans()

export function formatPlanPrice(priceMonthly) {
  return priceMonthly === 0
    ? t('app.freePlanPrice')
    : `${formatCurrency(priceMonthly)}${t('app.perMonth')}`
}

export function getPlanById(planId) {
  return SUBSCRIPTION_PLANS.find((p) => p.id === planId) ?? SUBSCRIPTION_PLANS[0]
}

const PLAN_RANK = { free: 0, plus: 1, premium: 2 }

function planRank(planId) {
  return PLAN_RANK[planId] ?? 0
}

function renderPlanCardAction(plan, currentPlanId, { requestMode = false, infoOnly = false } = {}) {
  const isDashboard = Boolean(currentPlanId)
  const isCurrent = currentPlanId === plan.id

  if (infoOnly && !isDashboard) {
    if (plan.priceMonthly === 0) {
      return `<p class="plan-card__note">${escapeHtml(t('plans.includedOnApproval'))}</p>`
    }
    return ''
  }
  const whatsappBtn = (label) => `
    <a href="${buildPlanPaymentUrl(plan)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-block btn-sm">
      ${label}
    </a>`

  if (isDashboard && isCurrent) {
    if (plan.priceMonthly > 0) {
      if (requestMode) {
        return `
          <button type="button" class="btn btn-green btn-block btn-sm" data-request-plan="${plan.id}">
            ${escapeHtml(t('plans.requestRenewal'))}
          </button>
          ${whatsappBtn(escapeHtml(t('plans.sendReceiptWhatsapp')))}
          <p class="plan-card__note">${escapeHtml(t('plans.yourCurrentPlan'))}</p>`
      }
      return `
        <a href="${buildPlanPaymentUrl(plan)}" target="_blank" rel="noopener noreferrer" class="btn btn-green btn-block btn-sm">
          ${escapeHtml(t('plans.renewPlan', { plan: plan.name }))}
        </a>
        <p class="plan-card__note">${escapeHtml(t('plans.yourCurrentPlan'))}</p>`
    }
    return `<p class="plan-card__note plan-card__note--current">${escapeHtml(t('plans.yourCurrentPlan'))}</p>`
  }

  if (isDashboard && plan.priceMonthly > 0 && planRank(plan.id) > planRank(currentPlanId)) {
    if (requestMode) {
      return `
        <button type="button" class="btn btn-green btn-block btn-sm" data-request-plan="${plan.id}">
          ${escapeHtml(t('plans.requestPlan', { plan: plan.name }))}
        </button>
        ${whatsappBtn(escapeHtml(t('plans.sendReceiptWhatsapp')))}`
    }
    return `
      <a href="${buildPlanPaymentUrl(plan)}" target="_blank" rel="noopener noreferrer" class="btn btn-green btn-block btn-sm">
        ${escapeHtml(t('plans.subscribePlan', { plan: plan.name }))}
      </a>`
  }

  if (!isDashboard) {
    if (plan.priceMonthly > 0) {
      return `
        <a href="${buildPlanPaymentUrl(plan)}" target="_blank" rel="noopener noreferrer" class="btn btn-green btn-block btn-sm">
          ${escapeHtml(t('plans.sendReceiptPlan', { plan: plan.name }))}
        </a>`
    }
    return `<p class="plan-card__note">${escapeHtml(t('plans.includedOnApproval'))}</p>`
  }

  return ''
}

/** Cards de planos para login informativo e painel do lojista. */
export function renderSubscriptionPlanCards({ currentPlanId = null, requestMode = false, infoOnly = false } = {}) {
  return SUBSCRIPTION_PLANS.map((plan) => {
    const isCurrent = currentPlanId === plan.id
    const highlight = plan.id === 'premium' || isCurrent

    return `
    <article class="plan-card ${highlight ? 'plan-card--highlight' : ''} ${isCurrent ? 'plan-card--current' : ''}">
      <div class="plan-card__header">
        <h3 class="plan-card__name">${escapeHtml(plan.name)}</h3>
        <p class="plan-card__price">${escapeHtml(formatPlanPrice(plan.priceMonthly))}</p>
      </div>
      <p class="plan-card__desc">${escapeHtml(plan.description)}</p>
      <ul class="plan-card__features">
        ${plan.features.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}
      </ul>
      ${renderPlanCardAction(plan, currentPlanId, { requestMode, infoOnly })}
    </article>`
  }).join('')
}

const PLAN_FEED_WEIGHT = {
  free: 1,
  plus: 2,
  premium: 4,
}

export function getPlanFeedWeight(planId) {
  return PLAN_FEED_WEIGHT[planId] ?? PLAN_FEED_WEIGHT.free
}

export function getPlanPriceCooldownHours(planId) {
  const plan = getPlanById(planId)
  return plan.priceCooldownHours ?? PLAN_COOLDOWN_HOURS[plan.id] ?? null
}

export function getPriceCooldownRemaining(planId, priceChangedAt) {
  const hours = getPlanPriceCooldownHours(planId)
  if (hours === null) return { allowed: true, remainingMs: 0 }

  const changed = new Date(priceChangedAt).getTime()
  const unlockAt = changed + hours * 60 * 60 * 1000
  const remainingMs = unlockAt - Date.now()
  return {
    allowed: remainingMs <= 0,
    remainingMs: Math.max(0, remainingMs),
    unlockAt: new Date(unlockAt),
  }
}

export function formatPriceCooldownRemaining(remainingMs) {
  if (remainingMs <= 0) return ''
  const totalMinutes = Math.ceil(remainingMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return t('plans.cooldownRemainingHours', { hours, minutes })
  return t('plans.cooldownRemainingMinutes', { minutes })
}

function buildPaymentMessage(planName, planPrice) {
  const priceSuffix = planPrice ? ` (${planPrice})` : ''
  return [
    t('plans.paymentWhatsappGreeting'),
    '',
    t('plans.paymentWhatsappBody', { plan: planName, price: priceSuffix }),
    '',
    t('plans.paymentWhatsappReceipt'),
    '',
    t('plans.paymentWhatsappStoreName'),
    t('plans.paymentWhatsappEmail'),
  ].join('\n')
}

export function buildPlanPaymentUrl(plan) {
  return buildWhatsAppUrl(PAYMENT_WHATSAPP, buildPaymentMessage(plan.name, formatPlanPrice(plan.priceMonthly)))
}

export function buildGenericPaymentUrl() {
  return buildWhatsAppUrl(
    PAYMENT_WHATSAPP,
    buildPaymentMessage(t('plans.paymentWhatsappPlanPlaceholder'), ''),
  )
}

function buildExtraAdPaymentMessage(adTitle = '') {
  return [
    t('plans.paymentWhatsappGreeting'),
    '',
    t('plans.extraAdPaymentBody', { fee: formatCurrency(STORE_AD_EXTRA_FEE), hours: STORE_AD_DURATION_HOURS }),
    adTitle ? t('plans.extraAdPaymentTitle', { title: adTitle }) : '',
    '',
    t('plans.paymentWhatsappReceipt'),
    '',
    t('plans.paymentWhatsappStoreName'),
    t('plans.paymentWhatsappEmail'),
  ].filter(Boolean).join('\n')
}

export function buildExtraAdPaymentUrl(adTitle = '') {
  return buildWhatsAppUrl(PAYMENT_WHATSAPP, buildExtraAdPaymentMessage(adTitle))
}