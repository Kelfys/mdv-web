/**
 * Papéis e permissões do painel da plataforma.
 * Hierarquia: admin > moderador > lojista > cliente
 */
import { t } from './strings.js'

export const ROLES = {
  CUSTOMER: 'customer',
  MERCHANT: 'merchant',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
}

export function isAdmin(user) {
  return user?.role === ROLES.ADMIN
}

export function isModerator(user) {
  return user?.role === ROLES.MODERATOR
}

export function isStaff(user) {
  return isAdmin(user) || isModerator(user)
}

export function canAccessPanel(user, panel) {
  if (panel === 'admin') return isAdmin(user)
  if (panel === 'moderator') return isModerator(user)
  return false
}

const MODERATOR_READONLY_TABS = new Set(['stores', 'products'])

export function isReadOnlyStaffTab(panel, tab) {
  return panel === 'moderator' && MODERATOR_READONLY_TABS.has(tab)
}

export function canApprovePlanChanges(user) {
  return isAdmin(user) || (isModerator(user) && Boolean(user?.can_approve_plan_changes))
}

/** Permissões configuráveis pelo admin para cada moderador. */
export const MODERATOR_PERMISSIONS = [
  {
    id: 'can_approve_plan_changes',
    get label() { return t('moderator.approvePlanChanges') },
    get description() { return t('moderator.approvePlanChangesDesc') },
  },
]

export function getModeratorPermissionValue(moderator, permissionId) {
  if (!moderator) return false
  if (permissionId === 'can_approve_plan_changes') {
    return Boolean(moderator.can_approve_plan_changes)
  }
  return false
}