/**
 * Autenticação — login unificado, cadastros e portais staff.
 *
 * Login (/conta/entrar e /lojista/entrar): uma tela para todos os papéis;
 * getPostLoginPath redireciona para favoritos, dashboard, admin ou moderador.
 * Clientes podem usar ?redirect= na URL.
 *
 * Cadastro cliente: birth_date obrigatório (18+), validado aqui, em api.js e no banco.
 * Cadastro lojista: conta merchant + formulário da loja em renderMerchantRegister.
 * Admin/moderador: telas separadas com reset de senha.
 *
 * Regras/planos: painel colapsável em /conta/entrar e /conta/criar (botão Ver regras…).
 *
 * Google OAuth (opcional — requer provider ativo no Supabase):
 * - /conta/entrar → Entrar com Google
 * - /conta/criar → Criar conta com Google (cliente)
 * - /lojista/cadastro → Cadastrar loja com Google (promove a merchant)
 */
import { signIn, signUpCustomer } from '../api.js'
import { setUser } from '../state.js'
import { navigate, getHashSection, routeHref } from '../router.js'
import { escapeHtml, getMaxBirthDateForRegistration, validateRegistrationBirthDate } from '../utils.js'
import { t } from '../strings.js'

const GOOGLE_ICON_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`

function renderGoogleAuthButton(label) {
  return `
    <button type="button" class="btn btn-google btn-block" id="google-auth-btn">
      <span class="btn-google__icon">${GOOGLE_ICON_SVG}</span>
      <span>${escapeHtml(label)}</span>
    </button>
  `
}

function renderAuthDivider(text = 'ou') {
  return `<div class="auth-divider" role="separator"><span>${escapeHtml(text)}</span></div>`
}

function bindPasswordReset(main, buttonId) {
  main.querySelector(`#${buttonId}`)?.addEventListener('click', async () => {
    const errEl = main.querySelector('#auth-error')
    const email = main.querySelector('#login-form input[name="email"]')?.value?.trim()
    if (!email) {
      errEl.innerHTML = `<div class="alert alert-error">${escapeHtml(t('auth.resetEmailFirst'))}</div>`
      return
    }
    try {
      const { requestPasswordReset } = await import('../api.js')
      await requestPasswordReset(email)
      errEl.innerHTML = `<div class="alert" style="background:var(--primary-50);color:var(--primary-700);padding:0.75rem;border-radius:var(--radius)">${escapeHtml(t('auth.resetLinkSent'))}</div>`
    } catch (err) {
      errEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    }
  })
}

function bindGoogleAuth(main, { nextPath = '/favoritos', redirect, role } = {}) {
  const btn = main.querySelector('#google-auth-btn')
  if (!btn) return
  btn.addEventListener('click', async () => {
    const errEl = main.querySelector('#auth-error')
    if (errEl) errEl.innerHTML = ''
    btn.disabled = true
    try {
      const { signInWithGoogle } = await import('../api.js')
      const next = redirect?.startsWith('/') ? redirect : nextPath
      await signInWithGoogle({ nextPath: next, role })
    } catch (err) {
      if (errEl) errEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
      btn.disabled = false
    }
  })
}

function parseQuery() {
  const hash = window.location.hash
  const q = hash.includes('?') ? hash.split('?')[1].split('#')[0] : ''
  return new URLSearchParams(q)
}

function authLayout(title, description, body, { infoPanelHtml = '', infoPanelCollapsed = false } = {}) {
  const hasInfo = Boolean(infoPanelHtml)
  const startCollapsed = hasInfo && infoPanelCollapsed
  const pageClass = hasInfo && !startCollapsed ? 'auth-page auth-page--with-info' : 'auth-page'

  return `
    <div class="${pageClass}" id="auth-page-root">
      <div class="auth-page__login">
        <div class="auth-card">
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(description)}</p>
          <div id="auth-error"></div>
          ${body}
        </div>
      </div>
      ${infoPanelHtml ? `<aside class="auth-page__info" id="auth-page-info"${startCollapsed ? ' hidden' : ''}>${infoPanelHtml}</aside>` : ''}
    </div>
  `
}

function bindRulesPanelToggle(main, { open = false } = {}) {
  const root = main.querySelector('#auth-page-root')
  const panel = main.querySelector('#auth-page-info')
  const btn = main.querySelector('#toggle-rules-panel')
  if (!root || !panel || !btn) return

  const setOpen = (isOpen) => {
    panel.hidden = !isOpen
    root.classList.toggle('auth-page--with-info', isOpen)
    btn.setAttribute('aria-expanded', String(isOpen))
    btn.textContent = isOpen
      ? 'Ocultar regras e planos'
      : 'Ver regras e planos da plataforma'
  }

  setOpen(open)
  btn.addEventListener('click', () => setOpen(panel.hidden))
}

