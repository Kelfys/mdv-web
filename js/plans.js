/**
 * Planos de assinatura para lojistas.
 * Fonte de verdade para exibição na página de regras e futuros fluxos de billing.
 */
import { formatCurrency } from './utils.js'
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

export const FREE_PLAN_PRODUCT_IMAGE_LIMIT = 4

export const FREE_PLAN_PRODUCT_IMAGE_MESSAGE =
  `O plano Gratuito permite imagens em até ${FREE_PLAN_PRODUCT_IMAGE_LIMIT} produtos. Assine um plano pago para liberar mais.`

export function planAllowsUnlimitedProductImages(planId) {
  return Boolean(planId && planId !== 'free')
}

export function countProductsWithImages(products) {
  return (products ?? []).filter((p) => Boolean(p.image?.trim?.() ?? p.image)).length
}

export function freePlanProductImagesRemaining(planId, productsWithImages) {
  if (planAllowsUnlimitedProductImages(planId)) return null
  return Math.max(0, FREE_PLAN_PRODUCT_IMAGE_LIMIT - productsWithImages)
}

export function canAddProductImage(planId, productsWithImages, productAlreadyHasImage = false) {
  if (productAlreadyHasImage) return true
  if (planAllowsUnlimitedProductImages(planId)) return true
  return productsWithImages < FREE_PLAN_PRODUCT_IMAGE_LIMIT
}

const PLAN_COOLDOWN_HOURS = {
  free: 24,
  starter: 12,
  growth: 4,
  premium: null,
}

export const SUBSCRIPTION_PLANS = [
  {
    id: 'free',
    name: 'Gratuito',
    description: 'Ideal para começar com vitrine enxuta no marketplace.',
    priceMonthly: 0,
    priceCooldownHours: PLAN_COOLDOWN_HOURS.free,
    features: [
      'Até 10 produtos',
      'Imagens em até 4 produtos (500 KB cada)',
      'Vitrine com tema padrão (sem logo nem banner)',
      priceCooldownLabel(24),
      'Ativar ou ocultar produtos à venda',
      'Pedidos via WhatsApp',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    description: 'Mais produtos e preços mais flexíveis.',
    priceMonthly: 5,
    priceCooldownHours: PLAN_COOLDOWN_HOURS.starter,
    features: [
      'Até 30 produtos',
      'Imagens em todos os produtos',
      'Logo e banner personalizados',
      priceCooldownLabel(12),
      'Destaque visual na página inicial',
      'Ativar ou ocultar produtos à venda',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'Para lojas em expansão com catálogo maior.',
    priceMonthly: 15,
    priceCooldownHours: PLAN_COOLDOWN_HOURS.growth,
    features: [
      'Até 80 produtos',
      'Imagens em todos os produtos',
      'Logo e banner personalizados',
      priceCooldownLabel(4),
      'Anúncio ampliado na vitrine principal',
      'Prioridade nas buscas',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Sem limites para lojas consolidadas.',
    priceMonthly: 35,
    priceCooldownHours: PLAN_COOLDOWN_HOURS.premium,
    features: [
      'Produtos ilimitados',
      'Imagens em todos os produtos',
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