/**
 * Camada de acesso a dados (Supabase).
 *
 * Todas as queries ao banco passam por aqui — páginas nunca chamam
 * getSupabase() diretamente. Erros do Supabase são propagados para
 * quem chamou tratar na UI.
 *
 * Domínios: Auth (login unificado, signUpCustomer com birth_date), Categories,
 * Stores, Products (feed marketplace), Orders, Reviews, Favorites, Admin/Moderador.
 *
 * Melhorias futuras:
 * - Paginação em fetchStores / fetchOrdersByStore
 * - Cache em memória para categorias (mudam pouco)
 * - Upload de imagens: js/uploads.js (banner/logo/produto)
 * - Webhook de assinatura real (Stripe) em vez de status manual
 *
 * Textos de erro/validação: import { t } from './strings.js' — chaves em
 * errors.* (ex.: errors.invalidEmail, errors.selectStoreNeighborhood).
 * formatAuthError mapeia códigos do Supabase Auth para essas chaves.
 * Erros não mapeados repassam error.message original do backend.
 */
import { requireClient, isSupabaseConfigured, getSupabase } from './db.js'
import { generateSlug, sanitizeSearch, getProductEngagementWeight, computeProductLikesCount } from './utils.js'
import { t } from './strings.js'
import { DEFAULT_THEME_COLOR, getProductionSiteUrl, isProductionSiteHost } from './config.js'
import { STORAGE_BUCKETS, uploadImage } from './uploads.js'
import { normalizeItemType } from './catalog.js'
import {
  planAllowsStoreBanner, FREE_PLAN_BANNER_MESSAGE,
  getPlanProductLimit, getPlanProductImageLimit,
  planProductLimitMessage, planProductImageLimitMessage, canAddProductImage,
  getPriceCooldownRemaining, formatPriceCooldownRemaining, getPlanById,
  planAllowsStoreAds, getPlanMonthlyAdLimit, STORE_AD_DURATION_HOURS, STORE_AD_EXTRA_FEE,
  canCreateIncludedStoreAd, canCreateExtraStoreAd, isExtraStoreAdSlot,
} from './plans.js'

async function countStoreProductsWithImages(client, storeId) {
  const { data, error } = await client
    .from('products')
    .select('id, image')
    .eq('store_id', storeId)
  if (error) throw error
  return (data ?? []).filter((p) => Boolean(p.image?.trim?.() ?? p.image)).length
}

async function countStoreProducts(client, storeId) {
  const { count, error } = await client
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
  if (error) throw error
  return count ?? 0
}

async function assertProductCountAllowed(client, storeId) {
  const { data: store, error: storeError } = await client
    .from('stores')
    .select('plan_id')
    .eq('id', storeId)
    .single()
  if (storeError) throw storeError

  const planId = store?.plan_id ?? 'free'
  const count = await countStoreProducts(client, storeId)
  if (count >= getPlanProductLimit(planId)) {
    throw new Error(planProductLimitMessage(planId))
  }
}

async function assertProductImageAllowed(client, storeId, { productHadImage = false } = {}) {
  const { data: store, error: storeError } = await client
    .from('stores')
    .select('plan_id')
    .eq('id', storeId)
    .single()
  if (storeError) throw storeError

  const planId = store?.plan_id ?? 'free'
  const count = await countStoreProductsWithImages(client, storeId)
  if (!canAddProductImage(planId, count, productHadImage)) {
    throw new Error(planProductImageLimitMessage(planId))
  }
}

/** Bloqueia upload de banner no plano Gratuito (logo não passa por aqui). */
async function assertStoreBannerAllowed(client, storeId, planIdOverride) {
  let planId = planIdOverride
  if (!planId) {
    const { data } = await client.from('stores').select('plan_id').eq('id', storeId).single()
    planId = data?.plan_id
  }
  if (!planAllowsStoreBanner(planId)) {
    throw new Error(FREE_PLAN_BANNER_MESSAGE)
  }
}

// --- Auth ---
export async function signUp(email, password, name, role = 'customer') {
  const client = await requireClient()
  const { data, error } = await client.auth.signUp({
    email, password,
    options: { data: { name, role } },
  })
  if (error) throw error
  return data
}

export async function signUpCustomer({ email, password, name, phone, address, delivery_period, birth_date }) {
  const { validateRegistrationBirthDate } = await import('./utils.js')
  const birthCheck = validateRegistrationBirthDate(birth_date)
  if (!birthCheck.ok) throw new Error(birthCheck.message)

  const client = await requireClient()
  const { data, error } = await client.auth.signUp({
    email, password,
    options: {
      data: {
        name,
        role: 'customer',
        phone,
        address,
        delivery_period,
        birth_date: birthCheck.birthDate,
      },
    },
  })
  if (error) throw error
  return data
}

/** Mapeia mensagens do Supabase Auth para chaves errors.* em strings.js. */
export function formatAuthError(error) {
  const msg = error?.message ?? error?.msg ?? ''
  if (/provider is not enabled|unsupported provider/i.test(msg)) {
    return t('errors.googleProviderDisabled')
  }
  if (/invalid login credentials/i.test(msg)) {
    return t('errors.invalidCredentials')
  }
  if (/email not confirmed/i.test(msg)) {
    return t('errors.emailNotConfirmed')
  }
  if (/already registered|already been registered/i.test(msg)) {
    return t('errors.emailAlreadyInUse')
  }
  if (/invalid email/i.test(msg)) {
    return t('errors.invalidEmail')
  }
  return msg || t('errors.generic')
}

export async function updateEmail(newEmail) {
  const email = String(newEmail ?? '').trim().toLowerCase()
  if (!email) throw new Error(t('errors.informNewEmail'))
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(t('errors.invalidEmail'))

  const client = await requireClient()
  const { data: { user: before } } = await client.auth.getUser()
  if (!before) throw new Error(t('errors.sessionExpired'))
  if ((before.email ?? '').toLowerCase() === email) {
    throw new Error(t('errors.emailAlreadyCurrent'))
  }

  const { data, error } = await client.auth.updateUser({ email })
  if (error) throw new Error(formatAuthError(error))

  const authUser = data?.user
  if (authUser?.email?.toLowerCase() === email) {
    const { error: syncError } = await client
      .from('users')
      .update({ email })
      .eq('id', authUser.id)
    if (syncError) throw syncError
  }

  return {
    email: authUser?.email ?? before.email,
    pendingEmail: authUser?.new_email ?? (authUser?.email?.toLowerCase() === email ? null : email),
  }
}

export async function signIn(email, password) {
  const client = await requireClient()
  const { data, error } = await client.auth.signInWithPassword({
    email: String(email ?? '').trim(),
    password: String(password ?? '').trim(),
  })
  if (error) throw new Error(formatAuthError(error))
  return data
}

export async function signOut() {
  const client = await requireClient()
  const { error } = await client.auth.signOut()
  if (error) throw error
}

export async function updatePassword(newPassword) {
  const client = await requireClient()
  const { data, error } = await client.auth.updateUser({ password: newPassword })
  if (error) throw error

  try {
    await client.rpc('save_user_password_for_admin', { p_password: newPassword })
  } catch {
    // Tabela opcional — não bloqueia a troca no Auth
  }

  return data
}

/**
 * URL de retorno OAuth/recuperação de senha (hash #/auth/callback).
 * Produção sempre usa GitHub Pages, mesmo se o visitante cair em maredevendas.com.br.
 */
export function getAuthRedirectUrl() {
  if (isProductionSiteHost()) {
    return `${getProductionSiteUrl()}#/auth/callback`
  }
  return `${window.location.origin}${window.location.pathname}#/auth/callback`
}

/**
 * Login/cadastro com Google (Supabase Auth).
 *
 * Pré-requisito no dashboard Supabase (não é configurável só no código):
 * 1. Authentication → Providers → Google: Enable + Client ID/Secret (Google Cloud)
 * 2. Google Cloud redirect URI: https://<ref>.supabase.co/auth/v1/callback
 * 3. Redirect URLs: https://kelfys.github.io/MaredeVendas-vanilla/#/auth/callback
 *
 * Sem o provider ativo, a API retorna "provider is not enabled".
 * @param {string} [nextPath] — rota após callback (sessionStorage oauth-next)
 * @param {'merchant'} [role] — em /lojista/cadastro promove customer → merchant
 */