function scrollToAuthSection(main, sectionId) {
  if (!sectionId) return
  requestAnimationFrame(() => {
    const target = main.querySelector(`#${sectionId}`) ?? main.querySelector(`[id="${sectionId}"]`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

const ROLE_HOME = {
  customer: '/favoritos',
  merchant: '/dashboard',
  admin: '/admin',
  moderator: '/moderador',
}

function getPostLoginPath(user, redirect) {
  if (!user) return '/'
  if (user.role === 'customer') {
    if (redirect?.startsWith('/')) return redirect
    return ROLE_HOME.customer
  }
  return ROLE_HOME[user.role] ?? '/'
}

export async function renderLogin(main) {
  const params = parseQuery()
  const redirect = params.get('redirect')
  const { renderRulesAndPlansContent } = await import('../rules-plans-panel.js')

  main.innerHTML = authLayout(
    t('auth.loginTitle'),
    t('auth.loginDescription'),
    `
      ${renderGoogleAuthButton(t('auth.loginWithGoogle'))}
      ${renderAuthDivider(t('auth.dividerOrEmail'))}
      <form id="login-form">
        <div class="form-group">
          <label class="form-label">${t('labels.email')}</label>
          <input class="form-input" type="email" name="email" required />
        </div>
        <div class="form-group">
          <label class="form-label">${t('labels.password')}</label>
          <input class="form-input" type="password" name="password" required minlength="6" />
        </div>
        <button type="submit" class="btn btn-primary btn-block">${t('auth.submitLogin')}</button>
      </form>
      <p class="auth-forgot">
        <button type="button" class="btn btn-outline btn-sm" id="login-reset-password">${t('auth.forgotPassword')}</button>
      </p>
      <div class="auth-links">
        <a href="${routeHref('/conta/criar')}">${t('auth.createCustomerAccount')}</a>
        <a href="${routeHref('/lojista/cadastro')}">${t('auth.registerMyStore')}</a>
        <a href="${routeHref('/admin/entrar')}">${t('auth.adminAccess')}</a>
      </div>
      ${renderRulesToggleButton()}
    `,
    { infoPanelHtml: renderRulesAndPlansContent(), infoPanelCollapsed: true },
  )

  const oauthNext = redirect?.startsWith('/') ? redirect : '/favoritos'
  const rulesSection = getHashSection()
  bindRulesPanelToggle(main, { open: Boolean(rulesSection) })
  bindGoogleAuth(main, { nextPath: oauthNext, redirect })
  bindPasswordReset(main, 'login-reset-password')

  main.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const errEl = main.querySelector('#auth-error')
    errEl.innerHTML = ''

    try {
      await signIn(form.email.value, form.password.value)
      const { loadUser, getUser } = await import('../state.js')
      await loadUser()
      const user = getUser()
      if (!user) throw new Error('Não foi possível carregar sua conta.')
      navigate(getPostLoginPath(user, redirect))
    } catch (err) {
      errEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    }
  })

  scrollToAuthSection(main, rulesSection)
}

export const renderCustomerLogin = renderLogin

function renderRulesToggleButton() {
  return `
    <p class="auth-rules-toggle">
      <button type="button" class="btn btn-outline btn-sm btn-block" id="toggle-rules-panel" aria-expanded="false" aria-controls="auth-page-info">
        Ver regras e planos da plataforma
      </button>
    </p>
  `
}

export async function renderCustomerRegister(main) {
  const { renderRulesAndPlansContent } = await import('../rules-plans-panel.js')

  main.innerHTML = authLayout(
    t('auth.registerTitle'),
    t('auth.registerDescription'),
    `
      ${renderGoogleAuthButton(t('auth.registerWithGoogle'))}
      <p class="form-hint form-hint--center">Rápido e seguro — sua conta será de cliente.</p>
      ${renderAuthDivider(t('auth.dividerOrForm'))}
      <form id="register-form">
        <div class="form-group"><label class="form-label">${t('labels.name')}</label><input class="form-input" name="name" required /></div>
        <div class="form-group"><label class="form-label">${t('labels.email')}</label><input class="form-input" type="email" name="email" required /></div>
        <div class="form-group"><label class="form-label">${t('labels.password')}</label><input class="form-input" type="password" name="password" required minlength="6" /></div>
        <div class="form-group">
          <label class="form-label">${t('labels.birthDate')}</label>
          <input class="form-input" type="date" name="birth_date" required max="${getMaxBirthDateForRegistration()}" />
          <p class="form-hint">${t('errors.minAgeRegistration')}</p>
        </div>
        <div class="form-group"><label class="form-label">${t('labels.phone')}</label><input class="form-input" name="phone" required /></div>
        <div class="form-group"><label class="form-label">${t('labels.address')}</label><textarea class="form-input" name="address" rows="2" required></textarea></div>
        <div class="form-group">
          <label class="form-label">Melhor horário para entrega</label>
          <select class="form-input" name="delivery_period" required>
            <option value="manha">Manhã</option>
            <option value="tarde">Tarde</option>
            <option value="noite">Noite</option>
            <option value="madrugada">Madrugada</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary btn-block">${t('auth.submitRegister')}</button>
      </form>
      <p style="margin-top:1rem;font-size:0.875rem;text-align:center;color:var(--text-secondary)">
        <a href="${routeHref('/conta/entrar')}">${t('auth.alreadyHaveAccount')}</a>
      </p>
      ${renderRulesToggleButton()}
    `,
    { infoPanelHtml: renderRulesAndPlansContent(), infoPanelCollapsed: true },
  )

  const rulesSection = getHashSection()
  bindRulesPanelToggle(main, { open: Boolean(rulesSection) })
  bindGoogleAuth(main, { nextPath: '/favoritos' })
  scrollToAuthSection(main, rulesSection)

  main.querySelector('#register-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const errEl = main.querySelector('#auth-error')

    try {
      const birthCheck = validateRegistrationBirthDate(form.birth_date.value)
      if (!birthCheck.ok) throw new Error(birthCheck.message)

      await signUpCustomer({
        email: form.email.value,
        password: form.password.value,
        name: form.name.value,
        phone: form.phone.value,
        address: form.address.value,
        delivery_period: form.delivery_period.value,
        birth_date: birthCheck.birthDate,
      })
      const { loadUser } = await import('../state.js')
      await loadUser()
      navigate('/favoritos')
    } catch (err) {
      errEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    }
  })
}

export const renderMerchantLogin = renderLogin

export async function renderAdminLogin(main) {
  main.innerHTML = authLayout(
    t('auth.adminLoginTitle'),
    t('auth.adminLoginDescription'),
    `
      <form id="login-form">
        <div class="form-group"><label class="form-label">${t('labels.email')}</label><input class="form-input" type="email" name="email" required /></div>
        <div class="form-group"><label class="form-label">${t('labels.password')}</label><input class="form-input" type="password" name="password" required /></div>
        <button type="submit" class="btn btn-primary btn-block">${t('auth.submitLogin')}</button>
      </form>
      <p style="margin-top:1rem;font-size:0.875rem;text-align:center;color:var(--text-secondary)">
        <button type="button" class="btn btn-outline btn-sm" id="admin-reset-password">${t('auth.forgotPassword')}</button>
      </p>
      <p style="margin-top:0.75rem;font-size:0.8125rem;text-align:center;color:var(--text-muted)">
        <a href="${routeHref('/moderador/entrar')}">${t('auth.moderatorAccess')}</a>
      </p>
    `
  )

  bindPasswordReset(main, 'admin-reset-password')

  main.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const errEl = main.querySelector('#auth-error')

    try {
      await signIn(form.email.value, form.password.value)
      const { loadUser, getUser } = await import('../state.js')
      await loadUser()
      if (getUser()?.role !== 'admin') {
        const { logout } = await import('../state.js')
        await logout()
        errEl.innerHTML = `<div class="alert alert-error">${escapeHtml(t('auth.accessDenied'))}</div>`
        return
      }
      navigate('/admin')
    } catch (err) {
      errEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    }
  })
}

