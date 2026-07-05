/**
 * Funções utilitárias puras (formatação, segurança, ranking).
 *
 * escapeHtml: obrigatório em todo conteúdo dinâmico inserido via innerHTML.
 * sanitizeSearch: evita wildcards maliciosos em filtros ilike do Supabase.
 *
 * Melhorias futuras:
 * - Debounce/throttle reutilizáveis (hoje home.js faz debounce inline)
 * - Validação de telefone brasileiro mais rigorosa
 * - i18n se expandir para outros países
 */
export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatPhone(phone) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return phone
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(date))
}

export function formatDateTimeCsv(date) {
  const d = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function escapeCsvField(value) {
  const str = value == null ? '' : String(value)
  if (/[;"\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function buildCsv(headers, rows, delimiter = ';') {
  const lines = [
    headers.map(escapeCsvField).join(delimiter),
    ...rows.map((row) => row.map(escapeCsvField).join(delimiter)),
  ]
  return lines.join('\n')
}

export function downloadTextFile(filename, content, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([`\uFEFF${content}`], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function sanitizeSearch(query) {
  return query.trim().replace(/[%_\\]/g, '')
}

const ENGAGEMENT_LIKE_WEIGHT = 5
const ENGAGEMENT_NEW_DAYS = 14
const ENGAGEMENT_NEW_MAX_BOOST = 1.5

/** Peso de exibição: curtidas valem mais que o bônus de produto novo. */
export function getProductEngagementWeight(product, now = Date.now()) {
  const likes = product.likes_count ?? 0
  const ageDays = (now - new Date(product.created_at).getTime()) / (1000 * 60 * 60 * 24)
  let newBoost = 0
  if (ageDays < ENGAGEMENT_NEW_DAYS) {
    newBoost = ENGAGEMENT_NEW_MAX_BOOST * (1 - ageDays / ENGAGEMENT_NEW_DAYS)
  }
  return 1 + likes * ENGAGEMENT_LIKE_WEIGHT + newBoost
}

/** Sorteio ponderado — produtos mais curtidos têm maior chance de aparecer primeiro. */
export function rankProductsByEngagement(products) {
  if (!products?.length) return []

  const pool = products.map((product) => ({
    product,
    weight: getProductEngagementWeight(product),
  }))
  const ranked = []

  while (pool.length > 0) {
    const total = pool.reduce((sum, item) => sum + item.weight, 0)
    let pick = Math.random() * total
    let index = 0

    for (let i = 0; i < pool.length; i++) {
      pick -= pool[i].weight
      if (pick <= 0) {
        index = i
        break
      }
    }

    ranked.push(pool[index].product)
    pool.splice(index, 1)
  }

  return ranked
}

export function showToast(message, duration = 3000) {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = message
  el.classList.remove('hidden')
  clearTimeout(showToast._timer)
  showToast._timer = setTimeout(() => el.classList.add('hidden'), duration)
}