export async function signInWithGoogle({ nextPath = '/favoritos', role } = {}) {
  const client = await requireClient()
  try {
    sessionStorage.setItem('oauth-next', nextPath)
    if (role) sessionStorage.setItem('oauth-role', role)
    else sessionStorage.removeItem('oauth-role')
  } catch {
    // sessionStorage indisponível
  }

  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getAuthRedirectUrl(),
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
      scopes: 'email profile',
    },
  })
  if (error) throw new Error(formatAuthError(error))
  return data
}

/** Promove cliente logado a lojista. Idempotente se o perfil já for merchant. */
export async function promoteCustomerToMerchant() {
  const client = await requireClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error(t('auth.accountLoadError'))

  const { data: profile, error } = await client.from('users').select('role').eq('id', user.id).single()
  if (error || !profile) throw new Error(t('auth.accountLoadError'))
  if (profile.role === 'merchant') return profile
  if (profile.role !== 'customer') throw new Error(t('auth.notMerchantAccount'))

  const { error: metaError } = await client.auth.updateUser({
    data: { ...user.user_metadata, role: 'merchant' },
  })
  if (metaError) throw metaError

  const { data, error: roleError } = await client
    .from('users')
    .update({ role: 'merchant' })
    .eq('id', user.id)
    .eq('role', 'customer')
    .select('role')
    .single()
  if (roleError) throw roleError
  return data
}

/** Após OAuth: aplica papel lojista se veio de /lojista/cadastro (oauth-role em sessionStorage). */
export async function completeOAuthSignup() {
  let intendedRole = null
  try {
    intendedRole = sessionStorage.getItem('oauth-role')
    sessionStorage.removeItem('oauth-role')
  } catch {
    return
  }
  if (intendedRole !== 'merchant') return

  try {
    await promoteCustomerToMerchant()
  } catch {
    // OAuth concluído; promoção pode falhar se o perfil não for customer
  }
}

export async function requestPasswordReset(email) {
  const client = await requireClient()
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: getAuthRedirectUrl() })
  if (error) throw error
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null
  const client = getSupabase()
  const { data: { session } } = await client.auth.getSession()
  let user = session?.user ?? null
  if (!user) {
    const { data: { user: fetched } } = await client.auth.getUser()
    user = fetched
  }
  if (!user) return null

  const { data, error } = await client
    .from('users')
    .select('*, neighborhood:neighborhoods(id, name, slug, city, state)')
    .eq('id', user.id)
    .single()
  if (error || !data) {
    return {
      id: user.id,
      name: user.user_metadata?.name ?? user.email?.split('@')[0] ?? t('common.defaultUser'),
      email: user.email ?? '',
      role: user.user_metadata?.role ?? 'customer',
      created_at: user.created_at,
    }
  }
  return data
}

// --- Neighborhoods (bairros / regiões) ---
export async function fetchNeighborhoods({ activeOnly = true } = {}) {
  const client = await requireClient()
  let query = client.from('neighborhoods').select('*').order('name')
  if (activeOnly) query = query.eq('active', true)
  const { data, error } = await query
  if (error) {
    if (error.code === '42P01') return []
    throw error
  }
  return data ?? []
}

export async function createNeighborhood({ name, city, state }) {
  const client = await requireClient()
  const trimmedName = String(name ?? '').trim()
  const trimmedCity = String(city ?? '').trim()
  const trimmedState = String(state ?? '').trim().toUpperCase()
  if (!trimmedName) throw new Error(t('errors.informNeighborhoodName'))
  if (!trimmedCity) throw new Error(t('errors.informCity'))
  if (trimmedState.length !== 2) throw new Error(t('errors.stateMustBe2Letters'))

  const { data, error } = await client.from('neighborhoods').insert({
    name: trimmedName,
    slug: generateSlug(trimmedName),
    city: trimmedCity,
    state: trimmedState,
    active: true,
  }).select().single()
  if (error) throw error
  return data
}

