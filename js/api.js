/**
 * Camada de acesso a dados (Supabase).
 *
 * Todas as queries ao banco passam por aqui — páginas nunca chamam
 * getSupabase() diretamente. Erros do Supabase são propagados para
 * quem chamou tratar na UI.
 *
 * Domínios: Auth, Categories, Stores, Products, Orders, Reviews,
 * Favorites, Admin.
 *
 * Melhorias futuras:
 * - Paginação em fetchStores / fetchOrdersByStore
 * - Cache em memória para categorias (mudam pouco)
 * - Upload de imagens (banner/logo/produto) via Storage API
 * - Webhook de assinatura real (Stripe) em vez de status manual
 */
import { requireClient, isSupabaseConfigured, getSupabase } from './db.js'
import { generateSlug, sanitizeSearch } from './utils.js'
import { DEFAULT_THEME_COLOR } from './config.js'

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

export async function signUpCustomer({ email, password, name, phone, address, delivery_period }) {
  const client = await requireClient()
  const { data, error } = await client.auth.signUp({
    email, password,
    options: { data: { name, role: 'customer', phone, address, delivery_period } },
  })
  if (error) throw error
  return data
}

export async function signIn(email, password) {
  const client = await requireClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const client = await requireClient()
  const { error } = await client.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null
  const client = getSupabase()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return null

  const { data, error } = await client.from('users').select('*').eq('id', user.id).single()
  if (error || !data) {
    return {
      id: user.id,
      name: user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'Usuário',
      email: user.email ?? '',
      role: user.user_metadata?.role ?? 'customer',
      created_at: user.created_at,
    }
  }
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
  let query = client.from('stores').select('*, category:categories(*)').order('created_at', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.marketplaceVisible) {
    query = query.eq('status', 'approved').in('subscription_status', ['active', 'trialing'])
  }
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
    category_id: form.category_id || null,
    opening_hours: form.opening_hours,
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
  for (const key of ['name', 'description', 'whatsapp', 'address', 'city', 'state', 'opening_hours', 'category_id', 'theme_color']) {
    if (form[key] !== undefined) updates[key] = form[key]
  }
  const { data, error } = await client.from('stores').update(updates).eq('id', storeId).select().single()
  if (error) throw error
  return data
}

export async function recordStoreView(storeId) {
  if (!isSupabaseConfigured()) return
  const client = getSupabase()
  await client.from('store_views').insert({ store_id: storeId })
}

export async function fetchPendingStoreApprovals() {
  const client = await requireClient()
  const { data, error } = await client
    .from('stores')
    .select('*, category:categories(*), owner:users(id, name, email, phone, created_at)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
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
async function attachProductEngagement(products, userId = null) {
  if (!products.length) return []

  const client = await requireClient()
  const ids = products.map((p) => p.id)

  const [{ data: likes, error: likesError }, { data: comments, error: commentsError }] = await Promise.all([
    client.from('product_likes').select('product_id, user_id').in('product_id', ids),
    client.from('product_comments').select('product_id').in('product_id', ids),
  ])
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
    likes_count: likeCounts[product.id] ?? 0,
    comments_count: commentCounts[product.id] ?? 0,
    liked_by_user: userLikes.has(product.id),
  }))
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
  const { data, error } = await client.from('products').insert({
    store_id: storeId,
    name: form.name,
    description: form.description,
    price: form.price,
    category_id: form.category_id || null,
    stock: form.stock,
    active: form.active ?? true,
  }).select().single()
  if (error) throw error
  return data
}

export async function updateProduct(productId, form) {
  const client = await requireClient()
  const { data, error } = await client.from('products').update(form).eq('id', productId).select().single()
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
  const { data: existing, error: readError } = await client
    .from('product_likes')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle()
  if (readError) throw readError

  if (existing) {
    const { error } = await client.from('product_likes').delete().eq('id', existing.id)
    if (error) throw error
    return false
  }

  const { error } = await client.from('product_likes').insert({ user_id: userId, product_id: productId })
  if (error) throw error
  return true
}

export async function fetchProductComments(productId) {
  const client = await requireClient()
  const { data, error } = await client
    .from('product_comments')
    .select('*, user:users(name)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function addProductComment(userId, productId, content) {
  const client = await requireClient()
  const trimmed = content.trim()
  if (!trimmed) throw new Error('Escreva um comentário antes de enviar.')
  if (trimmed.length > 500) throw new Error('O comentário deve ter no máximo 500 caracteres.')

  const { data, error } = await client
    .from('product_comments')
    .insert({ user_id: userId, product_id: productId, content: trimmed })
    .select('*, user:users(name)')
    .single()
  if (error) throw error
  return data
}

// --- Orders ---
export async function createOrder(storeId, checkout, items) {
  const client = await requireClient()
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

  const { data: order, error: orderError } = await client.from('orders').insert({
    store_id: storeId,
    customer_name: checkout.customerName,
    customer_phone: checkout.customerPhone,
    customer_address: checkout.customerAddress,
    total,
    status: 'sent',
  }).select().single()
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

// --- Admin ---
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