export async function renderModeratorLogin(main) {
  main.innerHTML = authLayout(
    t('auth.moderatorLoginTitle'),
    t('auth.moderatorLoginDescription'),
    `
      <form id="login-form">
        <div class="form-group"><label class="form-label">${t('labels.email')}</label><input class="form-input" type="email" name="email" required /></div>
        <div class="form-group"><label class="form-label">${t('labels.password')}</label><input class="form-input" type="password" name="password" required /></div>
        <button type="submit" class="btn btn-primary btn-block">${t('auth.submitLogin')}</button>
      </form>
      <p style="margin-top:1rem;font-size:0.875rem;text-align:center;color:var(--text-secondary)">
        <button type="button" class="btn btn-outline btn-sm" id="moderator-reset-password">${t('auth.forgotPassword')}</button>
      </p>
      <p style="margin-top:0.75rem;font-size:0.8125rem;text-align:center;color:var(--text-muted)">
        <a href="${routeHref('/admin/entrar')}">${t('auth.adminAccess')}</a>
      </p>
    `
  )

  bindPasswordReset(main, 'moderator-reset-password')

  main.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const errEl = main.querySelector('#auth-error')

    try {
      await signIn(form.email.value, form.password.value)
      const { loadUser, getUser } = await import('../state.js')
      await loadUser()
      if (getUser()?.role !== 'moderator') {
        const { logout } = await import('../state.js')
        await logout()
        errEl.innerHTML = `<div class="alert alert-error">${escapeHtml(t('auth.accessDenied'))}</div>`
        return
      }
      navigate('/moderador')
    } catch (err) {
      errEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    }
  })
}

