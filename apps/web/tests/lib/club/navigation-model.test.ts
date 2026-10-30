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
      expect(paths(nav.main)).toEqual(['/', '/rules', '/club/events', '/scores'])
      expect(nav.main[0]?.label).toBe('Home')
      expect(nav.main[2]?.label).toBe('Club events')
      expect(nav.admin).toEqual([])
    })
    test(`Member keeps all public destinations in ${mode} mode`, () => {
      const nav = getNavigationModel({
        mode,
        user: { perms: 0 },
        access: member,
      })
      expect(paths(nav.main)).toEqual(['/', '/rules', '/club/events', '/scores'])
      expect(nav.main[2]?.label).toBe('Club events')
      expect(nav.admin).toEqual([])
    })
  }
  test('anonymous/pending/failed access keeps standard public navigation', () => {
    for (const input of [
      { user: null, access: member },
      { user: { perms: 0 } },
      { user: { perms: 0 }, access: member, accessError: true },
      { user: { perms: 63 }, access: member, userError: true },
    ]) {
      const nav = getNavigationModel({ mode: 'club', ...input })
      expect(paths(nav.main)).toEqual(['/', '/rules', '/club/events', '/scores'])
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
      '/club/events?manage=true',
      '/admin/settings',
    ])
    expect(paths(nav.main)).not.toContain('/archive')
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
    expect(paths(nav.admin)).not.toContain('/club/events?manage=true')
    expect(new Set(paths(nav.admin)).size).toBe(nav.admin.length)
  })
})
