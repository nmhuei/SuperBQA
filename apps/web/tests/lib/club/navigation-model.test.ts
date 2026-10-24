import { describe, expect, test } from 'bun:test'
import { Permissions } from '@rctf/types'
import { getNavigationModel } from '../../../src/lib/club/navigation-model'
const guest = { role: 'guest' as const, canAccessArchives: false }
const member = { role: 'member' as const, canAccessArchives: true }
const paths = (items: { href: string }[]) => items.map(item => item.href)
describe('role navigation', () => {
  for (const mode of ['club', 'event'] as const) {
    test(`Guest keeps all public destinations in ${mode} mode`, () => {
      const nav = getNavigationModel({
        mode,
        user: { perms: 0 },
        access: guest,
      })
      expect(paths(nav.main)).toEqual(['/', '/rules', '/challenges', '/scores'])
      expect(nav.main[0]?.label).toBe('Event')
      expect(nav.admin).toEqual([])
    })
    test(`Member adds private destinations in ${mode} mode`, () => {
      const nav = getNavigationModel({
        mode,
        user: { perms: 0 },
        access: member,
      })
      expect(paths(nav.main)).toEqual([
        '/',
        '/rules',
        '/challenges',
        '/scores',
        '/club/events',
        '/archive',
      ])
      expect(nav.admin).toEqual([])
    })
  }
  test('anonymous/pending/failed access never reveals private navigation', () => {
    for (const input of [
      { user: null, access: member },
      { user: { perms: 0 } },
      { user: { perms: 0 }, access: member, accessError: true },
      { user: { perms: 63 }, access: member, userError: true },
    ]) {
      const nav = getNavigationModel({ mode: 'club', ...input })
      expect(paths(nav.main)).toEqual(['/', '/rules', '/challenges', '/scores'])
      expect(nav.admin).toEqual([])
    }
  })
  test('settings admin management is independent of membership', () => {
    const nav = getNavigationModel({
      mode: 'club',
      user: { perms: Permissions.settingsWrite },
      access: { ...guest, canAccessArchives: true },
    })
    expect(paths(nav.admin)).toEqual([
      '/admin/club',
      '/admin/club/events',
      '/admin/settings',
    ])
    expect(paths(nav.main)).toContain('/archive')
  })
  test('challenge read only cannot imply membership or settings access', () => {
    const nav = getNavigationModel({
      mode: 'club',
      user: { perms: Permissions.challsRead },
      access: guest,
    })
    expect(paths(nav.admin)).toEqual(['/admin/challenges'])
    expect(paths(nav.main)).not.toContain('/archive')
  })
  test('submissions need both permissions; management destinations are unique', () => {
    const nav = getNavigationModel({
      mode: 'event',
      user: { perms: Permissions.usersWrite | Permissions.challsRead },
      access: member,
    })
    expect(paths(nav.admin)).toContain('/admin/submissions')
    expect(paths(nav.admin)).not.toContain('/admin/club/events')
    expect(new Set(paths(nav.admin)).size).toBe(nav.admin.length)
  })
})
