/**
 * Planos de assinatura para lojistas.
 * Fonte de verdade para limites, exibição na página de regras e fluxos de billing.
 */
import { formatCurrency, escapeHtml } from './utils.js'
import { buildWhatsAppUrl } from './whatsapp.js'

/** WhatsApp para envio de comprovante de pagamento do plano */
export const PAYMENT_WHATSAPP = '5521975286720'

function priceCooldownLabel(hours) {
  if (hours === null) return 'Alteração de preços a qualquer momento'
  if (hours === 24) return 'Alteração de preços a cada 24h'
  if (hours < 24) return `Alteração de preços a cada ${hours}h`
  const days = Math.round(hours / 24)
  return `Alteração de preços a cada ${days} dia${days > 1 ? 's' : ''}`
}

export const FREE_PLAN_BRANDING_MESSAGE =
  'O plano Gratuito não inclui logo nem banner. Assine um plano pago para personalizar a vitrine.'

export function planAllowsStoreBranding(planId) {
  return Boolean(planId && planId !== 'free')
}

/** Limites de catálogo por plano (produtos totais e produtos com imagem). */
export const PLAN_LIMITS = {
  free: { products: 6, productImages: 2 },
  starter: { products: 15, productImages: 10 },
  plus: { products: 30, productImages: 30 },
  premium: { products: 80, productImages: 80 },
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
  return `O plano ${plan.name} permite até ${limit} itens no catálogo (produtos e serviços). Assine um plano superior para ampliar.`
}

