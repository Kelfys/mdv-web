/**
 * Upload de imagens para Supabase Storage.
 */
import { requireClient } from './db.js'

export const STORAGE_BUCKETS = {
  logos: 'store-logos',
  banners: 'store-banners',
  products: 'product-images',
}

export const PRODUCT_IMAGE_MAX_BYTES = 500 * 1024

const BUCKET_LIMITS = {
  [STORAGE_BUCKETS.logos]: 2 * 1024 * 1024,
  [STORAGE_BUCKETS.banners]: 5 * 1024 * 1024,
  [STORAGE_BUCKETS.products]: PRODUCT_IMAGE_MAX_BYTES,
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export const STORE_BRANDING_UPLOAD_HINT = 'JPG, PNG, WebP ou GIF (planos pagos).'
export const PRODUCT_IMAGE_UPLOAD_HINT =
  `JPG, PNG, WebP ou GIF — máx. ${Math.round(PRODUCT_IMAGE_MAX_BYTES / 1024)} KB.`

/** @deprecated Use PRODUCT_IMAGE_UPLOAD_HINT ou STORE_BRANDING_UPLOAD_HINT */
export const IMAGE_UPLOAD_HINT = PRODUCT_IMAGE_UPLOAD_HINT

function formatMaxSize(bytes) {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`
  return `${Math.round(bytes / 1024)} KB`
}

export function validateImageFile(file, bucket = STORAGE_BUCKETS.products) {
  if (!file?.type?.startsWith('image/')) return 'Selecione um arquivo de imagem válido.'
  if (!ALLOWED_TYPES.includes(file.type)) return 'Formato não suportado. Use JPG, PNG, WebP ou GIF.'
  const max = BUCKET_LIMITS[bucket] ?? PRODUCT_IMAGE_MAX_BYTES
  if (file.size > max) {
    return `Imagem muito grande. Máximo ${formatMaxSize(max)}.`
  }
  return null
}

function imageExtension(file) {
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/gif') return 'gif'
  return 'img'
}

export async function uploadImage(bucket, path, file) {
  const err = validateImageFile(file, bucket)
  if (err) throw new Error(err)

  const client = await requireClient()
  const storagePath = path.includes('.') ? path : `${path}.${imageExtension(file)}`

  const { error } = await client.storage.from(bucket).upload(storagePath, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) throw error

  const { data } = client.storage.from(bucket).getPublicUrl(storagePath)
  return data.publicUrl
}