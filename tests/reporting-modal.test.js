/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const submitStoreReport = vi.fn()
const submitProductReport = vi.fn()
const getCurrentUser = vi.fn(async () => ({ id: 'user-1', role: 'customer' }))

vi.mock('../js/api.js', () => ({
  submitStoreReport,
  submitProductReport,
  getCurrentUser,
}))

vi.mock('../js/router.js', () => ({
  navigate: vi.fn(),
}))

vi.mock('../js/state.js', () => ({
  getUser: vi.fn(() => ({ id: 'user-1', role: 'customer' })),
}))

describe('report modal', () => {
  beforeEach(async () => {
    vi.resetModules()
    document.body.innerHTML = ''
    submitStoreReport.mockReset()
    submitProductReport.mockReset()
    getCurrentUser.mockResolvedValue({ id: 'user-1', role: 'customer' })
  })

  async function loadReporting() {
    return import('../js/reporting.js')
  }

  it('opens and closes via cancel, close button and backdrop', async () => {
    const { openReportModal, closeReportModal, bindReportTriggers } = await loadReporting()
    bindReportTriggers(document.body)

    openReportModal({
      type: 'product',
      userId: 'user-1',
      productId: 'product-1',
      targetLabel: 'Camiseta',
    })

    const modal = document.getElementById('report-modal')
    expect(modal.classList.contains('report-modal--open')).toBe(true)

    closeReportModal()
    expect(modal.classList.contains('report-modal--open')).toBe(false)
    expect(modal.hidden).toBe(true)

    openReportModal({
      type: 'product',
      userId: 'user-1',
      productId: 'product-1',
      targetLabel: 'Camiseta',
    })

    document.querySelector('[data-report-close].report-modal__close').click()
    expect(modal.classList.contains('report-modal--open')).toBe(false)

    openReportModal({
      type: 'product',
      userId: 'user-1',
      productId: 'product-1',
      targetLabel: 'Camiseta',
    })

    document.querySelector('.report-modal__backdrop').click()
    expect(modal.classList.contains('report-modal--open')).toBe(false)

    openReportModal({
      type: 'product',
      userId: 'user-1',
      productId: 'product-1',
      targetLabel: 'Camiseta',
    })

    document.querySelector('[data-report-close].btn-outline').click()
    expect(modal.classList.contains('report-modal--open')).toBe(false)
  })

  it('submits product report to API with reason and comment', async () => {
    const { openReportModal, bindReportTriggers } = await loadReporting()
    bindReportTriggers(document.body)

    openReportModal({
      type: 'product',
      userId: 'user-1',
      productId: 'product-1',
      targetLabel: 'Camiseta',
    })

    const form = document.getElementById('report-modal-form')
    form.querySelector('input[name="reason"][value="scam"]').checked = true
    form.details.value = 'Preço muito abaixo do mercado, parece golpe'

    form.requestSubmit()

    await vi.waitFor(() => {
      expect(submitProductReport).toHaveBeenCalledWith(
        'user-1',
        'product-1',
        'scam',
        'Preço muito abaixo do mercado, parece golpe',
      )
    })

    expect(document.getElementById('report-modal').classList.contains('report-modal--open')).toBe(false)
  })

  it('opens modal when clicking a rendered report button', async () => {
    const { renderReportButton, bindReportTriggers } = await loadReporting()
    bindReportTriggers(document.body)

    const host = document.createElement('div')
    host.innerHTML = renderReportButton({
      type: 'product',
      id: 'product-9',
      name: 'Tênis',
      user: { id: 'user-1', role: 'customer' },
      storeOwnerId: 'other-owner',
      product: { id: 'product-9', store: { owner_id: 'other-owner' } },
      variant: 'overlay',
    })
    document.body.appendChild(host)

    host.querySelector('.report-btn').click()

    const modal = document.getElementById('report-modal')
    expect(modal.classList.contains('report-modal--open')).toBe(true)
    expect(modal.querySelector('[data-report-target]').textContent).toMatch(/Tênis/)
  })
})