export function planProductImageLimitMessage(planId) {
  const plan = getPlanById(planId)
  const limit = getPlanProductImageLimit(planId)
  return `O plano ${plan.name} permite imagens em até ${limit} produto${limit === 1 ? '' : 's'}. Assine um plano superior para liberar mais.`
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

export function canAddProductImage(planId, productsWithImages, productAlreadyHasImage = false) {
  if (productAlreadyHasImage) return true
  return productsWithImages < getPlanProductImageLimit(planId)
}

export function formatProductLimitHint(planId, productCount) {
  const plan = getPlanById(planId)
  const limit = getPlanProductLimit(planId)
  const remaining = planProductsRemaining(planId, productCount)
  return `${plan.name}: ${productCount}/${limit} itens no catálogo${remaining > 0 ? ` — restam ${remaining}` : ''}`
}

export function formatProductImageLimitHint(planId, productsWithImages) {
  const plan = getPlanById(planId)
  const limit = getPlanProductImageLimit(planId)
  const remaining = planProductImagesRemaining(planId, productsWithImages)
  return `${plan.name}: ${productsWithImages}/${limit} produtos com imagem${remaining > 0 ? ` — restam ${remaining}` : ''}`
}

const PLAN_COOLDOWN_HOURS = {
  free: 24,
  starter: 12,
  plus: 4,
  premium: null,
}

export const SUBSCRIPTION_PLANS = [
  {
    id: 'free',
    name: 'Gratuito',
    description: 'Para testar a vitrine com catálogo enxuto.',
    priceMonthly: 0,
    priceCooldownHours: PLAN_COOLDOWN_HOURS.free,
    features: [
      'Até 6 itens (produtos ou serviços)',
      'Imagens em até 2 produtos (500 KB cada)',
      'Vitrine com tema padrão (sem logo nem banner)',
      priceCooldownLabel(24),
      'Ativar ou ocultar produtos à venda',
      'Pedidos via WhatsApp',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    description: 'Catálogo inicial com branding e mais flexibilidade de preços.',
    priceMonthly: 5,
    priceCooldownHours: PLAN_COOLDOWN_HOURS.starter,
    features: [
      'Até 15 itens (produtos ou serviços)',
      'Imagens em até 10 produtos (500 KB cada)',
      'Logo e banner personalizados',
      priceCooldownLabel(12),
      'Destaque visual na página inicial',
      'Ativar ou ocultar produtos à venda',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    description: 'Para lojas em crescimento com vitrine completa.',
    priceMonthly: 15,
    priceCooldownHours: PLAN_COOLDOWN_HOURS.plus,
    features: [
      'Até 30 itens (produtos ou serviços)',
      'Imagens em todos os produtos (500 KB cada)',
      'Logo e banner personalizados',
      priceCooldownLabel(4),
      'Anúncio ampliado na vitrine principal',
      'Prioridade nas buscas',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Catálogo ampliado para lojas consolidadas.',
    priceMonthly: 35,
    priceCooldownHours: PLAN_COOLDOWN_HOURS.premium,
    features: [
      'Até 80 itens (produtos ou serviços)',
      'Imagens em todos os produtos (500 KB cada)',
      'Logo e banner personalizados',
      priceCooldownLabel(null),
      'Máximo destaque na página inicial',
      'Rotação de prioridade a cada 15 min',
    ],
  },
]

export function formatPlanPrice(priceMonthly) {
  return priceMonthly === 0 ? 'Grátis' : `${formatCurrency(priceMonthly)}/mês`
}

export function getPlanById(planId) {
  return SUBSCRIPTION_PLANS.find((p) => p.id === planId) ?? SUBSCRIPTION_PLANS[0]
}

const PLAN_RANK = { free: 0, starter: 1, plus: 2, premium: 3 }

function planRank(planId) {
  return PLAN_RANK[planId] ?? 0
}

function renderPlanCardAction(plan, currentPlanId, { requestMode = false } = {}) {
  const isDashboard = Boolean(currentPlanId)
  const isCurrent = currentPlanId === plan.id
  const whatsappBtn = (label) => `
    <a href="${buildPlanPaymentUrl(plan)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-block btn-sm">
      ${label}
    </a>`

  if (isDashboard && isCurrent) {
    if (plan.priceMonthly > 0) {
      if (requestMode) {
        return `
          <button type="button" class="btn btn-green btn-block btn-sm" data-request-plan="${plan.id}">
            Solicitar renovação
          </button>
          ${whatsappBtn('Enviar comprovante no WhatsApp')}
          <p class="plan-card__note">Seu plano atual</p>`
      }
      return `
        <a href="${buildPlanPaymentUrl(plan)}" target="_blank" rel="noopener noreferrer" class="btn btn-green btn-block btn-sm">
          Renovar — ${escapeHtml(plan.name)}
        </a>
        <p class="plan-card__note">Seu plano atual</p>`
    }
    return `<p class="plan-card__note plan-card__note--current">Seu plano atual</p>`
  }

  if (isDashboard && plan.priceMonthly > 0 && planRank(plan.id) > planRank(currentPlanId)) {
    if (requestMode) {
      return `
        <button type="button" class="btn btn-green btn-block btn-sm" data-request-plan="${plan.id}">
          Solicitar — ${escapeHtml(plan.name)}
        </button>
        ${whatsappBtn('Enviar comprovante no WhatsApp')}`
    }
    return `
      <a href="${buildPlanPaymentUrl(plan)}" target="_blank" rel="noopener noreferrer" class="btn btn-green btn-block btn-sm">
        Assinar — ${escapeHtml(plan.name)}
      </a>`
  }

  if (!isDashboard) {
    if (plan.priceMonthly > 0) {
      return `
        <a href="${buildPlanPaymentUrl(plan)}" target="_blank" rel="noopener noreferrer" class="btn btn-green btn-block btn-sm">
          Enviar comprovante — ${escapeHtml(plan.name)}
        </a>`
    }
    return `<p class="plan-card__note">Incluso na aprovação do cadastro</p>`
  }

  return ''
}

/** Cards de planos para /regras e painel do lojista. */
export function renderSubscriptionPlanCards({ currentPlanId = null, requestMode = false } = {}) {
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
      ${renderPlanCardAction(plan, currentPlanId, { requestMode })}
    </article>`
  }).join('')
}

const PLAN_FEED_WEIGHT = {
  free: 1,
  starter: 2,
  plus: 3,
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
  if (hours > 0) return `${hours}h ${minutes}min`
  return `${minutes}min`
}

function buildPaymentMessage(planName, planPrice) {
  return [
    'Olá!',
    '',
    `Sou lojista do MaredeVendas e quero assinar o plano *${planName}*${planPrice ? ` (${planPrice})` : ''}.`,
    '',
    'Segue o comprovante de pagamento em anexo.',
    '',
    'Nome da loja:',
    'Email cadastrado:',
  ].join('\n')
}

export function buildPlanPaymentUrl(plan) {
  return buildWhatsAppUrl(PAYMENT_WHATSAPP, buildPaymentMessage(plan.name, formatPlanPrice(plan.priceMonthly)))
}

export function buildGenericPaymentUrl() {
  return buildWhatsAppUrl(PAYMENT_WHATSAPP, buildPaymentMessage('(informar plano)', ''))
}