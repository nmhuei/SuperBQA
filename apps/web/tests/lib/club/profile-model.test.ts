import {
  Permissions,
  type GoodClubAccess,
  type ResponseData,
} from '@rctf/types'
import { describe, expect, test } from 'bun:test'
import {
  profileAccess,
  profilePractice,
} from '../../../src/lib/club/profile-model'
import type { ArchiveSummary } from '../../../src/lib/club/archive-model'

const access = (
  role: 'guest' | 'member',
  patch: Partial<ResponseData<typeof GoodClubAccess>> = {}
) => ({
  role,
  canManageMembers: false,
  canManageArchives: false,
  canAccessArchives: role === 'member',
  ...patch,
})
const archive = (
  id: string,
  total: number | undefined,
  solved: number | undefined,
  endTime = 1
): ArchiveSummary => ({
  id,
  name: id,
  description: '',
  startTime: 0,
  endTime,
  createdAt: '',
  challengeCount: 10,
  participantCount: 0,
  practiceChallengeCount: total,
  solvedCount: solved,
})

describe('profile role and management actions', () => {
  test('administrative permissions do not imply club membership', () => {
    const profile = profileAccess(
      Permissions.settingsWrite,
      access('guest', { canManageArchives: true, canAccessArchives: true })
    )
    expect(profile.variant).toBe('admin')
    expect(profile.membership).toBe('guest')
    expect(profile.permissions.map(permission => permission.label)).toEqual([
      'Manage settings',
    ])
    expect(profile.actions.map(action => action.href)).toEqual([
      '/admin/club/events',
      '/admin/settings',
    ])
  })
  test('membership does not grant management actions', () => {
    const profile = profileAccess(0, access('member'))
    expect(profile.variant).toBe('member')
    expect(profile.permissions).toEqual([])
    expect(profile.actions).toEqual([])
  })
  test('Guest has no member or admin privileges', () => {
    const profile = profileAccess(null, access('guest'))
    expect(profile.variant).toBe('guest')
    expect(profile.membership).toBe('guest')
    expect(profile.actions).toEqual([])
  })
  test('challenge readers only receive their permitted management link', () => {
    const profile = profileAccess(Permissions.challsRead, access('guest'))
    expect(profile.actions.map(action => action.href)).toEqual([
      '/admin/challenges',
    ])
    expect(profile.permissions.map(permission => permission.label)).toEqual([
      'View hidden challenges',
    ])
  })
  test('effective club access limits stale management flags and unresolved access hides links', () => {
    expect(
      profileAccess(
        Permissions.usersWrite | Permissions.settingsWrite,
        access('guest')
      ).actions
    ).toEqual([])
    expect(profileAccess(Permissions.challsRead, undefined).actions).toEqual([])
    expect(
      profileAccess(
        Permissions.usersWrite,
        access('member', { canManageMembers: true })
      ).actions.map(action => action.href)
    ).toEqual(['/admin/club', '/admin/teams'])
  })
})

describe('profile practice summary', () => {
  test('counts practice-ready challenges only and resumes the newest unfinished archive', () => {
    const result = profilePractice([
      archive('finished', 2, 2, 30),
      archive('older', 3, 1, 10),
      archive('recent', 4, 2, 20),
      archive('reference', 0, 0, 40),
    ])
    expect(result.totals).toEqual({ solved: 5, total: 9, completed: 1 })
    expect(result.next?.id).toBe('recent')
  })
  test('does not invent progress when a response lacks summary fields', () => {
    expect(
      profilePractice([
        archive('known', 3, 1),
        archive('unknown', undefined, undefined),
      ]).totals
    ).toBeNull()
    expect(profilePractice([archive('invalid', 2, 3)]).totals).toBeNull()
  })
  test('empty and reference-only archives are not presented as completed practice', () => {
    expect(profilePractice([])).toEqual({
      totals: { solved: 0, total: 0, completed: 0 },
      next: null,
    })
    expect(profilePractice([archive('reference', 0, 0)])).toEqual({
      totals: { solved: 0, total: 0, completed: 0 },
      next: null,
    })
    expect(profilePractice([archive('new', 3, 0)]).next?.id).toBe('new')
  })
})
