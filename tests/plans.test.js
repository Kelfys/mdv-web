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
  getStorePublicBanner,
  stripStoreBannerIfPlanDisallows,
  planAllowsStoreAds,
  getPlanMonthlyAdLimit,
  countStoreAdsThisMonth,
  canCreateStoreAd,
  canCreateIncludedStoreAd,
  canCreateExtraStoreAd,
  isExtraStoreAdSlot,
  formatStoreAdLimitHint,
  renderSubscriptionPlanCards,
  buildPlanPaymentUrl,
  buildPlanRequestStoreNote,
} from '../js/plans.js'

describe('plan price cooldown', () => {
  it('returns hours per plan', () => {
    expect(getPlanPriceCooldownHours('free')).toBe(24)
    expect(getPlanPriceCooldownHours('plus')).toBe(12)
    expect(getPlanPriceCooldownHours('premium')).toBe(6)
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
    expect(getPlanById('plus').name).toBe('Plus')
    expect(getPlanById('plus').priceMonthly).toBe(2.99)
    expect(getPlanById('premium').name).toBe('Premium')
    expect(getPlanById('premium').priceMonthly).toBe(20)
  })

  it('lists plus plan features with 6-item catalog', () => {
    const plan = getPlanById('plus')
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
    expect(planAllowsStoreBanner('plus')).toBe(true)
    expect(planAllowsStoreBanner('premium')).toBe(true)
  })

  it('hides banner URL on free plan even if stored in database', () => {
    expect(getStorePublicBanner({ plan_id: 'free', banner: 'https://cdn.example/b.jpg' })).toBeNull()
    expect(getStorePublicBanner({ plan_id: 'plus', banner: 'https://cdn.example/b.jpg' })).toBe('https://cdn.example/b.jpg')
    expect(getStorePublicBanner({ plan_id: 'premium', banner: null })).toBeNull()
    expect(getStorePublicBanner(null)).toBeNull()
  })

  it('stripStoreBannerIfPlanDisallows nulls banner only on free', () => {
    expect(stripStoreBannerIfPlanDisallows({ plan_id: 'free', banner: 'https://x/b.jpg', name: 'A' }))
      .toEqual({ plan_id: 'free', banner: null, name: 'A' })
    expect(stripStoreBannerIfPlanDisallows({ plan_id: 'plus', banner: 'https://x/b.jpg' }).banner)
      .toBe('https://x/b.jpg')
  })
})

describe('free plan limits', () => {
  it('exposes PLAN_LIMITS.free as 1 product and 1 image', () => {
    expect(PLAN_LIMITS.free).toEqual({ products: 1, productImages: 1 })
  })

  it('resolves free plan metadata', () => {
    const plan = getPlanById('free')
    expect(plan.id).toBe('free')
    expect(plan.name).toBe('Gratuito')
    expect(plan.priceMonthly).toBe(0)
    expect(plan.priceCooldownHours).toBe(24)
  })

  it('lists free plan features with one item and one catalog image', () => {
    const plan = getPlanById('free')
    expect(plan.features).toContain('1 item no catálogo (produto ou serviço)')
    expect(plan.features).toContain('1 foto no catálogo')
    expect(plan.features.some((f) => /Alteração de preços/i.test(f))).toBe(true)
  })

  it('allows logo and one product image but not banner', () => {
    expect(planAllowsStoreLogo('free')).toBe(true)
    expect(planAllowsStoreBanner('free')).toBe(false)
    expect(planAllowsProductImages('free')).toBe(true)
    expect(planAllowsProductImages('plus')).toBe(true)
  })

  it('allows creating only while under 1 catalog item', () => {
    expect(canCreateProduct('free', 0)).toBe(true)
    expect(canCreateProduct('free', 1)).toBe(false)
    expect(planProductsRemaining('free', 0)).toBe(1)
    expect(planProductsRemaining('free', 1)).toBe(0)
  })

  it('allows one product image on free', () => {
    expect(canAddProductImage('free', 0)).toBe(true)
    expect(canAddProductImage('free', 0, true)).toBe(true)
    expect(canAddProductImage('free', 1)).toBe(false)
    expect(canAddProductImage('free', 1, true)).toBe(true)
    expect(planProductImagesRemaining('free', 0)).toBe(1)
    expect(planProductImagesRemaining('free', 1)).toBe(0)
  })

  it('returns free-specific limit messages', () => {
    expect(planProductLimitMessage('free')).toContain('1')
    expect(planProductLimitMessage('free')).toContain('Gratuito')
    expect(planProductImageLimitMessage('free')).toBe(
      'O plano Gratuito permite imagens em até 1 produto(s). Assine um plano superior para liberar mais.',
    )
    expect(FREE_PLAN_BANNER_MESSAGE).toContain('banner personalizado')
  })

  it('formats catalog hint for free merchants', () => {
    expect(formatProductLimitHint('free', 0)).toMatch(/Gratuito: 0\/1/)
    expect(formatProductLimitHint('free', 0)).toMatch(/restam 1/)
    expect(formatProductLimitHint('free', 1)).toMatch(/Gratuito: 1\/1/)
    expect(formatProductLimitHint('free', 1)).not.toMatch(/restam/)
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
    expect(html).toContain('1 item no catálogo (produto ou serviço)')
    expect(html).toContain('1 foto no catálogo')
    expect(html).toContain('Incluso na aprovação do cadastro')
    expect(html).not.toMatch(/Enviar comprovante — Gratuito/)
  })
})

