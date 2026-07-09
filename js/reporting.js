/**
 * Denúncias de lojas e produtos — modal e motivos.
 */
import { submitStoreReport, submitProductReport, getCurrentUser } from './api.js'
import { navigate } from './router.js'
import {
  canReportStore, canReportProduct, canSubmitContentReport, getReportLoginPath,
} from './report-permissions.js'
import { escapeHtml, showToast } from './utils.js'
import { getUser } from './state.js'
import { t } from './strings.js'
import { REPORT_REASONS } from './report-reasons.js'

export {
  canReportStore, canReportProduct, canSubmitContentReport, getReportLoginPath,
} from './report-permissions.js'
export { REPORT_REASONS, getReportReasonLabel } from './report-reasons.js'

const MODAL_ID = 'report-modal'
const OPEN_CLASS = 'report-modal--open'
let reportUiReady = false
let activePayload = null

function reasonOptionsHtml() {
  return REPORT_REASONS.map((reason) => `
    <label class="report-reason">
      <input type="radio" name="reason" value="${reason.id}" required />
      <span class="report-reason__label">${escapeHtml(reason.label())}</span>
    </label>
  `).join('')
}

function getReportRedirectPath() {
  const raw = (window.location.hash || '#/').replace(/^#/, '')
  return raw.startsWith('/') ? raw : `/${raw}`
}

function readSelectedReason(form) {
  return form.querySelector('input[name="reason"]:checked')?.value ?? ''
}

function mountReportModal() {
  if (document.getElementById(MODAL_ID)) return

  document.body.insertAdjacentHTML('beforeend', `
    <div class="report-modal" id="${MODAL_ID}" hidden aria-hidden="true">
      <div class="report-modal__backdrop" data-report-close></div>
      <div class="report-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
        <div class="report-modal__head">
          <h2 id="report-modal-title">${t('report.title')}</h2>
          <button type="button" class="report-modal__close" data-report-close aria-label="${t('labels.close')}">✕</button>
        </div>
        <p class="report-modal__target" data-report-target></p>
        <form class="report-modal__form" id="report-modal-form">
          <fieldset class="report-reasons">
            <legend class="form-label">${t('report.reasonLabel')}</legend>
            <div class="report-reasons__list">
              ${reasonOptionsHtml()}
            </div>
          </fieldset>
          <div class="form-group">
            <label class="form-label" for="report-details">${t('report.detailsLabel')}</label>
            <textarea class="form-input" id="report-details" name="details" rows="4" maxlength="500" required placeholder="${t('report.detailsPlaceholder')}"></textarea>
            <p class="form-hint">${t('report.detailsHint')}</p>
          </div>
          <div class="report-modal__actions">
            <button type="button" class="btn btn-outline" data-report-close>${t('labels.cancel')}</button>
            <button type="submit" class="btn btn-primary">${t('report.submit')}</button>
          </div>
        </form>
      </div>
    </div>
  `)
}

function isReportModalOpen() {
  const modal = document.getElementById(MODAL_ID)
  return Boolean(modal?.classList.contains(OPEN_CLASS))
}

async function handleReportSubmit(event) {
  event.preventDefault()
  const form = event.currentTarget
  const payload = activePayload
  if (!payload) return

  const reason = readSelectedReason(form)
  const details = form.details.value.trim()

  if (!reason) {
    showToast(t('errors.reportReasonRequired'))
    return
  }
  if (!details) {
    showToast(t('errors.reportDetailsRequired'))
    form.details.focus()
    return
  }

  const submitBtn = form.querySelector('button[type="submit"]')
  if (submitBtn) {
    submitBtn.disabled = true
    submitBtn.textContent = t('checkout.submitting')
  }

  try {
    const sessionUser = await getCurrentUser()
    if (!sessionUser?.id || !canSubmitContentReport(sessionUser)) {
      closeReportModal()
      navigate(getReportLoginPath(sessionUser, getReportRedirectPath()))
      showToast(t('report.loginRequired'))
      return
    }

    if (payload.type === 'store') {
      await submitStoreReport(sessionUser.id, payload.storeId, reason, details)
    } else {
      await submitProductReport(sessionUser.id, payload.productId, reason, details)
    }

    closeReportModal()
    showToast(t('report.submitted'))
    payload.onSuccess?.()
  } catch (err) {
    showToast(err.message ?? t('report.submitError'))
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false
      submitBtn.textContent = t('report.submit')
    }
  }
}

