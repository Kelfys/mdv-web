import { describe, it, expect } from 'vitest'
import {
  PLAN_LIMITS,
  FREE_PLAN_BANNER_MESSAGE,
  getPlanPriceCooldownHours,
  getPriceCooldownRemaining,
  formatPriceCooldownRemaining,
  getPlanById,
  getPlanProductLimit,
  getPlanProductImageLimit,
  planAllowsProductImages,
  planProductLimitMessage,
  planProductImageLimitMessage,
  planProductsRemaining,
  planProductImagesRemaining,
  formatProductLimitHint,
  countProductsWithImages,
  canCreateProduct,
  canAddProductImage,
  planAllowsStoreLogo,
  planAllowsStoreBanner,
  planAllowsStoreAds,
  getPlanMonthlyAdLimit,
  countStoreAdsThisMonth,
  canCreateStoreAd,
  formatStoreAdLimitHint,
  renderSubscriptionPlanCards,
} from '../js/plans.js'

describe('plan price cooldown', () => {
  it('returns hours per plan', () => {
    expect(getPlanPriceCooldownHours('free')).toBe(24)
    expect(getPlanPriceCooldownHours('premium')).toBeNull()
  })

  it('blocks price change inside cooldown window', () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const result = getPriceCooldownRemaining('free', recent)
    expect(result.allowed).toBe(false)
    expect(result.remainingMs).toBeGreaterThan(0)
  })

  it('allows price change after cooldown', () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const result = getPriceCooldownRemaining('free', old)
    expect(result.allowed).toBe(true)
  })

  it('formats remaining time', () => {
    expect(formatPriceCooldownRemaining(90 * 60 * 1000)).toMatch(/h/)
  })

  it('resolves plan by id', () => {
    expect(getPlanById('starter').name).toBe('Starter')
    expect(getPlanById('starter').priceMonthly).toBe(2.99)
    expect(getPlanById('plus').name).toBe('Plus')
  })

  it('lists starter plan features with 6-item catalog', () => {
    const plan = getPlanById('starter')
    expect(plan.features).toContain('Até 6 itens (produtos ou serviços)')
    expect(plan.features).toContain('Imagens em até 6 produtos (500 KB cada)')
  })
})

describe('plan store images', () => {
  it('allows logo on all plans including free', () => {
    expect(planAllowsStoreLogo('free')).toBe(true)
    expect(planAllowsStoreLogo('premium')).toBe(true)
  })

  it('restricts banner to paid plans', () => {
    expect(planAllowsStoreBanner('free')).toBe(false)
    expect(planAllowsStoreBanner('starter')).toBe(true)
    expect(planAllowsStoreBanner('premium')).toBe(true)
  })
})

describe('free plan limits', () => {
  it('exposes PLAN_LIMITS.free as 2 products and 0 images', () => {
    expect(PLAN_LIMITS.free).toEqual({ products: 2, productImages: 0 })
  })

  it('resolves free plan metadata', () => {
    const plan = getPlanById('free')
    expect(plan.id).toBe('free')
    expect(plan.name).toBe('Gratuito')
    expect(plan.priceMonthly).toBe(0)
    expect(plan.priceCooldownHours).toBe(24)
  })

  it('lists free plan features without product images', () => {
    const plan = getPlanById('free')
    expect(plan.features).toContain('Até 2 itens (produtos ou serviços)')
    expect(plan.features).toContain('Sem imagens nos produtos (planos pagos liberam fotos)')
    expect(plan.features.some((f) => /Alteração de preços/i.test(f))).toBe(true)
  })

  it('allows logo but not banner or product images', () => {
    expect(planAllowsStoreLogo('free')).toBe(true)
    expect(planAllowsStoreBanner('free')).toBe(false)
    expect(planAllowsProductImages('free')).toBe(false)
    expect(planAllowsProductImages('starter')).toBe(true)
  })

  it('allows creating only while under 2 catalog items', () => {
    expect(canCreateProduct('free', 0)).toBe(true)
    expect(canCreateProduct('free', 1)).toBe(true)
    expect(canCreateProduct('free', 2)).toBe(false)
    expect(planProductsRemaining('free', 0)).toBe(2)
    expect(planProductsRemaining('free', 1)).toBe(1)
    expect(planProductsRemaining('free', 2)).toBe(0)
  })

  it('never allows product image upload on free', () => {
    expect(canAddProductImage('free', 0)).toBe(false)
    expect(canAddProductImage('free', 0, true)).toBe(false)
    expect(canAddProductImage('free', 5, true)).toBe(false)
    expect(planProductImagesRemaining('free', 0)).toBe(0)
  })

  it('returns free-specific limit messages', () => {
    expect(planProductLimitMessage('free')).toContain('2')
    expect(planProductLimitMessage('free')).toContain('Gratuito')
    expect(planProductImageLimitMessage('free')).toBe(
      'O plano Gratuito não permite imagens nos produtos. Assine um plano pago para enviar fotos no catálogo.',
    )
    expect(FREE_PLAN_BANNER_MESSAGE).toContain('banner personalizado')
  })

  it('formats catalog hint for free merchants', () => {
    expect(formatProductLimitHint('free', 1)).toMatch(/Gratuito: 1\/2/)
    expect(formatProductLimitHint('free', 1)).toMatch(/restam 1/)
    expect(formatProductLimitHint('free', 2)).toMatch(/Gratuito: 2\/2/)
    expect(formatProductLimitHint('free', 2)).not.toMatch(/restam/)
  })

  it('counts products with non-empty image URLs', () => {
    const products = [
      { image: 'https://example.com/a.jpg' },
      { image: '' },
      { image: null },
      { image: '  ' },
    ]
    expect(countProductsWithImages(products)).toBe(1)
  })

  it('renders free plan in info-only cards without payment CTA', () => {
    const html = renderSubscriptionPlanCards({ infoOnly: true })
    expect(html).toContain('Gratuito')
    expect(html).toContain('Até 2 itens (produtos ou serviços)')
    expect(html).toContain('Sem imagens nos produtos')
    expect(html).toContain('Incluso na aprovação do cadastro')
    expect(html).not.toMatch(/Enviar comprovante — Gratuito/)
  })
})

