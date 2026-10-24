import { describe, expect, test } from 'bun:test'
import {
  archiveCatalogHref,
  archiveChallengeHref,
  archiveScoreboardHref,
  isArchiveContext,
  isNavigationPathActive,
  parseArchiveLocation,
  practiceProgress,
  filterArchives,
} from '../../../src/lib/club/archive-model'

describe('member archive navigation', () => {
  test('encodes event and challenge IDs and restores filters on refresh', () => {
    const href = archiveChallengeHref('event / A', {
      challengeId: 'x&y',
      query: 'web + crypto',
      hideSolved: true,
      catalogQuery: 'October',
    })
    expect(parseArchiveLocation(new URL(href, 'http://local'))).toEqual({
      archiveId: 'event / A',
      challengeId: 'x&y',
      query: 'web + crypto',
      hideSolved: true,
      catalogQuery: 'October',
    })
  })
  test('a new event has no inherited challenge or search', () => {
    expect(
      parseArchiveLocation(new URL(archiveChallengeHref('B'), 'http://local'))
    ).toEqual({
      archiveId: 'B',
      challengeId: null,
      query: '',
      hideSolved: false,
      catalogQuery: '',
    })
  })
  test('an empty archive parameter remains archive context, never a live fallback', () => {
    const url = new URL('http://local/challenges?archive=')
    expect(isArchiveContext(url)).toBe(true)
    expect(parseArchiveLocation(url).archiveId).toBeNull()
    expect(archiveChallengeHref('')).toBe('/archive')
  })
  test('catalogue and scoreboard links retain only safe internal context', () => {
    expect(archiveCatalogHref('a&b')).toBe('/archive?q=a%26b')
    const score = new URL(
      archiveScoreboardHref('A/B', {
        challengeId: 'c',
        catalogQuery: '//elsewhere',
      }),
      'http://local'
    )
    expect(score.pathname).toBe('/scores/archive/A%2FB')
    expect(score.searchParams.get('challenge')).toBe('c')
    expect(score.searchParams.get('catalog')).toBe('//elsewhere')
    expect(score.origin).toBe('http://local')
  })
  test('Archive stays active across practice and frozen scoreboard routes', () => {
    for (const path of [
      '/archive',
      '/challenges?archive=A',
      '/scores/archive/A',
    ]) {
      const url = new URL(path, 'http://local')
      expect(isNavigationPathActive('/archive', url)).toBe(true)
      expect(isNavigationPathActive('/challenges', url)).toBe(false)
      expect(isNavigationPathActive('/scores', url)).toBe(false)
    }
    expect(
      isNavigationPathActive('/challenges', new URL('http://local/challenges'))
    ).toBe(true)
    expect(
      isNavigationPathActive('/scores', new URL('http://local/scores?search=x'))
    ).toBe(true)
    expect(
      isNavigationPathActive('/admin', new URL('http://local/admin/club'))
    ).toBe(true)
    expect(
      isNavigationPathActive(
        '/admin/club',
        new URL('http://local/admin/club/events')
      )
    ).toBe(false)
    expect(
      isNavigationPathActive(
        '/admin/club/events',
        new URL('http://local/admin/club/events')
      )
    ).toBe(true)
    const internal = new URL('http://local/challenges?event=private')
    expect(isNavigationPathActive('/club/events', internal)).toBe(true)
    expect(isNavigationPathActive('/challenges', internal)).toBe(false)
    expect(isNavigationPathActive('/archive', internal)).toBe(false)
  })
})

describe('real archive progress and catalogue', () => {
  test('only available unique solved challenges contribute to completion', () => {
    expect(
      practiceProgress(
        [
          { id: 'a', practiceAvailable: true },
          { id: 'b', practiceAvailable: true },
          { id: 'c', practiceAvailable: false },
        ],
        ['a', 'a', 'c', 'foreign']
      )
    ).toEqual({ solved: 1, total: 2, referenceOnly: 1 })
    expect(practiceProgress([], [])).toEqual({
      solved: 0,
      total: 0,
      referenceOnly: 0,
    })
  })
  test('catalogue search returns matching events newest first without mutating cache', () => {
    const events = [
      { id: 'a', name: 'UCS Old', description: 'Web lab', endTime: 1 },
      { id: 'b', name: 'UCS New', description: 'Crypto lab', endTime: 3 },
      { id: 'c', name: 'Other', description: 'Web lab', endTime: 2 },
    ]
    expect(filterArchives(events, 'web').map(e => e.id)).toEqual(['c', 'a'])
    expect(filterArchives(events, ' UCS ').map(e => e.id)).toEqual(['b', 'a'])
    expect(events.map(e => e.id)).toEqual(['a', 'b', 'c'])
  })
})
