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

export const SUBSCRIPTION_PLANS = [
  {
    id: 'free',
    name: 'Gratuito',
    description: 'Ideal para começar com vitrine enxuta no marketplace.',
    priceMonthly: 0,
    features: [
      'Até 10 produtos',
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
    features: [
      'Até 30 produtos',
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
    features: [
      'Até 80 produtos',
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
    features: [
      'Produtos ilimitados',
      priceCooldownLabel(null),
      'Máximo destaque na página inicial',
      'Rotação de prioridade a cada 15 min',
    ],
  },
]

export function formatPlanPrice(priceMonthly) {
  return priceMonthly === 0 ? 'Grátis' : `${formatCurrency(priceMonthly)}/mês`
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