function handleDocumentClick(event) {
  const closeEl = event.target.closest('[data-report-close]')
  if (closeEl && isReportModalOpen()) {
    event.preventDefault()
    event.stopPropagation()
    closeReportModal()
    return
  }

  const trigger = event.target.closest('[data-report-store], [data-report-product]')
  if (!trigger) return

  event.preventDefault()
  event.stopPropagation()

  const user = getUser()
  const redirectPath = trigger.dataset.reportRedirect || getReportRedirectPath()

  if (!canSubmitContentReport(user)) {
    navigate(getReportLoginPath(user, redirectPath))
    showToast(t('report.loginRequired'))
    return
  }

  if (trigger.dataset.reportStore) {
    openReportModal({
      type: 'store',
      userId: user.id,
      storeId: trigger.dataset.reportStore,
      targetLabel: trigger.dataset.reportStoreName ?? '',
    })
    return
  }

  openReportModal({
    type: 'product',
    userId: user.id,
    productId: trigger.dataset.reportProduct,
    targetLabel: trigger.dataset.reportProductName ?? '',
  })
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape' && isReportModalOpen()) {
    event.preventDefault()
    closeReportModal()
  }
}

function ensureReportUi() {
  mountReportModal()
  if (reportUiReady) return
  reportUiReady = true

  const form = document.getElementById('report-modal-form')
  form?.addEventListener('submit', handleReportSubmit)
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleDocumentKeydown)
}

export function closeReportModal() {
  const modal = document.getElementById(MODAL_ID)
  if (!modal) return

  modal.classList.remove(OPEN_CLASS)
  modal.hidden = true
  modal.setAttribute('aria-hidden', 'true')
  document.body.classList.remove('report-modal-open')

  const form = document.getElementById('report-modal-form')
  if (form) {
    form.reset()
  }
  activePayload = null
}

export function openReportModal({
  type,
  userId,
  storeId = null,
  productId = null,
  targetLabel = '',
  onSuccess = null,
} = {}) {
  ensureReportUi()

  const modal = document.getElementById(MODAL_ID)
  if (!modal) return
  const form = document.getElementById('report-modal-form')
  const targetEl = modal.querySelector('[data-report-target]')

  activePayload = { type, userId, storeId, productId, onSuccess }
  if (targetEl) {
    targetEl.textContent = type === 'store'
      ? t('report.targetStore', { name: targetLabel })
      : t('report.targetProduct', { name: targetLabel })
  }

  form?.reset()
  modal.hidden = false
  modal.classList.add(OPEN_CLASS)
  modal.setAttribute('aria-hidden', 'false')
  document.body.classList.add('report-modal-open')

  const firstReason = form?.querySelector('input[name="reason"]')
  if (firstReason) firstReason.focus()
  else form?.details?.focus()
}

/** Compat: delegação global já cobre os botões; só garante que o modal existe. */
export function bindReportTriggers(_root, _options = {}) {
  ensureReportUi()
}

export function renderReportButton({
  type,
  id,
  name,
  user,
  storeOwnerId = null,
  store = null,
  product = null,
  variant = 'toolbar',
} = {}) {
  if (type === 'store' && !canReportStore(user, store ?? { id, owner_id: storeOwnerId })) return ''
  if (type === 'product' && !canReportProduct(user, product ?? { id }, storeOwnerId)) return ''

  const attrs = type === 'store'
    ? `data-report-store="${id}" data-report-store-name="${escapeHtml(name)}"`
    : `data-report-product="${id}" data-report-product-name="${escapeHtml(name)}"`

  const label = t('report.button')
  const title = `${label}${name ? `: ${name}` : ''}`

  if (variant === 'overlay') {
    return `
      <button type="button" class="report-btn report-btn--overlay" ${attrs} title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">
        <span aria-hidden="true">⚑</span>
      </button>
    `
  }

  if (variant === 'link') {
    return `
      <button type="button" class="report-btn report-btn--link" ${attrs} title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">
        ${label}
      </button>
    `
  }

  return `
    <button type="button" class="btn btn-outline btn-sm report-btn report-btn--toolbar" ${attrs} title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">
      <span aria-hidden="true">⚑</span> ${label}
    </button>
  `
}