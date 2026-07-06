/**
 * Upload de imagens para Supabase Storage.
 */
import { requireClient } from './db.js'
import { t } from './strings.js'

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

/** Hints do painel lojista/admin — logo em todos os planos; banner exige plano pago. */
export const STORE_LOGO_UPLOAD_HINT = t('uploads.logoHint')
export const STORE_BANNER_UPLOAD_HINT = t('uploads.bannerHint')
/** @deprecated Use STORE_LOGO_UPLOAD_HINT ou STORE_BANNER_UPLOAD_HINT */
export const STORE_BRANDING_UPLOAD_HINT = STORE_BANNER_UPLOAD_HINT
export const PRODUCT_IMAGE_UPLOAD_HINT = t('uploads.productHint', {
  maxKb: Math.round(PRODUCT_IMAGE_MAX_BYTES / 1024),
})

/** @deprecated Use PRODUCT_IMAGE_UPLOAD_HINT ou STORE_BRANDING_UPLOAD_HINT */
export const IMAGE_UPLOAD_HINT = PRODUCT_IMAGE_UPLOAD_HINT

function formatMaxSize(bytes) {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`
  return `${Math.round(bytes / 1024)} KB`
}

export function validateImageFile(file, bucket = STORAGE_BUCKETS.products) {
  if (!file?.type?.startsWith('image/')) return t('uploads.invalidImage')
  if (!ALLOWED_TYPES.includes(file.type)) return t('uploads.unsupportedFormat')
  const max = BUCKET_LIMITS[bucket] ?? PRODUCT_IMAGE_MAX_BYTES
  if (file.size > max) {
    return t('uploads.imageTooLarge', { max: formatMaxSize(max) })
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