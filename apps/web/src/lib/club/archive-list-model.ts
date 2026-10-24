import type { ArchivedChallenge } from './archive-model'
import { compareCategories, getCategoryKeyOrAlias } from '$lib/utils/categories'

export function groupArchiveChallenges(
  challenges: readonly ArchivedChallenge[]
) {
  const groups = new Map<string, ArchivedChallenge[]>()
  for (const challenge of challenges) {
    const category = getCategoryKeyOrAlias(challenge.category.trim())
    const group = groups.get(category) ?? []
    group.push(challenge)
    groups.set(category, group)
  }
  return [...groups]
    .map(([category, entries]) => ({
      category,
      challenges: entries.sort(
        (a, b) => b.solves - a.solves || a.name.localeCompare(b.name)
      ),
    }))
    .sort((a, b) => compareCategories(a.category, b.category))
}

export function filterArchiveChallenges(
  challenges: readonly ArchivedChallenge[],
  {
    query,
    hideSolved,
    solvedIds,
  }: {
    query: string
    hideSolved: boolean
    solvedIds: ReadonlySet<string>
  }
) {
  const needle = query.trim().toLowerCase()
  return challenges.filter(challenge => {
    if (hideSolved && solvedIds.has(challenge.id)) return false
    const searchable = [
      challenge.name,
      challenge.category,
      getCategoryKeyOrAlias(challenge.category.trim()),
      challenge.author,
      ...challenge.tags,
    ]
    return (
      !needle || searchable.some(value => value.toLowerCase().includes(needle))
    )
  })
}

function preferenceKey(archiveId: string, mode: 'practice' | 'event') {
  const scope = mode === 'event' ? 'club-event' : 'archive'
  return `rctf:${scope}:${encodeURIComponent(archiveId)}:collapsed-categories`
}

export function loadArchiveCollapsedCategories(
  archiveId: string,
  storage?: Pick<Storage, 'getItem'>,
  mode: 'practice' | 'event' = 'practice'
): string[] {
  try {
    const value: unknown = JSON.parse(
      (storage ?? localStorage).getItem(preferenceKey(archiveId, mode)) ?? '[]'
    )
    return Array.isArray(value) && value.every(item => typeof item === 'string')
      ? [...new Set<string>(value)]
      : []
  } catch {
    return []
  }
}

export function saveArchiveCollapsedCategories(
  archiveId: string,
  categories: readonly string[],
  storage?: Pick<Storage, 'setItem'>,
  mode: 'practice' | 'event' = 'practice'
) {
  try {
    ;(storage ?? localStorage).setItem(
      preferenceKey(archiveId, mode),
      JSON.stringify([...new Set(categories)])
    )
  } catch {}
}
