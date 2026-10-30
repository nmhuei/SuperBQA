import { expect, test } from 'bun:test'
import {
  clubEventCatalogHref,
  clubEventChallengeHref,
  clubEventScoreboardHref,
  parseClubEventLocation,
  clubEventPhase,
  prioritizeClubEvents,
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

test('prioritizeClubEvents orders active events first and prefers the earliest active when multiple are live', () => {
  const events = [
    { id: 'ended-1', startTime: 100, endTime: 200, published: true },
    { id: 'live-later', startTime: 250, endTime: 500, published: true },
    { id: 'live-earlier', startTime: 210, endTime: 450, published: true },
    { id: 'upcoming-1', startTime: 600, endTime: 700, published: true },
    { id: 'ended-old', startTime: 50, endTime: 90, published: true },
  ]

  // At now = 300: live-earlier (started at 210) and live-later (started at 250) are both live
  const sorted = prioritizeClubEvents(events, 300)
  expect(sorted.map(e => e.id)).toEqual([
    'live-earlier', // active earliest
    'live-later',   // active later
    'upcoming-1',   // upcoming
    'ended-1',      // ended more recently (endTime 200)
    'ended-old',    // ended older (endTime 90)
  ])
})

test('prioritizeClubEvents handles no active events by picking upcoming or most recently ended', () => {
  const events = [
    { id: 'ended-old', startTime: 50, endTime: 90, published: true },
    { id: 'ended-recent', startTime: 100, endTime: 200, published: true },
    { id: 'upcoming-soon', startTime: 300, endTime: 400, published: true },
  ]

  // At now = 250: no live events
  const sorted = prioritizeClubEvents(events, 250)
  expect(sorted.map(e => e.id)).toEqual([
    'upcoming-soon',
    'ended-recent',
    'ended-old',
  ])
})
