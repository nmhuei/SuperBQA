import type {
  GoodClubArchive,
  GoodClubArchives,
  ResponseData,
} from '@rctf/types'

export type ArchiveData = ResponseData<typeof GoodClubArchive>
export type ArchivedChallenge = ArchiveData['challenges'][number]
export type ArchiveSummary = ResponseData<typeof GoodClubArchives>[number]
export type ArchiveLocationOptions = {
  challengeId?: string | null
  query?: string
  hideSolved?: boolean
  catalogQuery?: string
}

const text = (value: string | null | undefined) => (value ?? '').slice(0, 200)
const id = (value: string | null | undefined) =>
  value?.trim() && value.length <= 200 ? value : null

export function parseArchiveLocation(url: URL) {
  return {
    archiveId: id(url.searchParams.get('archive')),
    challengeId: id(url.searchParams.get('challenge')),
    query: text(url.searchParams.get('q')),
    hideSolved: url.searchParams.get('hideSolved') === '1',
    catalogQuery: text(url.searchParams.get('catalog')),
  }
}
export function archiveCatalogHref(query = '') {
  const params = new URLSearchParams()
  if (text(query)) params.set('q', text(query))
  return `/archive${params.size ? `?${params}` : ''}`
}
function scopeParams(options: ArchiveLocationOptions) {
  const params = new URLSearchParams()
  if (id(options.challengeId)) params.set('challenge', options.challengeId!)
  if (text(options.query)) params.set('q', text(options.query))
  if (options.hideSolved) params.set('hideSolved', '1')
  if (text(options.catalogQuery))
    params.set('catalog', text(options.catalogQuery))
  return params
}
export function archiveChallengeHref(
  archiveId: string,
  options: ArchiveLocationOptions = {}
) {
  if (!id(archiveId)) return archiveCatalogHref(options.catalogQuery)
  const params = new URLSearchParams({ archive: archiveId })
  scopeParams(options).forEach((value, key) => params.set(key, value))
  return `/challenges?${params}`
}
export function archiveScoreboardHref(
  archiveId: string,
  options: ArchiveLocationOptions = {}
) {
  if (!id(archiveId)) return archiveCatalogHref(options.catalogQuery)
  const params = scopeParams(options)
  return `/scores/archive/${encodeURIComponent(archiveId)}${params.size ? `?${params}` : ''}`
}
export function isArchiveContext(url: URL) {
  return (
    url.pathname === '/archive' ||
    url.pathname.startsWith('/archive/') ||
    url.pathname.startsWith('/scores/archive/') ||
    (url.pathname === '/challenges' && url.searchParams.has('archive'))
  )
}
export function isNavigationPathActive(activePath: string, url: URL) {
  if (activePath === '/admin/club') return url.pathname === activePath
  const clubEvent =
    url.pathname === '/club/events' ||
    url.pathname.startsWith('/scores/events/') ||
    (url.pathname === '/challenges' &&
      url.searchParams.has('event') &&
      !url.searchParams.has('archive'))
  if (
    clubEvent &&
    ['/club/events', '/archive', '/challenges', '/scores'].includes(activePath)
  )
    return activePath === '/club/events'
  if (
    isArchiveContext(url) &&
    ['/archive', '/challenges', '/scores'].includes(activePath)
  )
    return activePath === '/archive'
  return activePath === '/'
    ? url.pathname === '/'
    : url.pathname === activePath || url.pathname.startsWith(`${activePath}/`)
}
export function practiceProgress(
  challenges: readonly Pick<ArchivedChallenge, 'id' | 'practiceAvailable'>[],
  solvedIds: readonly string[] | ReadonlySet<string>
) {
  const available = new Set(
    challenges.filter(c => c.practiceAvailable).map(c => c.id)
  )
  const solved = new Set(solvedIds)
  return {
    solved: [...available].filter(key => solved.has(key)).length,
    total: available.size,
    referenceOnly: challenges.filter(c => !c.practiceAvailable).length,
  }
}
export function filterArchives<
  T extends { name: string; description: string; endTime: number },
>(archives: readonly T[], query = ''): T[] {
  const needle = text(query).trim().toLowerCase()
  return archives
    .filter(event =>
      `${event.name} ${event.description} ${new Date(event.endTime).toLocaleDateString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`
        .toLowerCase()
        .includes(needle)
    )
    .toSorted((a, b) => b.endTime - a.endTime)
}
