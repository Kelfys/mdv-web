/**
 * Estado global da aplicação (tema, auth, carrinho).
 *
 * Padrão pub/sub: onAuthChange / onCartChange notificam componentes
 * sem acoplamento direto entre módulos.
 *
 * Persistência:
 * - Tema e carrinho ficam no localStorage
 * - Sessão do usuário vem do Supabase Auth (api.js)
 *
 * Melhorias futuras:
 * - Carrinho por loja com TTL (expirar após X dias)
 * - Sincronizar carrinho com conta logada (tabela no Supabase)
 * - Validar estoque/preço ao reabrir carrinho salvo
 */
import { CART_STORAGE_KEY, THEME_STORAGE_KEY } from './config.js'
import { DEFAULT_PAYMENT_METHOD_IDS, normalizeStorePaymentMethods } from './payment.js'
import { getCurrentUser, signOut as apiSignOut } from './api.js'

// --- Theme ---
export function getTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) ?? 'light'
}

export function setTheme(theme) {
  localStorage.setItem(THEME_STORAGE_KEY, theme)
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light')
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#000000' : '#E1306C')
}

export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}

// --- Admin UI (badge na toolbar) ---
let adminPendingCount = 0

export function setAdminPendingCount(count) {
  adminPendingCount = Math.max(0, Number(count) || 0)
}

export function getAdminPendingCount() {
  return adminPendingCount
}

// --- Merchant UI (badge na toolbar) ---
let merchantNewOrdersCount = 0

export function setMerchantNewOrdersCount(count) {
  merchantNewOrdersCount = Math.max(0, Number(count) || 0)
}

export function getMerchantNewOrdersCount() {
  return merchantNewOrdersCount
}

// --- Auth ---
let currentUser = null
const authListeners = new Set()

export function onAuthChange(fn) {
  authListeners.add(fn)
  return () => authListeners.delete(fn)
}

function notifyAuth() {
  authListeners.forEach((fn) => fn(currentUser))
}

export function getUser() {
  return currentUser
}

export async function loadUser() {
  currentUser = await getCurrentUser()
  notifyAuth()
  return currentUser
}

export function setUser(user) {
  currentUser = user
  notifyAuth()
}

export async function logout() {
  await apiSignOut()
  currentUser = null
  notifyAuth()
}

// --- Cart ---
function loadCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? 'null')
    if (!parsed) return defaultCart()
    return {
      ...defaultCart(),
      ...parsed,
      storePaymentMethods: normalizeStorePaymentMethods(parsed.storePaymentMethods),
    }
  } catch {
    return defaultCart()
  }
}

function defaultCart() {
  return {
    storeId: null,
    storeName: null,
    storeWhatsapp: null,
    storePaymentMethods: [...DEFAULT_PAYMENT_METHOD_IDS],
    items: [],
    isOpen: false,
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
}

let cart = loadCart()
const cartListeners = new Set()

export function onCartChange(fn) {
  cartListeners.add(fn)
  return () => cartListeners.delete(fn)
}

function notifyCart() {
  cartListeners.forEach((fn) => fn(cart))
}

export function getCart() {
  return cart
}

export function setStore(storeId, storeName, whatsapp, paymentMethods = DEFAULT_PAYMENT_METHOD_IDS) {
  const methods = [...paymentMethods]
  if (cart.storeId && cart.storeId !== storeId) {
    cart = { ...cart, storeId, storeName, storeWhatsapp: whatsapp, storePaymentMethods: methods, items: [] }
  } else {
    cart = { ...cart, storeId, storeName, storeWhatsapp: whatsapp, storePaymentMethods: methods }
  }
  saveCart(cart)
  notifyCart()
}

export function addItem(product) {
  const existing = cart.items.find((i) => i.product.id === product.id)
  if (existing) {
    cart.items = cart.items.map((i) =>
      i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
    )
  } else {
    cart.items = [...cart.items, { product, quantity: 1 }]
  }
  saveCart(cart)
  notifyCart()
}

export function removeItem(productId) {
  cart.items = cart.items.filter((i) => i.product.id !== productId)
  saveCart(cart)
  notifyCart()
}

export function updateQuantity(productId, quantity) {
  if (quantity <= 0) {
    removeItem(productId)
    return
  }
  cart.items = cart.items.map((i) =>
    i.product.id === productId ? { ...i, quantity } : i
  )
  saveCart(cart)
  notifyCart()
}

export function clearCart() {
  cart = defaultCart()
  saveCart(cart)
  notifyCart()
}

export function openCart() {
  cart = { ...cart, isOpen: true }
  saveCart(cart)
  notifyCart()
}

export function closeCart() {
  cart = { ...cart, isOpen: false }
  saveCart(cart)
  notifyCart()
}

export function getCartTotal() {
  return cart.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
}

export function getCartItemCount() {
  return cart.items.reduce((sum, item) => sum + item.quantity, 0)
}