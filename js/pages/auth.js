/**
 * Páginas de autenticação (cliente, lojista e admin).
 *
 * Três fluxos separados com roles distintos no user_metadata do Supabase.
 * Suporta ?redirect= na URL para voltar à página após login.
 *
 * Melhorias futuras:
 * - Recuperação de senha (resetPasswordForEmail)
 * - Login social (Google, magic link)
 * - Validação de CNPJ/telefone no cadastro de lojista
 */
import { signIn, signUpCustomer } from '../api.js'
import { setUser } from '../state.js'
import { navigate } from '../router.js'
import { escapeHtml } from '../utils.js'

function parseQuery() {
  const hash = window.location.hash
  const q = hash.includes('?') ? hash.split('?')[1] : ''
  return new URLSearchParams(q)
}

function authLayout(title, description, body) {
  return `
    <div class="auth-page">
      <div class="auth-card">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
        <div id="auth-error"></div>
        ${body}
      </div>
    </div>
  `
}

export async function renderCustomerLogin(main) {
  const params = parseQuery()
  const redirect = params.get('redirect') ?? '/favoritos'

  main.innerHTML = authLayout(
    'Minha Conta',
    'Entre para salvar lojas favoritas. Comprar e pedir pelo WhatsApp não exige login.',
    `
      <form id="login-form">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" type="email" name="email" required />
        </div>
        <div class="form-group">
          <label class="form-label">Senha</label>
          <input class="form-input" type="password" name="password" required minlength="6" />
        </div>
        <button type="submit" class="btn btn-primary btn-block">Entrar</button>
      </form>
      <p style="margin-top:1rem;font-size:0.875rem;text-align:center;color:var(--text-secondary)">
        <a href="#/conta/criar">Criar conta gratuita</a>
      </p>
    `
  )

  main.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const errEl = main.querySelector('#auth-error')
    errEl.innerHTML = ''

    try {
      const { data } = await signIn(form.email.value, form.password.value)
      const role = data.user?.user_metadata?.role ?? 'customer'
      if (role !== 'customer') {
        errEl.innerHTML = '<div class="alert alert-error">Use a área do lojista ou admin para esse tipo de conta.</div>'
        return
      }
      const { loadUser } = await import('../state.js')
      await loadUser()
      navigate(redirect.startsWith('/') ? redirect : `/${redirect}`)
    } catch (err) {
      errEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    }
  })
}

export async function renderCustomerRegister(main) {
  main.innerHTML = authLayout(
    'Criar Conta',
    'Cadastre-se para favoritar lojas e agilizar seus pedidos.',
    `
      <form id="register-form">
        <div class="form-group"><label class="form-label">Nome</label><input class="form-input" name="name" required /></div>
        <div class="form-group"><label class="form-label">Email</label><input class="form-input" type="email" name="email" required /></div>
        <div class="form-group"><label class="form-label">Senha</label><input class="form-input" type="password" name="password" required minlength="6" /></div>
        <div class="form-group"><label class="form-label">Telefone</label><input class="form-input" name="phone" required /></div>
        <div class="form-group"><label class="form-label">Endereço</label><textarea class="form-input" name="address" rows="2" required></textarea></div>
        <div class="form-group">
          <label class="form-label">Melhor horário para entrega</label>
          <select class="form-input" name="delivery_period" required>
            <option value="manha">Manhã</option>
            <option value="tarde">Tarde</option>
            <option value="noite">Noite</option>
            <option value="madrugada">Madrugada</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Criar conta</button>
      </form>
      <p style="margin-top:1rem;font-size:0.875rem;text-align:center;color:var(--text-secondary)">
        <a href="#/conta/entrar">Já tenho conta</a>
      </p>
    `
  )

  main.querySelector('#register-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const errEl = main.querySelector('#auth-error')

    try {
      await signUpCustomer({
        email: form.email.value,
        password: form.password.value,
        name: form.name.value,
        phone: form.phone.value,
        address: form.address.value,
        delivery_period: form.delivery_period.value,
      })
      const { loadUser } = await import('../state.js')
      await loadUser()
      navigate('/favoritos')
    } catch (err) {
      errEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    }
  })
}

export async function renderMerchantLogin(main) {
  main.innerHTML = authLayout(
    'Área do Lojista',
    'Gerencie produtos, pedidos e configurações da sua loja.',
    `
      <form id="login-form">
        <div class="form-group"><label class="form-label">Email</label><input class="form-input" type="email" name="email" required /></div>
        <div class="form-group"><label class="form-label">Senha</label><input class="form-input" type="password" name="password" required /></div>
        <button type="submit" class="btn btn-primary btn-block">Entrar</button>
      </form>
      <p style="margin-top:1rem;font-size:0.875rem;text-align:center;color:var(--text-secondary)">
        <a href="#/lojista/cadastro">Cadastrar minha loja</a>
      </p>
    `
  )

  main.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const errEl = main.querySelector('#auth-error')

    try {
      const { data } = await signIn(form.email.value, form.password.value)
      const role = data.user?.user_metadata?.role ?? 'customer'
      if (role !== 'merchant') {
        errEl.innerHTML = '<div class="alert alert-error">Esta conta não é de lojista.</div>'
        return
      }
      const { loadUser } = await import('../state.js')
      await loadUser()
      navigate('/dashboard')
    } catch (err) {
      errEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    }
  })
}

