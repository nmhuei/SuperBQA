import {
  ADMIN_PANEL_PERMISSIONS,
  hasAnyPermission,
} from '$lib/utils/permissions'

export type AdminGate = 'loggedOut' | 'noPerms' | 'ok'

export function decideAdminGate(
  user: { perms: number | null | undefined; banned?: boolean } | undefined | null
): AdminGate {
  if (user === null || user === undefined) {
    return 'loggedOut'
  }
  if (user.banned) {
    return 'noPerms'
  }
  if (!user.perms || user.perms <= 0) {
    return 'noPerms'
  }
  return hasAnyPermission(user, ADMIN_PANEL_PERMISSIONS) ? 'ok' : 'noPerms'
}

