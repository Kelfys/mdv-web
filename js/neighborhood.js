/**
 * Bairros (regiões) — seleção no feed e escopo do moderador.
 */
const NEIGHBORHOOD_STORAGE_KEY = 'maredevendas-neighborhood'

export function getSelectedNeighborhoodId() {
  return localStorage.getItem(NEIGHBORHOOD_STORAGE_KEY) || null
}

export function setSelectedNeighborhoodId(id) {
  if (id) localStorage.setItem(NEIGHBORHOOD_STORAGE_KEY, id)
  else localStorage.removeItem(NEIGHBORHOOD_STORAGE_KEY)
}

export function getModeratorNeighborhoodId(user) {
  return user?.role === 'moderator' ? user.neighborhood_id ?? null : null
}

export function formatNeighborhoodLabel(neighborhood) {
  if (!neighborhood) return ''
  const city = neighborhood.city?.trim()
  return city ? `${neighborhood.name} · ${city}` : neighborhood.name
}

/** Escopo de dados para painéis staff: admin vê tudo; moderador só sua região. */
export function getStaffNeighborhoodScope(user, panel, adminFilterId = null) {
  if (panel === 'moderator') {
    return getModeratorNeighborhoodId(user) ?? undefined
  }
  return adminFilterId || undefined
}