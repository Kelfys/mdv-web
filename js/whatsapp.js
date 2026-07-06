/**
 * Integração com WhatsApp para finalização de pedidos.
 *
 * O fluxo não processa pagamento in-app — apenas monta a mensagem
 * e abre wa.me com o texto pré-preenchido.
 *
 * Melhorias futuras:
 * - Template de mensagem configurável por loja
 * - Fallback para api.whatsapp.com em desktop sem app
 * - Rastreamento de conversão (pedido enviado vs. confirmado)
 */
import { formatCurrency } from './utils.js'
import { getPaymentMethodLabel } from './payment.js'
import { isService } from './catalog.js'
import { t } from './strings.js'

export function buildOrderMessage({
  items,
  total,
  customerName,
  customerPhone,
  customerAddress,
  deliveryPeriod,
  paymentMethod,
}) {
  const lines = items.map((item) => {
    const kind = isService(item.product) ? t('catalog.service') : t('catalog.product')
    return t('whatsapp.lineItem', {
      kind,
      name: item.product.name,
      qty: item.quantity,
      price: formatCurrency(item.product.price * item.quantity),
    })
  })

  return [
    t('whatsapp.greeting'),
    '',
    t('whatsapp.orderIntro'),
    '',
    ...lines,
    '',
    t('whatsapp.total', { amount: formatCurrency(total) }),
    ...(paymentMethod ? ['', t('whatsapp.paymentMethod', { method: getPaymentMethodLabel(paymentMethod) })] : []),
    '',
    t('whatsapp.customerName', { name: customerName }),
    t('whatsapp.customerPhone', { phone: customerPhone }),
    '',
    t('whatsapp.addressLabel'),
    customerAddress,
    ...(deliveryPeriod ? ['', t('whatsapp.deliveryPeriod', { period: deliveryPeriod })] : []),
    '',
    t('whatsapp.thanks'),
  ].join('\n')
}

export function buildWhatsAppUrl(phone, message) {
  const digits = phone.replace(/\D/g, '')
  const normalized = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}