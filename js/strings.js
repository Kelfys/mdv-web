/**
 * Textos estáticos da interface — edite em strings-editor.html
 * Uso: import { t } from './strings.js'  →  t('nav.home')
 */

export const STRINGS = {
  "app": {
    "name": "MaredeVendas",
    "nameAccent": "Vendas",
    "pageTitle": "MaredeVendas — Marketplace Local",
    "metaDescription": "Marketplace de lojas locais. Encontre produtos perto de você e peça direto pelo WhatsApp.",
    "loadErrorTitle": "Erro ao carregar",
    "loadErrorBody": "Tente abrir a página inicial e navegar pelo menu.",
    "loadErrorHomeLink": "página inicial",
    "selectPlaceholder": "Selecione...",
    "sponsored": "Patrocinado",
    "freePlanPrice": "Grátis",
    "perMonth": "/mês",
    "noImage": "Sem imagem",
    "dashPlaceholder": "—"
  },
  "nav": {
    "home": "Início",
    "login": "Entrar",
    "logout": "Sair",
    "myAccount": "👤 Minha conta",
    "backToSite": "← Voltar ao site",
    "toggleTheme": "Alternar tema",
    "openMenu": "☰",
    "closeMenu": "✕",
    "refresh": "↻ Atualizar",
    "staffOverview": "Visão Geral",
    "staffStores": "Lojas",
    "staffProducts": "Produtos",
    "staffOrders": "Pedidos",
    "staffApprovals": "Aprovações",
    "staffNeighborhoods": "Bairros",
    "staffModerators": "Moderadores",
    "staffAccount": "Minha Conta",
    "merchantCatalog": "Catálogo",
    "merchantAds": "Anúncios",
    "merchantPlans": "Planos",
    "merchantSettings": "Configurações",
    "customerOverview": "Início",
    "customerFavorites": "Favoritos",
    "customerLiked": "Curtidos",
    "customerOrders": "Pedidos",
    "customerProfile": "Perfil",
    "merchantPanel": "Painel do Lojista",
    "adminPanel": "Painel Admin",
    "staffStores": "Lojas",
    "merchantOverview": "Visão Geral"
  },
  "home": {
    "searchStoresProducts": "Buscar loja ou produto...",
    "searchAds": "Buscar anúncio...",
    "allCategories": "Todas",
    "tabFeed": "Para você",
    "tabAds": "Anúncios",
    "viewStoreCta": "Ver loja e pedir pelo WhatsApp",
    "viewStore": "Ver loja",
    "badgeMostLiked": "Mais curtido",
    "badgeNewProduct": "Novo produto",
    "badgeFeatured": "Destaque",
    "addToCartShort": "+ Carrinho",
    "connectErrorTitle": "Erro ao conectar",
    "noNeighborhoodsTitle": "Nenhum bairro configurado",
    "noNeighborhoodsBody": "Em breve novas regiões estarão disponíveis.",
    "noAdsTitle": "Sem anúncios no momento",
    "noAdsBody": "Volte em breve para ver ofertas patrocinadas neste bairro.",
    "emptyFeedTitle": "Feed vazio neste bairro",
    "emptyFeedBody": "Em breve novas lojas e produtos aparecerão aqui.",
    "nothingFoundTitle": "Nada encontrado",
    "nothingFoundBody": "Tente outra categoria ou limpe a busca."
  },
  "auth": {
    "loginTitle": "Entrar",
    "loginDescription": "Use o mesmo login para conta de cliente ou lojista.",
    "loginWithGoogle": "Entrar com Google",
    "dividerOrEmail": "ou use email e senha",
    "dividerOrForm": "ou preencha o formulário",
    "submitLogin": "Entrar",
    "forgotPassword": "Esqueci minha senha",
    "createCustomerAccount": "Criar conta de cliente",
    "registerMyStore": "Cadastrar minha loja",
    "adminAccess": "Acesso admin",
    "moderatorAccess": "Acesso moderador",
    "registerTitle": "Criar Conta",
    "registerDescription": "Cadastre-se para favoritar lojas e agilizar seus pedidos.",
    "registerWithGoogle": "Criar conta com Google",
    "submitRegister": "Criar conta",
    "alreadyHaveAccount": "Já tenho conta",
    "adminLoginTitle": "Painel Admin",
    "adminLoginDescription": "Acesso restrito a administradores da plataforma.",
    "moderatorLoginTitle": "Painel Moderador",
    "moderatorLoginDescription": "Acesso restrito a moderadores da plataforma.",
    "accessDenied": "Acesso negado.",
    "resetEmailFirst": "Informe seu email acima primeiro.",
    "resetLinkSent": "Link de redefinição enviado para seu email.",
    "registerStoreTitle": "Cadastrar Loja",
    "registerStoreAccountFirst": "Primeiro crie sua conta de lojista.",
    "registerStoreWithGoogle": "Cadastrar loja com Google",
    "createMerchantAccount": "Criar conta de lojista",
    "registerStoreFormDescription": "Preencha os dados da sua loja. Após envio, aguarde aprovação do moderador da região.",
    "storeName": "Nome da loja",
    "neighborhoodRegion": "Bairro / região",
    "submitStoreRegistration": "Enviar cadastro",
    "storeSubmittedSuccess": "Loja enviada! Aguarde aprovação."
  },
  "store": {
    "unavailableTitle": "Loja indisponível",
    "unavailableBody": "Esta loja não existe, não foi aprovada ou está com assinatura inativa.",
    "backToHome": "Voltar ao início",
    "cart": "🛒 Carrinho",
    "favorited": "❤️ Favoritado",
    "favorite": "🤍 Favoritar",
    "share": "🔗 Compartilhar",
    "productsAndServices": "Produtos e serviços",
    "storeReviews": "Avaliações da loja",
    "unavailable": "Indisponível",
    "addProduct": "+ Adicionar",
    "loginToLike": "Entre para curtir",
    "noCommentsYet": "Nenhum comentário ainda.",
    "commentPlaceholder": "Escreva um comentário...",
    "submitComment": "Comentar",
    "linkCopiedToast": "Link copiado!",
    "commentPublished": "Comentário publicado!"
  },
  "cart": {
    "title": "Carrinho",
    "yourOrder": "Seu pedido",
    "emptyTitle": "Carrinho vazio",
    "emptyBody": "Adicione produtos de uma loja para começar seu pedido.",
    "itemsCount": "Itens ({count})",
    "total": "Total",
    "checkoutHint": "Pagamento combinado com a loja via WhatsApp"
  },
  "checkout": {
    "finalizeOrder": "Finalizar pedido",
    "paymentLegend": "Como você prefere pagar?",
    "deliverySectionTitle": "Dados para entrega",
    "orderTotal": "Total do pedido",
    "back": "Voltar",
    "sendViaWhatsapp": "Enviar via WhatsApp",
    "paymentPix": "PIX",
    "paymentPixHint": "A loja envia a chave no WhatsApp",
    "paymentCash": "Dinheiro na entrega",
    "paymentCashHint": "Pague ao receber o pedido",
    "paymentCard": "Cartão na entrega",
    "paymentCardHint": "Maquininha ou cartão com a loja",
    "paymentTransfer": "Transferência",
    "paymentTransferHint": "Dados bancários no WhatsApp"
  },
  "customer": {
    "loginRequiredTitle": "Faça login",
    "loginRequiredBody": "Entre na sua conta para acessar favoritos, pedidos e perfil.",
    "myAccountTitle": "Minha conta",
    "metricFavoriteStores": "Lojas favoritas",
    "metricLikedProducts": "Produtos curtidos",
    "metricOrders": "Pedidos",
    "metricCartItems": "Itens no carrinho",
    "exploreStores": "Explorar lojas",
    "exploreStoresDesc": "Descubra novidades no feed",
    "viewFavorites": "Ver favoritos",
    "openCart": "Abrir carrinho",
    "noFavoriteStoresTitle": "Nenhuma loja favorita",
    "noFavoriteStoresBody": "Abra uma loja e toque no coração para salvar aqui.",
    "noLikedProductsTitle": "Nenhum produto curtido",
    "noLikedProductsBody": "Curta produtos nas vitrines para encontrá-los rapidamente aqui.",
    "noOrdersTitle": "Nenhum pedido ainda",
    "noOrdersBody": "Seus pedidos feitos pela plataforma aparecerão aqui após o checkout.",
    "profileUpdated": "Perfil atualizado",
    "passwordUpdated": "Senha atualizada"
  },
  "merchant": {
    "restrictedAccess": "Acesso restrito",
    "noStoreRegistered": "Nenhuma loja cadastrada",
    "statusPending": "Aguardando aprovação",
    "statusApproved": "Loja aprovada",
    "statusBlocked": "Loja bloqueada",
    "viewPublicStore": "Ver loja pública",
    "activeProducts": "Produtos ativos",
    "orders": "Pedidos",
    "settingsSaved": "Configurações salvas!",
    "productUpdated": "Produto atualizado!",
    "newAd": "Novo anúncio",
    "plansSubtitle": "Assine ou renove o plano da sua loja ou serviço",
    "saveChanges": "Salvar alterações"
  },
  "admin": {
    "restrictedAccess": "Acesso restrito",
    "overviewSubtitle": "Resumo multi-bairro da plataforma e atalhos rápidos",
    "quickNewStore": "Nova loja",
    "quickNeighborhoods": "Bairros",
    "quickModerators": "Moderadores",
    "metricStores": "Lojas",
    "metricProducts": "Produtos",
    "metricOrders": "Pedidos",
    "metricRevenue": "Receita",
    "metricViews": "Visualizações",
    "metricPending": "Pendentes",
    "allCaughtUpTitle": "Tudo em dia",
    "allCaughtUpBody": "Nenhuma loja ou pedido de plano aguardando aprovação.",
    "neighborhoodCreated": "Bairro criado",
    "neighborhoodUpdated": "Bairro atualizado",
    "moderatorPermissionsUpdated": "Permissões do moderador atualizadas",
    "promoteModerator": "Promover a moderador"
  },
  "moderator": {
    "panelLabel": "Painel Moderador",
    "regionNotAssigned": "Região não atribuída — contate o admin",
    "readonlyStoresHint": "Moderadores podem visualizar lojas, mas não criar nem editar.",
    "approvalOnlyBadge": "Somente aprovações de loja",
    "approvePlanChanges": "Aprovar mudanças de plano"
  },
  "errors": {
    "generic": "Não foi possível concluir a operação. Tente novamente.",
    "invalidCredentials": "Email ou senha incorretos. Verifique os dados ou use \"Esqueci minha senha\".",
    "informNeighborhoodName": "Informe o nome do bairro.",
    "selectModeratorNeighborhood": "Selecione o bairro do moderador.",
    "minAgeRegistration": "É necessário ter 18 anos ou mais para criar conta."
  },
  "labels": {
    "name": "Nome",
    "email": "Email",
    "password": "Senha",
    "phone": "Telefone",
    "address": "Endereço",
    "birthDate": "Data de nascimento",
    "storeName": "Nome da loja",
    "neighborhoodRegion": "Bairro / região",
    "category": "Categoria",
    "whatsapp": "WhatsApp",
    "description": "Descrição",
    "city": "Cidade",
    "state": "UF",
    "status": "Status",
    "plan": "Plano",
    "permissions": "Permissões",
    "newPassword": "Nova senha",
    "confirmNewPassword": "Confirmar nova senha",
    "save": "Salvar",
    "cancel": "Cancelar",
    "edit": "Editar",
    "delete": "Excluir",
    "approve": "Aprovar",
    "reject": "Rejeitar"
  },
  "toasts": {
    "panelUpdated": "Painel atualizado",
    "orderSent": "Pedido enviado! Confirme no WhatsApp.",
    "storeCreated": "Loja criada!",
    "neighborhoodDeleted": "Bairro excluído"
  }
}

