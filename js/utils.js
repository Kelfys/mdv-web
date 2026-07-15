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
 *
 * Mensagens de validação (idade, Instagram): chaves errors.* via t() em strings.js.
 */
import { t } from './strings.js'

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatPhone(phone) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return phone
}

/**
 * WhatsApp efetivo para comprar o item:
 * 1) product.whatsapp (vitrine seed / contato por anúncio)
 * 2) product.store.whatsapp
 */
export function getProductContactWhatsapp(product) {
  const fromProduct = String(product?.whatsapp ?? '').trim()
  if (fromProduct) return fromProduct
  return String(product?.store?.whatsapp ?? '').trim()
}

/** Extrai handle do Instagram (sem @) de URL, @usuario ou usuario. */
export function normalizeInstagramHandle(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return ''
  const urlMatch = value.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)/i)
  if (urlMatch) return urlMatch[1].replace(/\/$/, '')
  return value.replace(/^@/, '').replace(/\/$/, '').split('/')[0].split('?')[0]
}

export function validateInstagramHandle(raw) {
  const handle = normalizeInstagramHandle(raw)
  if (!handle) return { ok: true, handle: '' }
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) {
    return { ok: false, message: t('errors.instagramInvalid') }
  }
  return { ok: true, handle }
}

export function instagramProfileUrl(handle) {
  const user = normalizeInstagramHandle(handle)
  if (!user) return null
  return `https://www.instagram.com/${encodeURIComponent(user)}/`
}

export function formatInstagramDisplay(handle) {
  const user = normalizeInstagramHandle(handle)
  return user ? `@${user}` : ''
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

/** Texto de busca local: minúsculas, sem acentos e espaços extras. */
export function normalizeForSearch(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Apenas dígitos — para busca por telefone/WhatsApp. */
export function normalizePhoneDigits(value) {
  return String(value ?? '').replace(/\D/g, '')
}

/** Chave de busca para lojas no painel admin (nome, bairro, cidade, lojista, telefone). */
export function buildStoreSearchKey(store) {
  const phone = store.whatsapp ?? ''
  return normalizeForSearch(
    `${store.name ?? ''} ${store.neighborhood?.name ?? ''} ${store.city ?? ''} ${store.state ?? ''} ${store.owner?.name ?? ''} ${store.owner?.email ?? ''} ${phone} ${normalizePhoneDigits(phone)}`,
  )
}

/** Verifica se o termo corresponde à chave de busca da loja (texto ou dígitos de telefone). */
export function matchesStoreSearch(haystack, term) {
  const normalized = normalizeForSearch(term)
  if (!normalized) return true
  if (haystack.includes(normalized)) return true

  const termDigits = normalizePhoneDigits(term)
  if (termDigits.length < 3) return false
  return normalizePhoneDigits(haystack).includes(termDigits)
}

/** Curtidas com retorno decrescente — evita que um item viral domine o feed. */
const ENGAGEMENT_LIKE_WEIGHT = 2.5
const ENGAGEMENT_LIKE_MAX_BOOST = 10
const ENGAGEMENT_NEW_DAYS = 14
const ENGAGEMENT_NEW_MAX_BOOST = 1.5
const STORE_FAVORITE_WEIGHT = 1.2
const STORE_FAVORITE_MAX_BOOST = 3
const STORE_LIKES_WEIGHT = 1.2
const STORE_LIKES_MAX_BOOST = 3

function logEngagementBoost(count, weight, maxBoost) {
  return Math.min(maxBoost, Math.log1p(Math.max(0, count)) * weight)
}

/** Total exibido de curtidas: orgânicas + ajuste manual do admin. */
export function computeProductLikesCount(organicCount, likesAdjustment = 0) {
  return Math.max(0, (organicCount ?? 0) + (likesAdjustment ?? 0))
}

/** Bônus de ranking para lojas com favoritos recebidos e curtidas no catálogo. */
export function getStoreEngagementBoost(store = {}) {
  const favorites = Math.max(0, store.favorites_count ?? store.favoritesCount ?? 0)
  const likes = Math.max(0, store.likes_count ?? store.likesCount ?? 0)
  return (
    logEngagementBoost(favorites, STORE_FAVORITE_WEIGHT, STORE_FAVORITE_MAX_BOOST)
    + logEngagementBoost(likes, STORE_LIKES_WEIGHT, STORE_LIKES_MAX_BOOST)
  )
}

/** Peso de exibição: curtidas (log) + bônus de produto novo. */
export function getProductEngagementWeight(product, now = Date.now()) {
  const likes = Math.max(0, product.likes_count ?? 0)
  const likeBoost = Math.min(
    ENGAGEMENT_LIKE_MAX_BOOST,
    Math.log1p(likes) * ENGAGEMENT_LIKE_WEIGHT,
  )
  const ageDays = (now - new Date(product.created_at).getTime()) / (1000 * 60 * 60 * 24)
  let newBoost = 0
  if (ageDays < ENGAGEMENT_NEW_DAYS) {
    newBoost = ENGAGEMENT_NEW_MAX_BOOST * (1 - ageDays / ENGAGEMENT_NEW_DAYS)
  }
  return 1 + likeBoost + newBoost
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

export const MIN_REGISTRATION_AGE = 18

/** Data máxima de nascimento para cadastro (hoje − 18 anos). */
export function getMaxBirthDateForRegistration(now = new Date()) {
  const max = new Date(now)
  max.setFullYear(max.getFullYear() - MIN_REGISTRATION_AGE)
  return max.toISOString().slice(0, 10)
}

export function calculateAge(birthDate, now = new Date()) {
  const birth = new Date(`${birthDate}T12:00:00`)
  const today = new Date(now)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export function validateRegistrationBirthDate(birthDate, now = new Date()) {
  const value = birthDate?.trim()
  if (!value) return { ok: false, message: t('errors.birthDateRequired') }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false, message: t('errors.birthDateInvalid') }

  const birth = new Date(`${value}T12:00:00`)
  if (Number.isNaN(birth.getTime())) return { ok: false, message: t('errors.birthDateInvalid') }
  if (value > getMaxBirthDateForRegistration(now)) {
    return { ok: false, message: t('errors.minAgeRegistrationWithAge', { age: MIN_REGISTRATION_AGE }) }
  }

  return { ok: true, birthDate: value }
}

export function showToast(message, duration = 3000) {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = message
  el.classList.remove('hidden')
  clearTimeout(showToast._timer)
  showToast._timer = setTimeout(() => el.classList.add('hidden'), duration)
}