export async function renderMerchantRegister(main) {
  const { getUser, loadUser } = await import('../state.js')
  const { signUp, fetchCategories, fetchNeighborhoods, createStore, fetchStoreByOwner } = await import('../api.js')

  let user = getUser()
  if (!user) {
    main.innerHTML = authLayout(
      t('auth.registerStoreTitle'),
      t('auth.registerStoreAccountFirst'),
      `
        ${renderGoogleAuthButton(t('auth.registerStoreWithGoogle'))}
        <p class="form-hint form-hint--center">Conta de lojista — em seguida você preenche os dados da loja.</p>
        ${renderAuthDivider(t('auth.dividerOrForm'))}
        <form id="merchant-signup">
          <div class="form-group"><label class="form-label">${t('labels.name')}</label><input class="form-input" name="name" required /></div>
          <div class="form-group"><label class="form-label">${t('labels.email')}</label><input class="form-input" type="email" name="email" required /></div>
          <div class="form-group"><label class="form-label">${t('labels.password')}</label><input class="form-input" type="password" name="password" required minlength="6" /></div>
          <button type="submit" class="btn btn-primary btn-block">${t('auth.createMerchantAccount')}</button>
        </form>
      `
    )

    bindGoogleAuth(main, { nextPath: '/lojista/cadastro', role: 'merchant' })

    main.querySelector('#merchant-signup').addEventListener('submit', async (e) => {
      e.preventDefault()
      const form = e.target
      try {
        await signUp(form.email.value, form.password.value, form.name.value, 'merchant')
        await loadUser()
        renderMerchantRegister(main)
      } catch (err) {
        main.querySelector('#auth-error').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
      }
    })
    return
  }

  if (user.role !== 'merchant') {
    main.innerHTML = '<div class="empty-state"><h2>Acesso negado</h2><p>Conta não é de lojista.</p></div>'
    return
  }

  const existing = await fetchStoreByOwner(user.id)
  if (existing) {
    main.innerHTML = `<div class="empty-state"><h2>Você já tem uma loja</h2><p>Status: ${existing.status}</p><a href="#/dashboard" class="btn btn-primary">Ir ao painel</a></div>`
    return
  }

  const [categories, neighborhoods] = await Promise.all([
    fetchCategories(),
    fetchNeighborhoods(),
  ])

  main.innerHTML = authLayout(
    t('auth.registerStoreTitle'),
    t('auth.registerStoreFormDescription'),
    `
      <form id="store-form">
        <div class="form-group"><label class="form-label">${t('auth.storeName')}</label><input class="form-input" name="name" required /></div>
        <div class="form-group"><label class="form-label">${t('auth.neighborhoodRegion')}</label>
          <select class="form-input" name="neighborhood_id" required>
            <option value="">${t('app.selectPlaceholder')}</option>
            ${neighborhoods.map((n) => `<option value="${n.id}">${escapeHtml(n.name)} · ${escapeHtml(n.city)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">${t('labels.category')}</label>
          <select class="form-input" name="category_id" required>
            ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">WhatsApp (com DDD)</label><input class="form-input" name="whatsapp" required placeholder="11999999999" /></div>
        <div class="form-group"><label class="form-label">${t('labels.description')}</label><textarea class="form-input" name="description" rows="2"></textarea></div>
        <div class="form-group"><label class="form-label">${t('labels.address')}</label><input class="form-input" name="address" /></div>
        <div style="display:grid;grid-template-columns:1fr 80px;gap:0.5rem">
          <div class="form-group"><label class="form-label">${t('labels.city')}</label><input class="form-input" name="city" required /></div>
          <div class="form-group"><label class="form-label">${t('labels.state')}</label><input class="form-input" name="state" required maxlength="2" /></div>
        </div>
        <div class="form-group"><label class="form-label">Horário de funcionamento</label><input class="form-input" name="opening_hours" placeholder="Seg-Sex 9h-18h" /></div>
        <button type="submit" class="btn btn-primary btn-block">${t('auth.submitStoreRegistration')}</button>
      </form>
    `
  )

  main.querySelector('#store-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    try {
      await createStore(user.id, {
        name: form.name.value,
        neighborhood_id: form.neighborhood_id.value,
        category_id: form.category_id.value,
        whatsapp: form.whatsapp.value,
        description: form.description.value,
        address: form.address.value,
        city: form.city.value,
        state: form.state.value.toUpperCase(),
        opening_hours: form.opening_hours.value,
      })
      main.querySelector('#auth-error').innerHTML = `<div class="alert alert-success">${escapeHtml(t('auth.storeSubmittedSuccess'))}</div>`
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (err) {
      main.querySelector('#auth-error').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    }
  })
}