/** Resolve chave pontuada (ex.: nav.home) e substitui {placeholders}. */
export function t(key, vars = {}) {
  const value = key.split('.').reduce((obj, part) => obj?.[part], STRINGS)
  if (typeof value !== 'string') return key
  return value.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`))
}

export function flattenStrings(obj = STRINGS, prefix = '') {
  const rows = []
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      rows.push(...flattenStrings(val, path))
    } else {
      rows.push({ key: path, value: String(val ?? '') })
    }
  }
  return rows
}

export function unflattenStrings(rows) {
  const root = {}
  for (const { key, value } of rows) {
    const parts = key.split('.')
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] ??= {}
      node = node[parts[i]]
    }
    node[parts[parts.length - 1]] = value
  }
  return root
}

const STRINGS_FILE_HEADER = `/**
 * Textos estáticos da interface — edite em strings-editor.html
 * Uso: import { t } from './strings.js'  →  t('nav.home')
 */

`

const STRINGS_FILE_HELPERS = `
/** Resolve chave pontuada (ex.: nav.home) e substitui {placeholders}. */
export function t(key, vars = {}) {
  const value = key.split('.').reduce((obj, part) => obj?.[part], STRINGS)
  if (typeof value !== 'string') return key
  return value.replace(/\\{(\\w+)\\}/g, (_, name) => String(vars[name] ?? \`{\${name}}\`))
}

export function flattenStrings(obj = STRINGS, prefix = '') {
  const rows = []
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? \`\${prefix}.\${key}\` : key
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      rows.push(...flattenStrings(val, path))
    } else {
      rows.push({ key: path, value: String(val ?? '') })
    }
  }
  return rows
}

export function unflattenStrings(rows) {
  const root = {}
  for (const { key, value } of rows) {
    const parts = key.split('.')
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] ??= {}
      node = node[parts[i]]
    }
    node[parts[parts.length - 1]] = value
  }
  return root
}
`

/** Gera o conteúdo completo de strings.js para download. */
export function serializeStringsModule(strings = STRINGS) {
  return `${STRINGS_FILE_HEADER}export const STRINGS = ${JSON.stringify(strings, null, 2)}\n${STRINGS_FILE_HELPERS}`
}