describe('plan catalog limits', () => {
  it('defines product and image limits per plan', () => {
    expect(getPlanProductLimit('free')).toBe(1)
    expect(getPlanProductImageLimit('free')).toBe(1)
    expect(getPlanProductLimit('plus')).toBe(6)
    expect(getPlanProductImageLimit('plus')).toBe(6)
    expect(getPlanProductLimit('premium')).toBe(30)
    expect(getPlanProductImageLimit('premium')).toBe(30)
  })

  it('blocks product creation at plan cap', () => {
    expect(canCreateProduct('free', 0)).toBe(true)
    expect(canCreateProduct('free', 1)).toBe(false)
    expect(canCreateProduct('premium', 29)).toBe(true)
    expect(canCreateProduct('premium', 30)).toBe(false)
  })

  it('blocks new product images at plan cap', () => {
    expect(canAddProductImage('free', 0)).toBe(true)
    expect(canAddProductImage('free', 1)).toBe(false)
    expect(canAddProductImage('free', 1, true)).toBe(true)
    expect(canAddProductImage('plus', 5)).toBe(true)
    expect(canAddProductImage('plus', 6)).toBe(false)
    expect(canAddProductImage('plus', 6, true)).toBe(true)
  })
})

describe('premium store ads limits', () => {
  it('allows ads only on premium with monthly cap of 2', () => {
    expect(planAllowsStoreAds('free')).toBe(false)
    expect(planAllowsStoreAds('plus')).toBe(false)
    expect(planAllowsStoreAds('premium')).toBe(true)
    expect(getPlanMonthlyAdLimit('premium')).toBe(2)
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

  it('allows included ads under limit and extra ads beyond it', () => {
    expect(canCreateIncludedStoreAd('premium', 0)).toBe(true)
    expect(canCreateIncludedStoreAd('premium', 1)).toBe(true)
    expect(canCreateIncludedStoreAd('premium', 2)).toBe(false)
    expect(isExtraStoreAdSlot('premium', 2)).toBe(true)
    expect(canCreateExtraStoreAd('premium')).toBe(true)
    expect(canCreateExtraStoreAd('plus')).toBe(false)
    expect(canCreateStoreAd('premium', 2)).toBe(true)
  })

  it('lists premium ads feature on premium only', () => {
    expect(getPlanById('plus').features).not.toContain('Até 2 anúncios por mês na aba Anúncios')
    expect(getPlanById('premium').features).toContain('Até 30 itens (produtos ou serviços)')
    expect(getPlanById('premium').features).toContain('Imagens em todos os produtos (500 KB cada)')
    expect(getPlanById('premium').features).toContain('Até 2 anúncios por mês na aba Anúncios')
    expect(getPlanById('premium').features).toContain('Ativar ou ocultar produtos à venda')
    expect(getPlanById('premium').features).toContain('Rotação de prioridade no feed a cada 24h')
  })

  it('formats monthly ad hint for premium merchants', () => {
    expect(formatStoreAdLimitHint('premium', 1)).toMatch(/1\/2/)
    expect(formatStoreAdLimitHint('premium', 1)).toMatch(/1 restante/)
  })
})

describe('renderSubscriptionPlanCards', () => {
  it('renders public plan buttons', () => {
    const html = renderSubscriptionPlanCards()
    expect(html).toContain('Enviar comprovante — Plus')
    expect(html).not.toContain('Seu plano atual')
  })

  it('hides payment buttons in info-only login mode', () => {
    const html = renderSubscriptionPlanCards({ infoOnly: true })
    expect(html).not.toContain('Enviar comprovante')
    expect(html).toContain('Incluso na aprovação do cadastro')
    expect(html).toContain('Plus')
  })

  it('highlights current plan in dashboard mode', () => {
    const html = renderSubscriptionPlanCards({ currentPlanId: 'plus' })
    expect(html).toContain('plan-card--current')
    expect(html).toContain('Seu plano atual')
    expect(html).toContain('Assinar — Premium')
    expect(html).not.toContain('Assinar — Plus')
  })

  it('includes store id and name in dashboard whatsapp payment link', () => {
    const plan = getPlanById('plus')
    const url = buildPlanPaymentUrl(plan, { storeId: 'store-abc-123', storeName: 'Loja Teste' })
    const text = decodeURIComponent(url.split('text=')[1])
    expect(text).toContain('Loja Teste')
    expect(text).toContain('store-abc-123')
    expect(text).toContain('da loja *Loja Teste*')
    expect(url).toContain(encodeURIComponent('store-abc-123'))
    expect(url).toContain(encodeURIComponent('Loja Teste'))
    const html = renderSubscriptionPlanCards({
      currentPlanId: 'free',
      requestMode: true,
      store: { id: 'store-abc-123', name: 'Loja Teste' },
    })
    expect(html).toContain(encodeURIComponent('store-abc-123'))
    expect(html).toContain(encodeURIComponent('Loja Teste'))
  })

  it('builds default plan request note with store name and id', () => {
    expect(buildPlanRequestStoreNote({ storeId: 'store-xyz', storeName: 'Minha Loja' }))
      .toMatch(/Minha Loja/)
    expect(buildPlanRequestStoreNote({ storeId: 'store-xyz', storeName: 'Minha Loja' }))
      .toMatch(/store-xyz/)
  })
})