export async function renderAdminLogin(main) {
  main.innerHTML = authLayout(
    'Painel Admin',
    'Acesso restrito a administradores da plataforma.',
    `
      <form id="login-form">
        <div class="form-group"><label class="form-label">Email</label><input class="form-input" type="email" name="email" required /></div>
        <div class="form-group"><label class="form-label">Senha</label><input class="form-input" type="password" name="password" required /></div>
        <button type="submit" class="btn btn-primary btn-block">Entrar</button>
      </form>
      <p style="margin-top:1rem;font-size:0.875rem;text-align:center;color:var(--text-secondary)">
        <button type="button" class="btn btn-outline btn-sm" id="admin-reset-password">Esqueci minha senha</button>
      </p>
    `
  )

  main.querySelector('#admin-reset-password')?.addEventListener('click', async () => {
    const errEl = main.querySelector('#auth-error')
    const email = main.querySelector('#login-form input[name="email"]')?.value?.trim()
    if (!email) {
      errEl.innerHTML = '<div class="alert alert-error">Informe seu email acima primeiro.</div>'
      return
    }
    try {
      const { requestPasswordReset } = await import('../api.js')
      await requestPasswordReset(email)
      errEl.innerHTML = '<div class="alert" style="background:var(--primary-50);color:var(--primary-700);padding:0.75rem;border-radius:var(--radius)">Link de redefinição enviado para seu email.</div>'
    } catch (err) {
      errEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    }
  })

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
        errEl.innerHTML = '<div class="alert alert-error">Acesso negado.</div>'
        return
      }
      navigate('/admin')
    } catch (err) {
      errEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    }
  })
}

export async function renderMerchantRegister(main) {
  const { getUser, loadUser } = await import('../state.js')
  const { signUp, fetchCategories, createStore, fetchStoreByOwner } = await import('../api.js')

  let user = getUser()
  if (!user) {
    main.innerHTML = authLayout(
      'Cadastrar Loja',
      'Primeiro crie sua conta de lojista.',
      `
        <form id="merchant-signup">
          <div class="form-group"><label class="form-label">Nome</label><input class="form-input" name="name" required /></div>
          <div class="form-group"><label class="form-label">Email</label><input class="form-input" type="email" name="email" required /></div>
          <div class="form-group"><label class="form-label">Senha</label><input class="form-input" type="password" name="password" required minlength="6" /></div>
          <button type="submit" class="btn btn-primary btn-block">Criar conta de lojista</button>
        </form>
      `
    )

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

  const categories = await fetchCategories()

  main.innerHTML = authLayout(
    'Cadastrar Loja',
    'Preencha os dados da sua loja. Após envio, aguarde aprovação do admin.',
    `
      <form id="store-form">
        <div class="form-group"><label class="form-label">Nome da loja</label><input class="form-input" name="name" required /></div>
        <div class="form-group"><label class="form-label">Categoria</label>
          <select class="form-input" name="category_id" required>
            ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">WhatsApp (com DDD)</label><input class="form-input" name="whatsapp" required placeholder="11999999999" /></div>
        <div class="form-group"><label class="form-label">Descrição</label><textarea class="form-input" name="description" rows="2"></textarea></div>
        <div class="form-group"><label class="form-label">Endereço</label><input class="form-input" name="address" /></div>
        <div style="display:grid;grid-template-columns:1fr 80px;gap:0.5rem">
          <div class="form-group"><label class="form-label">Cidade</label><input class="form-input" name="city" required /></div>
          <div class="form-group"><label class="form-label">UF</label><input class="form-input" name="state" required maxlength="2" /></div>
        </div>
        <div class="form-group"><label class="form-label">Horário de funcionamento</label><input class="form-input" name="opening_hours" placeholder="Seg-Sex 9h-18h" /></div>
        <button type="submit" class="btn btn-primary btn-block">Enviar cadastro</button>
      </form>
    `
  )

  main.querySelector('#store-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    try {
      await createStore(user.id, {
        name: form.name.value,
        category_id: form.category_id.value,
        whatsapp: form.whatsapp.value,
        description: form.description.value,
        address: form.address.value,
        city: form.city.value,
        state: form.state.value.toUpperCase(),
        opening_hours: form.opening_hours.value,
      })
      main.querySelector('#auth-error').innerHTML = '<div class="alert alert-success">Loja enviada! Aguarde aprovação.</div>'
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (err) {
      main.querySelector('#auth-error').innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`
    }
  })
}