import {
  archiveCatalogHref,
  archiveChallengeHref,
  parseArchiveLocation,
  type ArchiveLocationOptions,
} from './archive-model'

export function parseClubEventLocation(url: URL) {
  const { archiveId: _archiveId, ...state } = parseArchiveLocation(url)
  const value = url.searchParams.get('event')
  return {
    ...state,
    eventId: value?.trim() && value.length <= 200 ? value : null,
  }
}
export function clubEventCatalogHref(query = '') {
  return archiveCatalogHref(query).replace('/archive', '/club/events')
}
export function clubEventChallengeHref(
  eventId: string,
  options: ArchiveLocationOptions = {}
) {
  const href = archiveChallengeHref(eventId, options)
  if (href.startsWith('/archive'))
    return clubEventCatalogHref(options.catalogQuery)
  const url = new URL(href, 'http://local')
  url.searchParams.delete('archive')
  url.searchParams.set('event', eventId)
  return `${url.pathname}${url.search}`
}
export function clubEventScoreboardHref(
  eventId: string,
  options: ArchiveLocationOptions = {}
) {
  if (!eventId.trim() || eventId.length > 200)
    return clubEventCatalogHref(options.catalogQuery)
  const url = new URL(clubEventChallengeHref(eventId, options), 'http://local')
  url.searchParams.delete('event')
  return `/scores/events/${encodeURIComponent(eventId)}${url.search}`
}
export function clubEventPhase(
  event: { startTime: number; endTime: number; published: boolean },
  now: number
) {
  if (!event.published) return 'draft'
  if (now < event.startTime) return 'upcoming'
  return now < event.endTime ? 'live' : 'ended'
}