describe('plan catalog limits', () => {
  it('defines product and image limits per plan', () => {
    expect(getPlanProductLimit('free')).toBe(2)
    expect(getPlanProductImageLimit('free')).toBe(0)
    expect(getPlanProductLimit('starter')).toBe(6)
    expect(getPlanProductImageLimit('starter')).toBe(6)
    expect(getPlanProductLimit('plus')).toBe(30)
    expect(getPlanProductImageLimit('plus')).toBe(30)
    expect(getPlanProductLimit('premium')).toBe(80)
    expect(getPlanProductImageLimit('premium')).toBe(80)
  })

  it('blocks product creation at plan cap', () => {
    expect(canCreateProduct('free', 1)).toBe(true)
    expect(canCreateProduct('free', 2)).toBe(false)
    expect(canCreateProduct('premium', 79)).toBe(true)
    expect(canCreateProduct('premium', 80)).toBe(false)
  })

  it('blocks new product images at plan cap', () => {
    expect(canAddProductImage('free', 0)).toBe(false)
    expect(canAddProductImage('free', 0, true)).toBe(false)
    expect(canAddProductImage('starter', 5)).toBe(true)
    expect(canAddProductImage('starter', 6)).toBe(false)
    expect(canAddProductImage('starter', 6, true)).toBe(true)
  })
})

describe('premium store ads limits', () => {
  it('allows ads only on premium with monthly cap of 4', () => {
    expect(planAllowsStoreAds('free')).toBe(false)
    expect(planAllowsStoreAds('starter')).toBe(false)
    expect(planAllowsStoreAds('plus')).toBe(false)
    expect(planAllowsStoreAds('premium')).toBe(true)
    expect(getPlanMonthlyAdLimit('premium')).toBe(4)
    expect(getPlanMonthlyAdLimit('free')).toBe(0)
  })

  it('counts ads created in current month', () => {
    const now = new Date('2026-07-15T12:00:00Z')
    const ads = [
      { created_at: '2026-07-01T10:00:00Z' },
      { created_at: '2026-06-30T10:00:00Z' },
      { created_at: '2026-07-20T10:00:00Z' },
    ]
    expect(countStoreAdsThisMonth(ads, now)).toBe(2)
  })

  it('blocks creation after monthly limit', () => {
    expect(canCreateStoreAd('premium', 0)).toBe(true)
    expect(canCreateStoreAd('premium', 3)).toBe(true)
    expect(canCreateStoreAd('premium', 4)).toBe(false)
    expect(canCreateStoreAd('plus', 0)).toBe(false)
  })

  it('lists premium ads feature and removes expanded ad from plus', () => {
    expect(getPlanById('plus').features).not.toContain('Anúncio ampliado na vitrine principal')
    expect(getPlanById('premium').features).toContain('Até 4 anúncios por mês no feed')
  })

  it('formats monthly ad hint for premium merchants', () => {
    expect(formatStoreAdLimitHint('premium', 2)).toMatch(/2\/4/)
    expect(formatStoreAdLimitHint('premium', 2)).toMatch(/2 restante/)
  })
})

describe('renderSubscriptionPlanCards', () => {
  it('renders public plan buttons', () => {
    const html = renderSubscriptionPlanCards()
    expect(html).toContain('Enviar comprovante — Starter')
    expect(html).not.toContain('Seu plano atual')
  })

  it('hides payment buttons in info-only login mode', () => {
    const html = renderSubscriptionPlanCards({ infoOnly: true })
    expect(html).not.toContain('Enviar comprovante')
    expect(html).toContain('Incluso na aprovação do cadastro')
    expect(html).toContain('Starter')
  })

  it('highlights current plan in dashboard mode', () => {
    const html = renderSubscriptionPlanCards({ currentPlanId: 'starter' })
    expect(html).toContain('plan-card--current')
    expect(html).toContain('Seu plano atual')
    expect(html).toContain('Assinar — Plus')
    expect(html).not.toContain('Assinar — Starter')
  })
})