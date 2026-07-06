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

export function buildOrderMessage({
  items,
  total,
  customerName,
  customerPhone,
  customerAddress,
  deliveryPeriod,
  paymentMethod,
}) {
  const lines = items.map(
    (item) => `${item.product.name} (${item.quantity}x) - ${formatCurrency(item.product.price * item.quantity)}`
  )

  return [
    'Olá!',
    '',
    'Gostaria de fazer o seguinte pedido:',
    '',
    ...lines,
    '',
    `Total: ${formatCurrency(total)}`,
    ...(paymentMethod ? ['', `Forma de pagamento: ${getPaymentMethodLabel(paymentMethod)}`] : []),
    '',
    `Nome: ${customerName}`,
    `Telefone: ${customerPhone}`,
    '',
    'Endereço:',
    customerAddress,
    ...(deliveryPeriod ? ['', `Melhor horário para entrega: ${deliveryPeriod}`] : []),
    '',
    'Obrigado.',
  ].join('\n')
}

export function buildWhatsAppUrl(phone, message) {
  const digits = phone.replace(/\D/g, '')
  const normalized = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}