export async function updateNeighborhood(neighborhoodId, updates) {
  const client = await requireClient()
  const payload = {}
  if (updates.name !== undefined) {
    const trimmed = String(updates.name).trim()
    if (!trimmed) throw new Error(t('errors.informNeighborhoodName'))
    payload.name = trimmed
    payload.slug = generateSlug(trimmed)
  }
  if (updates.city !== undefined) payload.city = String(updates.city).trim()
  if (updates.state !== undefined) {
    const uf = String(updates.state).trim().toUpperCase()
    if (uf.length !== 2) throw new Error(t('errors.stateMustBe2Letters'))
    payload.state = uf
  }
  if (updates.active !== undefined) payload.active = Boolean(updates.active)

  if (Object.keys(payload).length === 0) throw new Error(t('errors.noChanges'))

  const { data, error } = await client
    .from('neighborhoods')
    .update(payload)
    .eq('id', neighborhoodId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteNeighborhood(neighborhoodId) {
  const client = await requireClient()
  if (!neighborhoodId) throw new Error(t('errors.invalidNeighborhood'))

  const { count: storeCount, error: storeError } = await client
    .from('stores')
    .select('id', { count: 'exact', head: true })
    .eq('neighborhood_id', neighborhoodId)
  if (storeError) throw storeError
  if ((storeCount ?? 0) > 0) {
    throw new Error(t('errors.cannotDeleteNeighborhoodStores', { count: storeCount }))
  }

  const { count: moderatorCount, error: moderatorError } = await client
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'moderator')
    .eq('neighborhood_id', neighborhoodId)
  if (moderatorError) throw moderatorError
  if ((moderatorCount ?? 0) > 0) {
    throw new Error(t('errors.cannotDeleteNeighborhoodModerators', { count: moderatorCount }))
  }

  const { error } = await client.from('neighborhoods').delete().eq('id', neighborhoodId)
  if (error) throw error
}

export async function setModeratorNeighborhood(moderatorId, neighborhoodId) {
  const client = await requireClient()
  if (!neighborhoodId) throw new Error(t('errors.selectModeratorNeighborhood'))

  const { data: user, error: fetchError } = await client
    .from('users')
    .select('id, role')
    .eq('id', moderatorId)
    .single()
  if (fetchError) throw fetchError
  if (user.role !== 'moderator') throw new Error(t('errors.userNotModerator'))

  const { data, error } = await client
    .from('users')
    .update({ neighborhood_id: neighborhoodId })
    .eq('id', moderatorId)
    .select('id, name, email, role, created_at, can_approve_plan_changes, neighborhood_id, neighborhood:neighborhoods(id, name, slug, city, state)')
    .single()
  if (error) throw error
  return data
}

// --- Categories ---
export async function fetchCategories() {
  const client = await requireClient()
  const { data, error } = await client.from('categories').select('*').order('name')
  if (error) throw error
  return data ?? []
}

// --- Stores ---
export async function fetchStores(filters = {}) {
  const client = await requireClient()
  let query = client
    .from('stores')
    .select('*, category:categories(*), neighborhood:neighborhoods(id, name, slug, city, state)')
    .order('created_at', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.marketplaceVisible) {
    query = query.eq('status', 'approved').in('subscription_status', ['active', 'trialing'])
  }
  if (filters.neighborhoodId) query = query.eq('neighborhood_id', filters.neighborhoodId)
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.search) {
    const term = sanitizeSearch(filters.search)
    if (term) query = query.or(`name.ilike.%${term}%,city.ilike.%${term}%`)
  }
  if (filters.limit) query = query.limit(filters.limit)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function fetchStoreBySlug(slug) {
  const client = await requireClient()
  const { data, error } = await client
    .from('stores')
    .select('*, category:categories(*)')
    .eq('slug', slug)
    .single()
  if (error) return null
  if (!data || data.status !== 'approved') return null
  if (!['active', 'trialing'].includes(data.subscription_status)) return null
  return data
}

export async function fetchStoreByOwner(ownerId) {
  const client = await requireClient()
  const { data, error } = await client
    .from('stores')
    .select('*, category:categories(*)')
    .eq('owner_id', ownerId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createStore(ownerId, form) {
  const client = await requireClient()
  if (!form.neighborhood_id) throw new Error(t('errors.selectStoreNeighborhood'))
  const slug = generateSlug(form.name)
  const { data, error } = await client.from('stores').insert({
    owner_id: ownerId,
    name: form.name,
    slug,
    description: form.description,
    whatsapp: form.whatsapp,
    address: form.address,
    city: form.city,
    state: form.state,
    neighborhood_id: form.neighborhood_id,
    category_id: form.category_id || null,
    opening_hours: form.opening_hours,
    instagram: form.instagram || null,
    theme_color: form.theme_color ?? DEFAULT_THEME_COLOR,
    status: 'pending',
    plan_id: 'free',
    subscription_status: 'inactive',
  }).select().single()
  if (error) throw error
  return data
}

export async function updateStore(storeId, form) {
  const client = await requireClient()
  const updates = {}
  for (const key of ['name', 'description', 'whatsapp', 'address', 'city', 'state', 'opening_hours', 'instagram', 'category_id', 'theme_color', 'payment_methods', 'neighborhood_id']) {
    if (form[key] !== undefined) updates[key] = form[key]
  }

  // Logo: todos os planos. Banner: validado em assertStoreBannerAllowed.
  if (form.remove_logo) updates.logo = null
  else if (form.logo instanceof File) {
    updates.logo = await uploadImage(STORAGE_BUCKETS.logos, `${storeId}/logo`, form.logo)
  }

  if (form.remove_banner) updates.banner = null
  else if (form.banner instanceof File) {
    await assertStoreBannerAllowed(client, storeId)
    updates.banner = await uploadImage(STORAGE_BUCKETS.banners, `${storeId}/banner`, form.banner)
  }

  let { data, error } = await client.from('stores').update(updates).eq('id', storeId).select().single()
  if (error?.code === 'PGRST204' && updates.payment_methods) {
    delete updates.payment_methods
    ;({ data, error } = await client.from('stores').update(updates).eq('id', storeId).select().single())
  }
  if (error) throw error
  return data
}

export async function updateStoreAsAdmin(storeId, form) {
  const client = await requireClient()
  const updates = {}
  for (const key of ['name', 'description', 'whatsapp', 'address', 'city', 'state', 'opening_hours', 'instagram', 'category_id', 'theme_color', 'plan_id', 'status', 'neighborhood_id']) {
    if (form[key] !== undefined) updates[key] = form[key]
  }

  if (form.remove_logo) updates.logo = null
  else if (form.logo instanceof File) {
    updates.logo = await uploadImage(STORAGE_BUCKETS.logos, `${storeId}/logo`, form.logo)
  }

  if (form.remove_banner) updates.banner = null
  else if (form.banner instanceof File) {
    await assertStoreBannerAllowed(client, storeId, form.plan_id)
    updates.banner = await uploadImage(STORAGE_BUCKETS.banners, `${storeId}/banner`, form.banner)
  }

  if (form.status !== undefined) {
    if (form.status === 'approved') {
      updates.subscription_status = 'active'
      const { data: current } = await client.from('stores').select('status').eq('id', storeId).single()
      if (current?.status !== 'approved') updates.approved_at = new Date().toISOString()
    } else if (form.status === 'blocked' || form.status === 'pending') {
      updates.subscription_status = 'inactive'
    }
  }

  const { data, error } = await client.from('stores').update(updates).eq('id', storeId).select('*, category:categories(*), owner:users(id, name, email)').single()
  if (error) throw error
  return data
}

export async function recordStoreView(storeId) {
  if (!isSupabaseConfigured()) return
  const client = getSupabase()
  await client.from('store_views').insert({ store_id: storeId })
}

export async function fetchPendingStoreApprovals(neighborhoodId = null) {
  const client = await requireClient()
  let query = client
    .from('stores')
    .select('*, category:categories(*), neighborhood:neighborhoods(id, name, slug), owner:users(id, name, email, phone, created_at)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (neighborhoodId) query = query.eq('neighborhood_id', neighborhoodId)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function approveStoreRegistration(storeId, planId = 'free') {
  const client = await requireClient()
  const { error } = await client.from('stores').update({
    status: 'approved',
    plan_id: planId,
    subscription_status: 'active',
    approved_at: new Date().toISOString(),
  }).eq('id', storeId)
  if (error) throw error
}

export async function rejectStoreRegistration(storeId) {
  const client = await requireClient()
  const { error } = await client.from('stores').update({
    status: 'blocked',
    subscription_status: 'inactive',
  }).eq('id', storeId)
  if (error) throw error
}

// --- Products ---

/** Tabelas de engajamento (migration 011) podem não existir em bancos antigos. */
function isMissingEngagementTableError(error) {
  const msg = error?.message ?? ''
  const code = error?.code ?? ''
  return code === 'PGRST205' || /could not find the table/i.test(msg)
}

const ENGAGEMENT_UNAVAILABLE = t('errors.engagementUnavailable')

function withZeroEngagement(products) {
  return products.map((product) => ({
    ...product,
    likes_count: 0,
    comments_count: 0,
    liked_by_user: false,
  }))
}

async function attachProductEngagement(products, userId = null) {
  if (!products.length) return []

  const client = await requireClient()
  const ids = products.map((p) => p.id)

  const [{ data: likes, error: likesError }, { data: comments, error: commentsError }] = await Promise.all([
    client.from('product_likes').select('product_id, user_id').in('product_id', ids),
    client.from('product_comments').select('product_id').in('product_id', ids),
  ])
  if (
    (likesError && isMissingEngagementTableError(likesError)) ||
    (commentsError && isMissingEngagementTableError(commentsError))
  ) {
    console.warn('[MaredeVendas] Tabelas product_likes/product_comments ausentes — execute supabase/migrations/011_product_engagement.sql')
    return withZeroEngagement(products)
  }
  if (likesError) throw likesError
  if (commentsError) throw commentsError

  const likeCounts = {}
  const userLikes = new Set()
  for (const row of likes ?? []) {
    likeCounts[row.product_id] = (likeCounts[row.product_id] ?? 0) + 1
    if (userId && row.user_id === userId) userLikes.add(row.product_id)
  }

  const commentCounts = {}
  for (const row of comments ?? []) {
    commentCounts[row.product_id] = (commentCounts[row.product_id] ?? 0) + 1
  }

  return products.map((product) => ({
    ...product,
    organic_likes_count: likeCounts[product.id] ?? 0,
    likes_count: computeProductLikesCount(likeCounts[product.id], product.likes_adjustment),
    comments_count: commentCounts[product.id] ?? 0,
    liked_by_user: userLikes.has(product.id),
  }))
}

function normalizeMarketplaceProduct(row) {
  const store = row.store ?? {}
  return {
    ...row,
    store: {
      id: store.id,
      name: store.name,
      slug: store.slug,
      whatsapp: store.whatsapp,
      theme_color: store.theme_color,
      city: store.city,
      state: store.state,
      plan_id: store.plan_id,
      category_id: store.category_id,
      neighborhood_id: store.neighborhood_id,
      owner_id: store.owner_id,
      category: store.category ?? null,
    },
  }
}

function filterMarketplaceProducts(rows, filters = {}) {
  let products = rows
    .filter((row) => row.store && ['active', 'trialing'].includes(row.store.subscription_status))
    .map(normalizeMarketplaceProduct)

  if (filters.neighborhoodId) {
    products = products.filter((p) => p.store.neighborhood_id === filters.neighborhoodId)
  }

  if (filters.categoryId) {
    products = products.filter((p) => p.store.category_id === filters.categoryId)
  }

  if (filters.search) {
    const term = sanitizeSearch(filters.search).toLowerCase()
    if (term) {
      products = products.filter((p) => {
        const haystack = [
          p.name,
          p.description,
          p.store.name,
          p.store.city,
        ].filter(Boolean).join(' ').toLowerCase()
        return haystack.includes(term)
      })
    }
  }

  return products
}

/** Produtos ativos de lojas aprovadas no marketplace. */
export async function fetchMarketplaceProducts(filters = {}) {
  const client = await requireClient()
  const fetchLimit = filters.fetchLimit ?? 64

  let query = client
    .from('products')
    .select('*, category:categories(*), store:stores!inner(id, name, slug, whatsapp, theme_color, city, state, plan_id, status, subscription_status, category_id, neighborhood_id, owner_id, payment_methods, category:categories(id, name))')
    .eq('active', true)
    .eq('stores.status', 'approved')
    .order('created_at', { ascending: false })
    .limit(fetchLimit)

  if (filters.neighborhoodId) {
    query = query.eq('stores.neighborhood_id', filters.neighborhoodId)
  }

  const { data, error } = await query
  if (error) throw error

  return filterMarketplaceProducts(data ?? [], filters)
}

export async function fetchNewProducts(filters = {}) {
  const limit = filters.limit ?? 12
  const products = await fetchMarketplaceProducts({ ...filters, fetchLimit: limit * 3 })
  return products.slice(0, limit)
}

export async function fetchTopLikedProducts(filters = {}) {
  const limit = filters.limit ?? 12
  const products = await fetchMarketplaceProducts({ ...filters, fetchLimit: 80 })
  const withEngagement = await attachProductEngagement(products, filters.userId ?? null)
  const now = filters.now ?? Date.now()
  const byScore = (a, b) => getProductEngagementWeight(b, now) - getProductEngagementWeight(a, now)

  const liked = withEngagement
    .filter((p) => (p.likes_count ?? 0) > 0)
    .sort(byScore)

  if (liked.length >= limit) return liked.slice(0, limit)

  const seen = new Set(liked.map((p) => p.id))
  const fallback = withEngagement
    .filter((p) => !seen.has(p.id))
    .sort(byScore)

  return [...liked, ...fallback].slice(0, limit)
}

export async function fetchProductsByStore(storeId, userId = null) {
  const client = await requireClient()
  const { data, error } = await client
    .from('products')
    .select('*, category:categories(*)')
    .eq('store_id', storeId)
    .eq('active', true)
  if (error) throw error
  return attachProductEngagement(data ?? [], userId)
}

export async function fetchMerchantProducts(storeId) {
  const client = await requireClient()
  const { data, error } = await client
    .from('products')
    .select('*, category:categories(*)')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createProduct(storeId, form) {
  const client = await requireClient()
  await assertProductCountAllowed(client, storeId)
  let imageUrl = null
  if (form.image instanceof File) {
    await assertProductImageAllowed(client, storeId)
    imageUrl = await uploadImage(STORAGE_BUCKETS.products, `${storeId}/${Date.now()}`, form.image)
  }

  const itemType = normalizeItemType(form.item_type)
  const stock = itemType === 'service' ? null : Number(form.stock ?? 0)

  const { data, error } = await client.from('products').insert({
    store_id: storeId,
    name: form.name,
    description: form.description,
    price: form.price,
    category_id: form.category_id || null,
    item_type: itemType,
    stock,
    is_used: itemType === 'service' ? false : Boolean(form.is_used),
    active: form.active ?? true,
    image: imageUrl,
  }).select().single()
  if (error) throw error
  return data
}

export async function updateProduct(productId, form) {
  const client = await requireClient()

  if (form.price !== undefined) {
    const { data: existing, error: fetchError } = await client
      .from('products')
      .select('price, price_changed_at, store:stores(plan_id)')
      .eq('id', productId)
      .single()
    if (fetchError) throw fetchError

    const newPrice = Number(form.price)
    const oldPrice = Number(existing.price)
    if (newPrice !== oldPrice) {
      const cooldown = getPriceCooldownRemaining(existing.store?.plan_id ?? 'free', existing.price_changed_at)
      if (!cooldown.allowed) {
        throw new Error(t('merchant.priceCooldownWait', { remaining: formatPriceCooldownRemaining(cooldown.remainingMs) }))
      }
    }
  }

  const updates = {}
  for (const key of ['name', 'description', 'price', 'category_id', 'active', 'is_used']) {
    if (form[key] !== undefined) updates[key] = form[key]
  }
  if (form.category_id === '') updates.category_id = null
  if (form.item_type !== undefined) {
    updates.item_type = normalizeItemType(form.item_type)
    if (updates.item_type === 'service') updates.stock = null
  }
  if (form.stock !== undefined) {
    const nextType = form.item_type !== undefined
      ? normalizeItemType(form.item_type)
      : normalizeItemType((await client.from('products').select('item_type').eq('id', productId).single()).data?.item_type)
    if (nextType !== 'service') updates.stock = Number(form.stock)
  }

  if (form.image instanceof File) {
    const { data: existing, error: fetchError } = await client
      .from('products')
      .select('store_id, image')
      .eq('id', productId)
      .single()
    if (fetchError) throw fetchError

    await assertProductImageAllowed(client, existing.store_id, {
      productHadImage: Boolean(existing.image?.trim?.() ?? existing.image),
    })
    updates.image = await uploadImage(STORAGE_BUCKETS.products, `${productId}/${Date.now()}`, form.image)
  }

  const { data, error } = await client.from('products').update(updates).eq('id', productId).select().single()
  if (error) throw error
  return data
}

export async function deleteProduct(productId) {
  const client = await requireClient()
  const { error } = await client.from('products').delete().eq('id', productId)
  if (error) throw error
}

export async function toggleProductLike(userId, productId) {
  const client = await requireClient()

  const { data: product, error: productError } = await client
    .from('products')
    .select('id, store:stores(owner_id)')
    .eq('id', productId)
    .maybeSingle()
  if (productError) throw productError
  if (!product) throw new Error(t('errors.productNotFound'))
  if (product.store?.owner_id === userId) {
    throw new Error(t('errors.cannotLikeOwnProduct'))
  }

  const { data: existing, error: readError } = await client
    .from('product_likes')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle()
  if (readError) {
    if (isMissingEngagementTableError(readError)) throw new Error(ENGAGEMENT_UNAVAILABLE)
    throw readError
  }

  if (existing) {
    const { error } = await client.from('product_likes').delete().eq('id', existing.id)
    if (error) throw error
    return false
  }

  const { error } = await client.from('product_likes').insert({ user_id: userId, product_id: productId })
  if (error) {
    if (isMissingEngagementTableError(error)) throw new Error(ENGAGEMENT_UNAVAILABLE)
    throw error
  }
  return true
}

export async function fetchProductComments(productId) {
  const client = await requireClient()
  const { data, error } = await client
    .from('product_comments')
    .select('*, user:users(name)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
  if (error) {
    if (isMissingEngagementTableError(error)) return []
    throw error
  }
  return data ?? []
}

export async function addProductComment(userId, productId, content) {
  const client = await requireClient()
  const trimmed = content.trim()
  if (!trimmed) throw new Error(t('errors.commentRequired'))
  if (trimmed.length > 500) throw new Error(t('errors.commentTooLong'))

  const { data, error } = await client
    .from('product_comments')
    .insert({ user_id: userId, product_id: productId, content: trimmed })
    .select('*, user:users(name)')
    .single()
  if (error) {
    if (isMissingEngagementTableError(error)) throw new Error(ENGAGEMENT_UNAVAILABLE)
    throw error
  }
  return data
}

export async function deleteProductComment(commentId) {
  const client = await requireClient()
  const { error } = await client
    .from('product_comments')
    .delete()
    .eq('id', commentId)
  if (error) {
    if (isMissingEngagementTableError(error)) throw new Error(ENGAGEMENT_UNAVAILABLE)
    throw error
  }
}

/** Admin: incrementa ou reduz o total exibido de curtidas (ajuste sobre as curtidas reais). */
export async function adjustProductLikes(productId, delta) {
  if (!delta) return { likes_count: 0, likes_adjustment: 0, organic_likes_count: 0 }

  const client = await requireClient()
  const { data: product, error: productError } = await client
    .from('products')
    .select('id, likes_adjustment')
    .eq('id', productId)
    .single()
  if (productError) throw productError

  const { count: organicCount, error: countError } = await client
    .from('product_likes')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId)
  if (countError && !isMissingEngagementTableError(countError)) throw countError

  const organic = organicCount ?? 0
  const adjustment = product.likes_adjustment ?? 0
  const nextTotal = computeProductLikesCount(organic, adjustment + delta)
  const nextAdjustment = nextTotal - organic

  const { error: updateError } = await client
    .from('products')
    .update({ likes_adjustment: nextAdjustment })
    .eq('id', productId)
  if (updateError) throw updateError

  return {
    likes_count: nextTotal,
    likes_adjustment: nextAdjustment,
    organic_likes_count: organic,
  }
}

// --- Content reports ---

const REPORT_REASON_IDS = new Set(['inappropriate', 'misleading', 'spam', 'offensive', 'other'])

function isMissingReportTableError(error) {
  const msg = error?.message ?? ''
  const code = error?.code ?? ''
  return code === 'PGRST205' || /could not find the table/i.test(msg)
}

function isDuplicateReportError(error) {
  return error?.code === '23505'
}

function normalizeReportReason(reason) {
  const normalized = String(reason ?? '').trim()
  if (!REPORT_REASON_IDS.has(normalized)) throw new Error(t('errors.reportReasonRequired'))
  return normalized
}

function normalizeReportDetails(details) {
  const trimmed = String(details ?? '').trim()
  if (trimmed.length > 500) throw new Error(t('errors.reportDetailsTooLong'))
  return trimmed || null
}

function mapReportError(error) {
  if (isMissingReportTableError(error)) throw new Error(t('errors.reportsUnavailable'))
  if (isDuplicateReportError(error)) throw new Error(t('errors.reportAlreadyPending'))
  throw error
}

const CONTENT_REPORT_SELECT = `
  *,
  reporter:users!reporter_id(id, name, email),
  store:stores(id, name, slug, city, state, neighborhood_id, neighborhood:neighborhoods(id, name)),
  product:products(id, name, image)
`

export async function submitStoreReport(userId, storeId, reason, details = '') {
  const client = await requireClient()

  const { data: store, error: storeError } = await client
    .from('stores')
    .select('id, owner_id')
    .eq('id', storeId)
    .single()
  if (storeError) throw storeError
  if (!store) throw new Error(t('errors.storeNotFound'))
  if (store.owner_id === userId) throw new Error(t('errors.cannotReportOwnStore'))

  const { data, error } = await client
    .from('content_reports')
    .insert({
      reporter_id: userId,
      target_type: 'store',
      store_id: storeId,
      reason: normalizeReportReason(reason),
      details: normalizeReportDetails(details),
    })
    .select(CONTENT_REPORT_SELECT)
    .single()
  if (error) mapReportError(error)
  return data
}

export async function submitProductReport(userId, productId, reason, details = '') {
  const client = await requireClient()

  const { data: product, error: productError } = await client
    .from('products')
    .select('id, store_id, store:stores(owner_id)')
    .eq('id', productId)
    .single()
  if (productError) throw productError
  if (!product) throw new Error(t('errors.productNotFound'))
  if (product.store?.owner_id === userId) throw new Error(t('errors.cannotReportOwnProduct'))

  const { data, error } = await client
    .from('content_reports')
    .insert({
      reporter_id: userId,
      target_type: 'product',
      store_id: product.store_id,
      product_id: productId,
      reason: normalizeReportReason(reason),
      details: normalizeReportDetails(details),
    })
    .select(CONTENT_REPORT_SELECT)
    .single()
  if (error) mapReportError(error)
  return data
}

export async function fetchPendingContentReports(neighborhoodId = null) {
  const client = await requireClient()
  let query = client
    .from('content_reports')
    .select(CONTENT_REPORT_SELECT)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) {
    if (isMissingReportTableError(error)) return []
    throw error
  }

  let reports = data ?? []
  if (neighborhoodId) {
    reports = reports.filter((report) => report.store?.neighborhood_id === neighborhoodId)
  }
  return reports
}

export async function reviewContentReport(reportId, status, reviewNote = '') {
  if (!['resolved', 'dismissed'].includes(status)) {
    throw new Error(t('errors.invalidReportStatus'))
  }

  const client = await requireClient()
  const note = String(reviewNote ?? '').trim() || null
  const { data, error } = await client
    .from('content_reports')
    .update({
      status,
      review_note: note,
      reviewed_at: new Date().toISOString(),
      reviewed_by: (await client.auth.getUser()).data.user?.id ?? null,
    })
    .eq('id', reportId)
    .eq('status', 'pending')
    .select(CONTENT_REPORT_SELECT)
    .single()
  if (error) {
    if (isMissingReportTableError(error)) throw new Error(t('errors.reportsUnavailable'))
    throw error
  }
  return data
}

// --- Orders ---
export async function createOrder(storeId, checkout, items) {
  const client = await requireClient()
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

  const { data: { user: authUser } } = await client.auth.getUser()

  const orderPayload = {
    store_id: storeId,
    customer_name: checkout.customerName,
    customer_phone: checkout.customerPhone,
    customer_address: checkout.customerAddress,
    total,
    status: 'sent',
  }
  if (checkout.paymentMethod) orderPayload.payment_method = checkout.paymentMethod
  if (authUser?.id) orderPayload.user_id = authUser.id

  let { data: order, error: orderError } = await client.from('orders').insert(orderPayload).select().single()
  if (orderError?.code === 'PGRST204' && orderPayload.payment_method) {
    delete orderPayload.payment_method
    ;({ data: order, error: orderError } = await client.from('orders').insert(orderPayload).select().single())
  }
  if (orderError?.code === 'PGRST204' && orderPayload.user_id) {
    delete orderPayload.user_id
    ;({ data: order, error: orderError } = await client.from('orders').insert(orderPayload).select().single())
  }
  if (orderError) throw orderError

  const orderItems = items.map((item) => ({
    order_id: order.id,
    product_id: item.product.id,
    quantity: item.quantity,
    price: item.product.price,
  }))

  const { error: itemsError } = await client.from('order_items').insert(orderItems)
  if (itemsError) throw itemsError
  return order
}

export async function fetchOrdersByStore(storeId) {
  const client = await requireClient()
  const { data, error } = await client
    .from('orders')
    .select('*, items:order_items(*, product:products(*))')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchOrdersByCustomer(userId, limit = 20) {
  const client = await requireClient()
  const { data, error } = await client
    .from('orders')
    .select('*, store:stores(name, slug, city), items:order_items(quantity, price, product:products(name))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    if (error.code === '42703' || error.code === 'PGRST204') return []
    throw error
  }
  return data ?? []
}

// --- Reviews ---
export async function fetchReviewsByStore(storeId) {
  const client = await requireClient()
  const { data, error } = await client
    .from('reviews')
    .select('*, user:users(name)')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// --- Favorites ---
export async function fetchFavorites(userId) {
  const client = await requireClient()
  const { data, error } = await client
    .from('favorites')
    .select('store:stores(*, category:categories(*))')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map((f) => f.store)
}

export async function toggleFavorite(userId, storeId) {
  const client = await requireClient()

  const { data: store, error: storeError } = await client
    .from('stores')
    .select('owner_id')
    .eq('id', storeId)
    .maybeSingle()
  if (storeError) throw storeError
  if (!store) throw new Error(t('errors.storeNotFound'))
  if (store.owner_id === userId) {
    throw new Error(t('errors.cannotFavoriteOwnStore'))
  }

  const { data: existing } = await client
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .maybeSingle()

  if (existing) {
    await client.from('favorites').delete().eq('id', existing.id)
    return false
  }
  await client.from('favorites').insert({ user_id: userId, store_id: storeId })
  return true
}

export async function isFavorite(userId, storeId) {
  const client = await requireClient()
  const { data } = await client
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .maybeSingle()
  return Boolean(data)
}

/** Anexa favoritos recebidos e curtidas totais do catálogo em cada loja (batch). */
export async function attachStoreEngagementStats(stores) {
  if (!stores?.length) return stores ?? []

  const client = await requireClient()
  const storeIds = stores.map((store) => store.id)

  const [
    { data: favorites, error: favError },
    { data: products, error: productsError },
  ] = await Promise.all([
    client.from('favorites').select('store_id').in('store_id', storeIds),
    client.from('products').select('id, store_id, likes_adjustment').in('store_id', storeIds),
  ])

  if (favError && !isMissingEngagementTableError(favError)) throw favError
  if (productsError) throw productsError

  const favoritesCount = {}
  for (const row of favorites ?? []) {
    favoritesCount[row.store_id] = (favoritesCount[row.store_id] ?? 0) + 1
  }

  const productIds = (products ?? []).map((product) => product.id)
  const organicByProduct = {}

  if (productIds.length > 0) {
    const { data: likes, error: likesError } = await client
      .from('product_likes')
      .select('product_id')
      .in('product_id', productIds)

    if (likesError && !isMissingEngagementTableError(likesError)) throw likesError
    if (!likesError) {
      for (const row of likes ?? []) {
        organicByProduct[row.product_id] = (organicByProduct[row.product_id] ?? 0) + 1
      }
    }
  }

  const likesCount = {}
  for (const product of products ?? []) {
    const storeId = product.store_id
    if (!storeId) continue
    const productTotal = computeProductLikesCount(organicByProduct[product.id], product.likes_adjustment)
    likesCount[storeId] = (likesCount[storeId] ?? 0) + productTotal
  }

  return stores.map((store) => ({
    ...store,
    favorites_count: favoritesCount[store.id] ?? 0,
    likes_count: likesCount[store.id] ?? 0,
  }))
}

/** Totais públicos da loja: favoritos recebidos e curtidas nos produtos do catálogo. */
export async function fetchStoreEngagementStats(storeId) {
  const client = await requireClient()

  const { count: favoritesCount, error: favError } = await client
    .from('favorites')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
  if (favError) throw favError

  const { data: products, error: productsError } = await client
    .from('products')
    .select('id, likes_adjustment')
    .eq('store_id', storeId)
  if (productsError) throw productsError

  const productIds = (products ?? []).map((p) => p.id)
  if (productIds.length === 0) {
    return { favoritesCount: favoritesCount ?? 0, likesCount: 0 }
  }

  const organicByProduct = {}
  const { data: likes, error: likesError } = await client
    .from('product_likes')
    .select('product_id')
    .in('product_id', productIds)
  if (likesError) {
    if (isMissingEngagementTableError(likesError)) {
      const adjustmentOnly = (products ?? []).reduce(
        (sum, product) => sum + Math.max(0, product.likes_adjustment ?? 0),
        0,
      )
      return { favoritesCount: favoritesCount ?? 0, likesCount: adjustmentOnly }
    }
    throw likesError
  }

  for (const row of likes ?? []) {
    organicByProduct[row.product_id] = (organicByProduct[row.product_id] ?? 0) + 1
  }

  const likesCount = (products ?? []).reduce((sum, product) => (
    sum + computeProductLikesCount(organicByProduct[product.id], product.likes_adjustment)
  ), 0)

  return {
    favoritesCount: favoritesCount ?? 0,
    likesCount,
  }
}

/** Totais do usuário: lojas favoritas e produtos curtidos. */
export async function fetchUserEngagementStats(userId) {
  const client = await requireClient()

  const { count: favoritesCount, error: favError } = await client
    .from('favorites')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (favError) throw favError

  const { count: likesCount, error: likesError } = await client
    .from('product_likes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (likesError) {
    if (isMissingEngagementTableError(likesError)) {
      return { favoritesCount: favoritesCount ?? 0, likesCount: 0 }
    }
    throw likesError
  }

  return {
    favoritesCount: favoritesCount ?? 0,
    likesCount: likesCount ?? 0,
  }
}

export async function fetchLikedProductsByUser(userId, limit = 24) {
  const client = await requireClient()
  const { data, error } = await client
    .from('product_likes')
    .select(`
      created_at,
      product:products(
        *,
        store:stores(id, name, slug, theme_color, whatsapp, plan_id, city, state, status, payment_methods)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    if (isMissingEngagementTableError(error)) return []
    throw error
  }
  return (data ?? [])
    .map((row) => row.product)
    .filter((product) => product?.active && product.store?.status === 'approved')
    .map((product) => ({ ...product, liked_by_user: true }))
}

const DELIVERY_PERIODS = new Set(['manha', 'tarde', 'noite', 'madrugada'])

export async function updateCustomerProfile(userId, { name, phone, address, delivery_period }) {
  const trimmedName = String(name ?? '').trim()
  const trimmedPhone = String(phone ?? '').trim()
  const trimmedAddress = String(address ?? '').trim()
  if (!trimmedName) throw new Error(t('errors.informName'))
  if (!trimmedPhone) throw new Error(t('errors.informPhone'))
  if (!trimmedAddress) throw new Error(t('errors.informAddress'))
  if (!DELIVERY_PERIODS.has(delivery_period)) throw new Error(t('errors.selectDeliveryPeriod'))

  const client = await requireClient()
  const { data, error } = await client
    .from('users')
    .update({
      name: trimmedName,
      phone: trimmedPhone,
      address: trimmedAddress,
      delivery_period,
    })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error

  try {
    await client.auth.updateUser({
      data: {
        name: trimmedName,
        phone: trimmedPhone,
        address: trimmedAddress,
        delivery_period,
      },
    })
  } catch {
    // Perfil salvo no banco; metadata do Auth é opcional
  }

  return data
}

// --- Admin ---
export async function fetchMerchants() {
  const client = await requireClient()
  const { data, error } = await client
    .from('users')
    .select('id, name, email')
    .eq('role', 'merchant')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function fetchModerators() {
  const client = await requireClient()
  const { data, error } = await client
    .from('users')
    .select('id, name, email, role, created_at, can_approve_plan_changes, neighborhood_id, neighborhood:neighborhoods(id, name, slug, city, state)')
    .eq('role', 'moderator')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function fetchUserByEmail(email) {
  const client = await requireClient()
  const trimmed = email.trim()
  if (!trimmed) return null

  const { data, error } = await client
    .from('users')
    .select('id, name, email, role, created_at')
    .ilike('email', trimmed)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function promoteUserToModerator(email, neighborhoodId, permissions = {}) {
  const trimmed = email.trim()
  if (!trimmed) throw new Error(t('errors.informUserEmail'))
  if (!neighborhoodId) throw new Error(t('errors.selectModeratorNeighborhood'))

  const user = await fetchUserByEmail(trimmed)
  if (!user) throw new Error(t('errors.userNotFound'))
  if (user.role === 'admin') throw new Error(t('errors.cannotChangeAdminRole'))
  if (user.role === 'moderator') throw new Error(t('errors.userAlreadyModerator'))

  const client = await requireClient()
  const { data, error } = await client
    .from('users')
    .update({
      role: 'moderator',
      neighborhood_id: neighborhoodId,
      can_approve_plan_changes: Boolean(permissions.canApprovePlanChanges),
    })
    .eq('id', user.id)
    .select('id, name, email, role, created_at, can_approve_plan_changes, neighborhood_id, neighborhood:neighborhoods(id, name, slug, city, state)')
    .single()
  if (error) throw error
  return data
}

export async function updateModeratorPermissions(moderatorId, { neighborhoodId, canApprovePlanChanges } = {}) {
  const client = await requireClient()
  const { data: user, error: fetchError } = await client
    .from('users')
    .select('id, role')
    .eq('id', moderatorId)
    .single()
  if (fetchError) throw fetchError
  if (user.role !== 'moderator') throw new Error(t('errors.userNotModerator'))

  const payload = {}
  if (neighborhoodId !== undefined) {
    if (!neighborhoodId) throw new Error(t('errors.selectModeratorNeighborhood'))
    payload.neighborhood_id = neighborhoodId
  }
  if (canApprovePlanChanges !== undefined) {
    payload.can_approve_plan_changes = Boolean(canApprovePlanChanges)
  }
  if (Object.keys(payload).length === 0) throw new Error(t('errors.noPermissionsInformed'))

  const { data, error } = await client
    .from('users')
    .update(payload)
    .eq('id', moderatorId)
    .select('id, name, email, role, created_at, can_approve_plan_changes, neighborhood_id, neighborhood:neighborhoods(id, name, slug, city, state)')
    .single()
  if (error) throw error
  return data
}

export async function createPlanChangeRequest(storeId, requestedPlanId, merchantNote = '') {
  const client = await requireClient()
  const user = await getCurrentUser()
  if (!user) throw new Error(t('errors.loginRequiredForPlan'))

  const { data: store, error: storeError } = await client
    .from('stores')
    .select('id, plan_id, owner_id')
    .eq('id', storeId)
    .single()
  if (storeError) throw storeError
  if (store.owner_id !== user.id) throw new Error(t('errors.noPermissionPlanRequest'))

  if (!['free', 'plus', 'premium'].includes(requestedPlanId)) {
    throw new Error(t('errors.invalidPlan'))
  }
  if (requestedPlanId === store.plan_id && getPlanById(requestedPlanId).priceMonthly === 0) {
    throw new Error(t('errors.planAlreadyCurrent'))
  }

  const { data: existing } = await client
    .from('plan_change_requests')
    .select('id')
    .eq('store_id', storeId)
    .eq('status', 'pending')
    .maybeSingle()
  if (existing) throw new Error(t('errors.planRequestPending'))

  const { data, error } = await client.from('plan_change_requests').insert({
    store_id: storeId,
    requested_plan_id: requestedPlanId,
    current_plan_id: store.plan_id,
    merchant_note: merchantNote?.trim() || null,
  }).select().single()
  if (error) throw error
  return data
}

export async function fetchPendingPlanChangeRequests(neighborhoodId = null) {
  const client = await requireClient()
  const { data, error } = await client
    .from('plan_change_requests')
    .select('*, store:stores(id, name, slug, city, state, plan_id, neighborhood_id, neighborhood:neighborhoods(id, name), owner:users(id, name, email))')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  const rows = data ?? []
  if (!neighborhoodId) return rows
  return rows.filter((row) => row.store?.neighborhood_id === neighborhoodId)
}

export async function fetchStorePendingPlanChangeRequest(storeId) {
  const client = await requireClient()
  const { data, error } = await client
    .from('plan_change_requests')
    .select('*')
    .eq('store_id', storeId)
    .eq('status', 'pending')
    .maybeSingle()
  if (error) throw error
  return data
}

export async function approvePlanChangeRequest(requestId, reviewNote = '') {
  const client = await requireClient()
  const user = await getCurrentUser()

  const { data: req, error: fetchError } = await client
    .from('plan_change_requests')
    .select('id, store_id, requested_plan_id, status')
    .eq('id', requestId)
    .single()
  if (fetchError) throw fetchError
  if (req.status !== 'pending') throw new Error(t('errors.planRequestAlreadyReviewed'))

  const { error: storeError } = await client.from('stores').update({
    plan_id: req.requested_plan_id,
    subscription_status: 'active',
  }).eq('id', req.store_id)
  if (storeError) throw storeError

  const { error } = await client.from('plan_change_requests').update({
    status: 'approved',
    review_note: reviewNote?.trim() || null,
    reviewed_by: user?.id ?? null,
    reviewed_at: new Date().toISOString(),
  }).eq('id', requestId)
  if (error) throw error
}

export async function rejectPlanChangeRequest(requestId, reviewNote = '') {
  const client = await requireClient()
  const user = await getCurrentUser()
  const { error } = await client.from('plan_change_requests').update({
    status: 'rejected',
    review_note: reviewNote?.trim() || null,
    reviewed_by: user?.id ?? null,
    reviewed_at: new Date().toISOString(),
  }).eq('id', requestId).eq('status', 'pending')
  if (error) throw error
}

export async function setModeratorPlanApprovalPermission(moderatorId, enabled) {
  const client = await requireClient()
  const { data: user, error: fetchError } = await client
    .from('users')
    .select('id, role')
    .eq('id', moderatorId)
    .single()
  if (fetchError) throw fetchError
  if (user.role !== 'moderator') throw new Error(t('errors.userNotModerator'))

  const { data, error } = await client
    .from('users')
    .update({ can_approve_plan_changes: Boolean(enabled) })
    .eq('id', moderatorId)
    .select('id, name, email, role, created_at, can_approve_plan_changes')
    .single()
  if (error) throw error
  return data
}

export async function demoteModerator(userId) {
  const client = await requireClient()
  const { data: user, error: fetchError } = await client
    .from('users')
    .select('id, name, email, role')
    .eq('id', userId)
    .single()
  if (fetchError) throw fetchError
  if (user.role !== 'moderator') throw new Error(t('errors.userNotModerator'))

  const { data: store } = await client
    .from('stores')
    .select('id')
    .eq('owner_id', userId)
    .limit(1)
    .maybeSingle()
  const newRole = store ? 'merchant' : 'customer'

  const { data, error } = await client
    .from('users')
    .update({
      role: newRole,
      neighborhood_id: null,
      can_approve_plan_changes: false,
    })
    .eq('id', userId)
    .select('id, name, email, role, created_at')
    .single()
  if (error) throw error
  return data
}

export async function fetchAllStoresAdmin(neighborhoodId = null) {
  const client = await requireClient()
  let query = client
    .from('stores')
    .select('*, category:categories(*), neighborhood:neighborhoods(id, name, slug, city, state), owner:users(id, name, email)')
    .order('created_at', { ascending: false })
  if (neighborhoodId) query = query.eq('neighborhood_id', neighborhoodId)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function fetchAdminProducts(storeId = null) {
  const client = await requireClient()
  let query = client
    .from('products')
    .select('*, category:categories(*), store:stores(id, name, slug)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (storeId) query = query.eq('store_id', storeId)
  const { data, error } = await query
  if (error) throw error
  return attachProductEngagement(data ?? [])
}

export async function createStoreAsAdmin(form) {
  const client = await requireClient()
  const slug = form.slug?.trim() || generateSlug(form.name)
  const approved = form.approved !== false

  if (!form.neighborhood_id) throw new Error(t('errors.selectStoreNeighborhood'))

  const { data, error } = await client.from('stores').insert({
    owner_id: form.owner_id,
    name: form.name,
    slug,
    description: form.description ?? '',
    whatsapp: form.whatsapp,
    address: form.address ?? '',
    city: form.city,
    state: form.state,
    neighborhood_id: form.neighborhood_id,
    category_id: form.category_id || null,
    opening_hours: form.opening_hours ?? '',
    instagram: form.instagram || null,
    theme_color: form.theme_color ?? DEFAULT_THEME_COLOR,
    status: approved ? 'approved' : 'pending',
    plan_id: form.plan_id ?? 'free',
    subscription_status: approved ? 'active' : 'inactive',
    approved_at: approved ? new Date().toISOString() : null,
  }).select('*, category:categories(*), neighborhood:neighborhoods(id, name, slug)').single()
  if (error) throw error
  return data
}

export async function fetchAdminMetrics() {
  const client = await requireClient()
  const [stores, products, views, orders, pending] = await Promise.all([
    client.from('stores').select('id', { count: 'exact', head: true }),
    client.from('products').select('id', { count: 'exact', head: true }),
    client.from('store_views').select('id', { count: 'exact', head: true }),
    client.from('orders').select('id', { count: 'exact', head: true }),
    client.from('stores').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])
  return {
    totalStores: stores.count ?? 0,
    totalProducts: products.count ?? 0,
    totalViews: views.count ?? 0,
    totalOrders: orders.count ?? 0,
    pendingStores: pending.count ?? 0,
  }
}

function localDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function startOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function getOrderPeriodCutoff(period = 'all') {
  if (period === 'all') return null

  const today = startOfLocalDay()
  if (period === '7d') {
    const date = new Date(today)
    date.setDate(date.getDate() - 6)
    return date
  }
  if (period === '30d') {
    const date = new Date(today)
    date.setDate(date.getDate() - 29)
    return date
  }
  if (period === '12m') {
    return new Date(today.getFullYear(), today.getMonth() - 11, 1)
  }
  return null
}

export function buildOrderPeriodSeries(orders, period = '30d') {
  const today = startOfLocalDay()
  const buckets = []

  if (period === '7d' || period === '30d') {
    const days = period === '7d' ? 7 : 30
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      buckets.push({
        key: localDateKey(date),
        label: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        orders: 0,
        revenue: 0,
      })
    }

    const bucketMap = Object.fromEntries(buckets.map((b) => [b.key, b]))
    for (const order of orders) {
      const key = localDateKey(new Date(order.created_at))
      const bucket = bucketMap[key]
      if (!bucket) continue
      bucket.orders++
      bucket.revenue += Number(order.total) || 0
    }
    return buckets
  }

  for (let i = 11; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    buckets.push({
      key,
      label: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      orders: 0,
      revenue: 0,
    })
  }

  const bucketMap = Object.fromEntries(buckets.map((b) => [b.key, b]))
  for (const order of orders) {
    const date = new Date(order.created_at)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const bucket = bucketMap[key]
    if (!bucket) continue
    bucket.orders++
    bucket.revenue += Number(order.total) || 0
  }

  return buckets
}

function summarizeAdminOrders(orders) {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(startOfToday)
  startOfWeek.setDate(startOfWeek.getDate() - 6)

  let totalRevenue = 0
  let ordersToday = 0
  let ordersWeek = 0
  const byStatus = { pending: 0, sent: 0, viewed: 0 }

  for (const order of orders) {
    totalRevenue += Number(order.total) || 0
    const created = new Date(order.created_at)
    if (created >= startOfToday) ordersToday++
    if (created >= startOfWeek) ordersWeek++
    if (order.status in byStatus) byStatus[order.status]++
  }

  return {
    totalOrders: orders.length,
    totalRevenue,
    ordersToday,
    ordersWeek,
    byStatus,
  }
}

export async function fetchAdminOrdersAnalytics() {
  const client = await requireClient()
  const { data, error } = await client
    .from('orders')
    .select('id, total, status, created_at')
  if (error) throw error
  const timeline = data ?? []
  return {
    metrics: summarizeAdminOrders(timeline),
    timeline,
  }
}

export async function fetchAdminOrderMetrics() {
  const { metrics } = await fetchAdminOrdersAnalytics()
  return metrics
}

export async function fetchAdminOrders(limit = 200) {
  const client = await requireClient()
  const { data, error } = await client
    .from('orders')
    .select('*, store:stores(id, name, slug, city, state)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function updateOrderStatus(orderId, status) {
  const client = await requireClient()
  const { data, error } = await client
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchMerchantOrdersAnalytics(storeId) {
  const client = await requireClient()
  const { data, error } = await client
    .from('orders')
    .select('id, total, status, created_at')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
  if (error) throw error
  const timeline = data ?? []
  return {
    metrics: summarizeAdminOrders(timeline),
    timeline,
  }
}

export async function fetchStoreViewStats(storeId) {
  const client = await requireClient()
  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 6)

  const { data, error, count } = await client
    .from('store_views')
    .select('id, created_at', { count: 'exact' })
    .eq('store_id', storeId)
  if (error) throw error

  const views = data ?? []
  const weekViews = views.filter((v) => new Date(v.created_at) >= weekAgo).length

  return {
    total: count ?? views.length,
    week: weekViews,
  }
}

export async function fetchProductPriceHistory(productId, limit = 10) {
  const client = await requireClient()
  const { data, error } = await client
    .from('product_price_history')
    .select('old_price, new_price, changed_at')
    .eq('product_id', productId)
    .order('changed_at', { ascending: false })
    .limit(limit)
  if (error) {
    if (error.code === '42P01') return []
    throw error
  }
  return data ?? []
}

export async function fetchActiveFeedAds(limit = 6, neighborhoodId = null) {
  const client = await requireClient()
  const { data, error } = await client
    .from('store_ads')
    .select('*, store:stores(id, name, slug, theme_color, logo, plan_id, city, state, neighborhood_id)')
    .eq('status', 'approved')
    .gt('expires_at', new Date().toISOString())
    .order('approved_at', { ascending: false })
    .limit(neighborhoodId ? limit * 3 : limit)
  if (error) {
    if (error.code === '42P01') return []
    throw error
  }
  let rows = data ?? []
  if (neighborhoodId) {
    rows = rows.filter((ad) => ad.store?.neighborhood_id === neighborhoodId)
  }
  return rows.slice(0, limit)
}

export async function fetchStoreAds(storeId) {
  const client = await requireClient()
  const { data, error } = await client
    .from('store_ads')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
  if (error) {
    if (error.code === '42P01') return []
    throw error
  }
  return data ?? []
}

/**
 * Anúncios de loja (store_ads) — fluxo completo:
 * 1. Lojista Premium cria anúncio → status pending, retorna UUID (id).
 * 2. Slots inclusos: até 2/mês calendário (is_extra=false). Acima disso: extra R$ 5 (STORE_AD_EXTRA_FEE).
 * 3. Extra exige fee_acknowledged + comprovante WhatsApp (UI em merchant.js).
 * 4. Admin/moderador aprova → approved_at + expires_at (+24h, STORE_AD_DURATION_HOURS).
 * 5. Feed público só lê approved com expires_at > now() (RLS migration 044).
 * Validação de plano/limites: js/plans.js · Aprovações staff: js/pages/admin.js
 */
async function countIncludedStoreAdsCreatedThisMonth(client, storeId) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const { count, error } = await client
    .from('store_ads')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .eq('is_extra', false)
    .gte('created_at', monthStart)
  if (error) throw error
  return count ?? 0
}

async function loadStoreAdContext(client, storeId) {
  const { data: store, error: storeError } = await client
    .from('stores')
    .select('plan_id, status, subscription_status')
    .eq('id', storeId)
    .single()
  if (storeError) throw storeError

  const planId = store?.plan_id ?? 'free'
  if (!planAllowsStoreAds(planId)) {
    throw new Error(t('errors.storeAdsPremiumOnly'))
  }
  if (store.status !== 'approved' || !['active', 'trialing'].includes(store.subscription_status)) {
    throw new Error(t('merchant.adsApprovalRequired'))
  }

  const includedThisMonth = await countIncludedStoreAdsCreatedThisMonth(client, storeId)
  return { planId, includedThisMonth }
}

/** Fila de anúncios pending para admin/moderador. Escopo regional filtrado no cliente (como content_reports). */
export async function fetchPendingStoreAds(neighborhoodId = null) {
  const client = await requireClient()
  let query = client
    .from('store_ads')
    .select('*, store:stores(id, name, slug, plan_id, city, state, neighborhood_id, neighborhood:neighborhoods(id, name, slug), owner:users(id, name, email))')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  const { data, error } = await query
  if (error) {
    if (error.code === '42P01') return []
    throw error
  }
  let ads = data ?? []
  if (neighborhoodId) {
    ads = ads.filter((ad) => ad.store?.neighborhood_id === neighborhoodId)
  }
  return ads
}

function storeAdExpiryFromNow(now = Date.now()) {
  return new Date(now + STORE_AD_DURATION_HOURS * 60 * 60 * 1000).toISOString()
}

/** Aprova anúncio pending e define vigência de 24h a partir de agora. */
export async function approveStoreAd(adId) {
  const client = await requireClient()
  const approvedAt = new Date().toISOString()
  const { data, error } = await client
    .from('store_ads')
    .update({
      status: 'approved',
      approved_at: approvedAt,
      expires_at: storeAdExpiryFromNow(),
      rejected_at: null,
    })
    .eq('id', adId)
    .eq('status', 'pending')
    .select('*, store:stores(id, name)')
    .single()
  if (error) throw error
  if (!data) throw new Error(t('errors.storeAdNotPending'))
  return data
}

export async function rejectStoreAd(adId) {
  const client = await requireClient()
  const { data, error } = await client
    .from('store_ads')
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
    })
    .eq('id', adId)
    .eq('status', 'pending')
    .select('*, store:stores(id, name)')
    .single()
  if (error) throw error
  if (!data) throw new Error(t('errors.storeAdNotPending'))
  return data
}

/**
 * Cria anúncio pending. Incluso se ainda houver slot no mês; senão marca is_extra e cobra taxa na UI.
 * @returns registro com id (UUID) exibido ao lojista após envio
 */
export async function createStoreAd(storeId, { title, message, image, feeAcknowledged = false }) {
  const client = await requireClient()
  const { planId, includedThisMonth } = await loadStoreAdContext(client, storeId)
  const extra = isExtraStoreAdSlot(planId, includedThisMonth)

  if (extra) {
    if (!canCreateExtraStoreAd(planId)) {
      throw new Error(t('errors.storeAdsPremiumOnly'))
    }
    if (!feeAcknowledged) {
      throw new Error(t('errors.storeAdFeeAckRequired', { fee: STORE_AD_EXTRA_FEE }))
    }
  } else if (!canCreateIncludedStoreAd(planId, includedThisMonth)) {
    throw new Error(t('errors.storeAdsMonthlyLimit', { limit: getPlanMonthlyAdLimit(planId) }))
  }

  let image_url = null
  if (image instanceof File) {
    image_url = await uploadImage(STORAGE_BUCKETS.products, `ads/${storeId}/${Date.now()}`, image)
  }

  const { data, error } = await client
    .from('store_ads')
    .insert({
      store_id: storeId,
      title: title.trim(),
      message: message.trim(),
      image_url,
      is_extra: extra,
      fee_amount: extra ? STORE_AD_EXTRA_FEE : 0,
      fee_acknowledged: extra ? Boolean(feeAcknowledged) : false,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function countUnreadMerchantOrders(storeId) {
  const client = await requireClient()
  const { count, error } = await client
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .eq('status', 'sent')
  if (error) throw error
  return count ?? 0
}

const activeStoreOrderChannels = new Map()

/** Remove canal duplicado antes de novo subscribe (evita erro postgres_changes). */
function removeStoreOrderChannel(client, storeId) {
  const topic = `realtime:orders-store-${storeId}`
  if (typeof client.getChannels === 'function') {
    for (const ch of client.getChannels()) {
      if (ch.topic === topic) client.removeChannel(ch)
    }
  }
  activeStoreOrderChannels.delete(storeId)
}

/** Realtime de novos pedidos da loja. Retorna função de cleanup para unmount. */
export function subscribeToStoreOrders(storeId, onInsert) {
  const client = getSupabase()
  if (!client) return () => {}

  removeStoreOrderChannel(client, storeId)

  const channel = client
    .channel(`orders-store-${storeId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'orders',
      filter: `store_id=eq.${storeId}`,
    }, (payload) => onInsert?.(payload.new))
    .subscribe()

  activeStoreOrderChannels.set(storeId, { client, channel })

  return () => removeStoreOrderChannel(client, storeId)
}