import type { GoodClubArchive, ResponseData } from '@rctf/types'
import { describe, expect, test } from 'bun:test'
import {
  filterArchiveChallenges,
  groupArchiveChallenges,
  loadArchiveCollapsedCategories,
  saveArchiveCollapsedCategories,
} from '../../../src/lib/club/archive-list-model'

type ArchivedChallenge = ResponseData<
  typeof GoodClubArchive
>['challenges'][number]

function challenge(
  id: string,
  overrides: Partial<ArchivedChallenge> = {}
): ArchivedChallenge {
  return {
    id,
    name: id,
    description: '',
    category: 'web',
    author: '',
    points: 100,
    solves: 0,
    files: [],
    tags: [],
    practiceAvailable: true,
    practiceUnavailableReason: null,
    ...overrides,
  }
}

describe('archive challenge list', () => {
  test('groups category aliases in native category order without mutating the snapshot', () => {
    const snapshot = [
      challenge('z', { category: 'unknown' }),
      challenge('web'),
      challenge('binary-low', { category: ' Binary ', solves: 1 }),
      challenge('binary-high', { category: 'pwn', solves: 9 }),
      challenge('rev', { category: 'REV' }),
    ]
    const originalIds = snapshot.map(item => item.id)

    expect(
      groupArchiveChallenges(snapshot).map(group => ({
        category: group.category,
        ids: group.challenges.map(item => item.id),
      }))
    ).toEqual([
      { category: 'pwn', ids: ['binary-high', 'binary-low'] },
      { category: 'reverse', ids: ['rev'] },
      { category: 'web', ids: ['web'] },
      { category: 'unknown', ids: ['z'] },
    ])
    expect(snapshot.map(item => item.id)).toEqual(originalIds)
  })

  test('searches name, author, category aliases and tags while applying only the current event solves', () => {
    const snapshot = [
      challenge('welcome', { author: 'Alice', tags: ['warmup'] }),
      challenge('binary', { category: 'binary' }),
      challenge('reference', { practiceAvailable: false }),
    ]
    const filter = (query: string, hideSolved = false) =>
      filterArchiveChallenges(snapshot, {
        query,
        hideSolved,
        solvedIds: new Set(['welcome', 'another-event-challenge']),
      }).map(item => item.id)

    expect(filter('  ALICE ')).toEqual(['welcome'])
    expect(filter('pwn')).toEqual(['binary'])
    expect(filter('warmup')).toEqual(['welcome'])
    expect(filter('', true)).toEqual(['binary', 'reference'])
    expect(filter('welcome', true)).toEqual([])
    expect(filter('missing')).toEqual([])
  })

  test('keeps collapse preferences separate when events reuse category names', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    }

    saveArchiveCollapsedCategories('event-a', ['web', 'web', 'crypto'], storage)
    saveArchiveCollapsedCategories('event-b', ['pwn'], storage)

    expect(loadArchiveCollapsedCategories('event-a', storage)).toEqual([
      'web',
      'crypto',
    ])
    expect(loadArchiveCollapsedCategories('event-b', storage)).toEqual(['pwn'])
    expect(loadArchiveCollapsedCategories('new-event', storage)).toEqual([])
  })

  test('keeps private event preferences separate from an archive with the same ID', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    }
    saveArchiveCollapsedCategories('shared-id', ['web'], storage)
    saveArchiveCollapsedCategories('shared-id', ['pwn'], storage, 'event')

    expect(loadArchiveCollapsedCategories('shared-id', storage)).toEqual([
      'web',
    ])
    expect(
      loadArchiveCollapsedCategories('shared-id', storage, 'event')
    ).toEqual(['pwn'])
  })

  test.each(['not json', '{}', '["web", 1]', 'null'])(
    'ignores malformed stored preferences: %s',
    value => {
      expect(
        loadArchiveCollapsedCategories('event', { getItem: () => value })
      ).toEqual([])
    }
  )

  test('works when browser storage is unavailable', () => {
    const storage = {
      getItem() {
        throw new Error('Storage blocked')
      },
      setItem() {
        throw new Error('Storage blocked')
      },
    }
    expect(loadArchiveCollapsedCategories('event', storage)).toEqual([])
    expect(() =>
      saveArchiveCollapsedCategories('event', ['web'], storage)
    ).not.toThrow()
  })
})
