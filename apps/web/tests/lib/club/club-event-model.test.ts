import { expect, test } from 'bun:test'
import {
  clubEventCatalogHref,
  clubEventChallengeHref,
  clubEventScoreboardHref,
  parseClubEventLocation,
  clubEventPhase,
} from '../../../src/lib/club/club-event-model'

test('club event links never inherit archive scope or unsafe destinations', () => {
  const href = clubEventChallengeHref('event/a', {
    challengeId: 'signal',
    query: 'Web',
    catalogQuery: '//foreign',
    hideSolved: true,
  })
  const url = new URL(href, 'http://local')
  expect(url.searchParams.has('archive')).toBe(false)
  expect(parseClubEventLocation(url)).toEqual({
    eventId: 'event/a',
    challengeId: 'signal',
    query: 'Web',
    hideSolved: true,
    catalogQuery: '//foreign',
  })
  expect(clubEventCatalogHref('July')).toBe('/club/events?q=July')
  expect(clubEventChallengeHref('')).toBe('/club/events')
  expect(clubEventScoreboardHref('event/a', { challengeId: 'signal' })).toBe(
    '/scores/events/event%2Fa?challenge=signal'
  )
})
test('private event boundaries are start-inclusive end-exclusive and drafts stay closed', () => {
  const event = { startTime: 100, endTime: 200, published: true }
  expect(clubEventPhase(event, 99)).toBe('upcoming')
  expect(clubEventPhase(event, 100)).toBe('live')
  expect(clubEventPhase(event, 199)).toBe('live')
  expect(clubEventPhase(event, 200)).toBe('ended')
  expect(clubEventPhase({ ...event, published: false }, 150)).toBe('draft')
})
