import { Permissions } from '@rctf/types'
import { hasPermissions } from '../utils/permissions'

export type NavigationIcon =
  | 'home'
  | 'rules'
  | 'challenges'
  | 'scores'
  | 'archive'
  | 'account'
  | 'settings'
export type NavigationItem = {
  id: string
  href: string
  label: string
  icon: NavigationIcon
}
interface NavigationInput {
  mode?: 'club' | 'event'
  user?: { perms: number | null | undefined } | null
  access?: { role?: 'guest' | 'member'; canAccessArchives: boolean }
  userError?: boolean
  accessError?: boolean
}

// Presentation only. Server routes independently enforce identity, permission and event scope.
export function getNavigationModel(input: NavigationInput) {
  const user = input.userError ? null : input.user
  const privateAccess =
    !!user && !input.accessError && input.access?.canAccessArchives === true
  const main: NavigationItem[] = [
    {
      id: 'home',
      href: '/',
      label: input.mode === 'club' && privateAccess ? 'Home' : 'Event',
      icon: 'home',
    },
    { id: 'rules', href: '/rules', label: 'Rules', icon: 'rules' },
    {
      id: 'challenges',
      href: '/challenges',
      label: 'Challenges',
      icon: 'challenges',
    },
    { id: 'scores', href: '/scores', label: 'Scoreboard', icon: 'scores' },
  ]
  if (privateAccess)
    main.push(
      {
        id: 'club-events',
        href: '/club/events',
        label: 'Club events',
        icon: 'challenges',
      },
      { id: 'archive', href: '/archive', label: 'Archive', icon: 'archive' }
    )
  const settings = hasPermissions(user, Permissions.settingsWrite)
  const members = hasPermissions(user, Permissions.usersWrite)
  const challenges = hasPermissions(user, Permissions.challsRead)
  const admin: NavigationItem[] = []
  if (settings || members)
    admin.push({
      id: 'admin-club',
      href: '/admin/club',
      label: 'Club management',
      icon: 'archive',
    })
  if (settings)
    admin.push({
      id: 'admin-events',
      href: '/admin/club/events',
      label: 'Manage events',
      icon: 'challenges',
    })
  if (challenges)
    admin.push({
      id: 'admin-challenges',
      href: '/admin/challenges',
      label: 'Manage challenges',
      icon: 'challenges',
    })
  if (members)
    admin.push({
      id: 'admin-teams',
      href: '/admin/teams',
      label: 'Manage teams',
      icon: 'account',
    })
  if (challenges && members)
    admin.push({
      id: 'admin-submissions',
      href: '/admin/submissions',
      label: 'Submissions',
      icon: 'archive',
    })
  if (settings || members)
    admin.push({
      id: 'admin-settings',
      href: '/admin/settings',
      label: 'Settings',
      icon: 'settings',
    })
  return { main, admin }
}
