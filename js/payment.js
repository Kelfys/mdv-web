/**
 * Formas de pagamento no checkout do carrinho.
 * Não há cobrança in-app — a escolha vai no pedido e na mensagem do WhatsApp.
 */
import { t } from './strings.js'

export const PAYMENT_METHODS = [
  { id: 'pix', label: t('checkout.paymentPix'), hint: t('checkout.paymentPixHint'), icon: '⚡' },
  { id: 'cash', label: t('checkout.paymentCash'), hint: t('checkout.paymentCashHint'), icon: '💵' },
  { id: 'card', label: t('checkout.paymentCard'), hint: t('checkout.paymentCardHint'), icon: '💳' },
  { id: 'transfer', label: t('checkout.paymentTransfer'), hint: t('checkout.paymentTransferHint'), icon: '🏦' },
]

export const DEFAULT_PAYMENT_METHOD_IDS = PAYMENT_METHODS.map((m) => m.id)
export const DEFAULT_PAYMENT_METHOD = 'pix'

const PAYMENT_BY_ID = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.id, m]))

export function getPaymentMethod(id) {
  return PAYMENT_BY_ID[id] ?? null
}

export function getPaymentMethodLabel(methodId) {
  return PAYMENT_BY_ID[methodId]?.label ?? methodId
}

/** Normaliza array vindo do Supabase ou JSON legado. */
export function normalizeStorePaymentMethods(value) {
  if (Array.isArray(value) && value.length > 0) {
    return value.filter((id) => PAYMENT_BY_ID[id])
  }
  return [...DEFAULT_PAYMENT_METHOD_IDS]
}

/** Métodos habilitados pela loja para exibir no checkout. */
export function resolveStorePaymentMethods(store) {
  return normalizeStorePaymentMethods(store?.payment_methods)
    .map((id) => PAYMENT_BY_ID[id])
    .filter(Boolean)
}

export function isValidPaymentMethod(methodId, allowedIds = DEFAULT_PAYMENT_METHOD_IDS) {
  return allowedIds.includes(methodId)
}

export function getDefaultPaymentMethod(allowedIds = DEFAULT_PAYMENT_METHOD_IDS) {
  if (allowedIds.includes(DEFAULT_PAYMENT_METHOD)) return DEFAULT_PAYMENT_METHOD
  return allowedIds[0] ?? DEFAULT_PAYMENT_METHOD
}