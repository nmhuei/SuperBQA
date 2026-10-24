import {
  Permissions,
  type GoodClubAccess,
  type ResponseData,
} from '@rctf/types'
import type { ArchiveSummary } from './archive-model'

const permissionLabels = [
  { value: Permissions.challsRead, label: 'View hidden challenges' },
  { value: Permissions.challsWrite, label: 'Edit challenges' },
  { value: Permissions.leaderboardRead, label: 'View hidden standings' },
  { value: Permissions.challsSolveWrite, label: 'Manage solves' },
  { value: Permissions.usersWrite, label: 'Manage accounts' },
  { value: Permissions.settingsWrite, label: 'Manage settings' },
]

export function profileAccess(
  perms: number | null | undefined,
  access: ResponseData<typeof GoodClubAccess> | undefined
) {
  const has = (permission: number) => ((perms ?? 0) & permission) === permission
  const permissions = permissionLabels.filter(permission =>
    has(permission.value)
  )
  const actions: { href: string; label: string }[] = []
  if (access) {
    if (has(Permissions.challsRead))
      actions.push({ href: '/admin/challenges', label: 'Challenges' })
    if (has(Permissions.usersWrite) && access.canManageMembers) {
      actions.push(
        { href: '/admin/club', label: 'Club membership' },
        { href: '/admin/teams', label: 'Accounts' }
      )
      if (has(Permissions.challsRead))
        actions.push({ href: '/admin/submissions', label: 'Submissions' })
    }
    if (has(Permissions.settingsWrite) && access.canManageArchives)
      actions.push(
        { href: '/admin/club/events', label: 'Club events' },
        { href: '/admin/settings', label: 'Site settings' }
      )
  }
  return {
    variant: permissions.length
      ? ('admin' as const)
      : access?.role === 'member'
        ? ('member' as const)
        : ('guest' as const),
    membership: access?.role,
    permissions,
    actions,
  }
}

export function profilePractice(archives: readonly ArchiveSummary[]) {
  const tracked = archives.filter(
    (
      archive
    ): archive is ArchiveSummary & {
      practiceChallengeCount: number
      solvedCount: number
    } =>
      typeof archive.practiceChallengeCount === 'number' &&
      Number.isInteger(archive.practiceChallengeCount) &&
      archive.practiceChallengeCount >= 0 &&
      typeof archive.solvedCount === 'number' &&
      Number.isInteger(archive.solvedCount) &&
      archive.solvedCount >= 0 &&
      archive.solvedCount <= archive.practiceChallengeCount
  )
  const totals =
    tracked.length === archives.length
      ? tracked.reduce(
          (total, archive) => ({
            solved: total.solved + archive.solvedCount,
            total: total.total + archive.practiceChallengeCount,
            completed:
              total.completed +
              Number(
                archive.practiceChallengeCount > 0 &&
                  archive.solvedCount === archive.practiceChallengeCount
              ),
          }),
          { solved: 0, total: 0, completed: 0 }
        )
      : null
  const next =
    tracked
      .filter(archive => archive.solvedCount < archive.practiceChallengeCount)
      .sort(
        (a, b) =>
          Number(b.solvedCount > 0) - Number(a.solvedCount > 0) ||
          b.endTime - a.endTime
      )[0] ?? null
  return { totals, next }
}
