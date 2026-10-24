import {
  BadAlreadySolvedChallenge,
  BadFlag,
  BadRateLimit,
  GoodClubPractice,
  GoodFlag,
  type ResponseBody,
} from '@rctf/types'
import { createSolveCelebrations } from '$lib/club/celebration'
import { describe, expect, test } from 'bun:test'

const goodFlag = { kind: GoodFlag.kind, message: GoodFlag.message }
const practice = (
  result: 'correct' | 'incorrect' | 'alreadySolved'
): ResponseBody<typeof GoodClubPractice> => ({
  kind: GoodClubPractice.kind,
  message: GoodClubPractice.message,
  data: { result },
})
const clubEvent = (result: 'correct' | 'incorrect' | 'alreadySolved') => ({
  kind: 'goodClubEventSubmit' as const,
  message: 'The event flag was checked.',
  data: { result },
})

function setup() {
  const celebrations = createSolveCelebrations()
  celebrations.setUser('alice')
  const request = celebrations.capture({
    userId: 'alice',
    mode: 'event',
    eventId: 'event-1',
    challengeId: 'challenge-1',
    title: 'Cookie Jar',
  })
  return { celebrations, request }
}

describe('confirmed solve celebrations', () => {
  test('accepts a confirmed event flag once, without inventing awarded points', () => {
    const { celebrations, request } = setup()
    const received: unknown[] = []
    celebrations.subscribe(event => received.push(event))
    expect(celebrations.acceptEvent(request, goodFlag)).toBe(true)
    expect(celebrations.acceptEvent(request, goodFlag)).toBe(false)
    expect(received).toEqual([
      { title: 'Cookie Jar', result: 'Challenge solved', practice: false },
    ])
  })

  test('incorrect, already solved, and rate-limited event responses do not celebrate or consume the solve', () => {
    const { celebrations, request } = setup()
    expect(
      celebrations.acceptEvent(request, {
        kind: BadFlag.kind,
        message: BadFlag.message,
      })
    ).toBe(false)
    expect(
      celebrations.acceptEvent(request, {
        kind: BadAlreadySolvedChallenge.kind,
        message: BadAlreadySolvedChallenge.message,
      })
    ).toBe(false)
    expect(
      celebrations.acceptEvent(request, {
        kind: BadRateLimit.kind,
        message: BadRateLimit.message,
        data: { timeLeft: 1000 },
      })
    ).toBe(false)
    expect(celebrations.acceptEvent(request, goodFlag)).toBe(true)
  })

  test('practice only celebrates a newly correct response, separately from event solves', () => {
    const { celebrations, request } = setup()
    const archived = celebrations.capture({
      ...request!,
      mode: 'practice',
      eventId: 'event-1',
    })
    expect(celebrations.acceptEvent(request, goodFlag)).toBe(true)
    expect(celebrations.acceptPractice(archived, practice('incorrect'))).toBe(
      false
    )
    expect(
      celebrations.acceptPractice(archived, practice('alreadySolved'))
    ).toBe(false)
    const received: unknown[] = []
    celebrations.subscribe(event => received.push(event))
    expect(celebrations.acceptPractice(archived, practice('correct'))).toBe(
      true
    )
    expect(celebrations.acceptPractice(archived, practice('correct'))).toBe(
      false
    )
    expect(received).toEqual([
      { title: 'Cookie Jar', result: 'Practice complete', practice: true },
    ])
  })

  test('the same challenge can celebrate in a different event or archive', () => {
    const { celebrations, request } = setup()
    expect(celebrations.acceptEvent(request, goodFlag)).toBe(true)
    const nextEvent = celebrations.capture({ ...request!, eventId: 'event-2' })
    expect(celebrations.acceptEvent(nextEvent, goodFlag)).toBe(true)
    for (const eventId of ['archive-1', 'archive-2']) {
      const archived = celebrations.capture({
        ...request!,
        mode: 'practice',
        eventId,
      })
      expect(celebrations.acceptPractice(archived, practice('correct'))).toBe(
        true
      )
    }
  })

  test('private events celebrate only a newly accepted event solve', () => {
    const { celebrations, request } = setup()
    const event = celebrations.capture({ ...request!, eventId: 'club:event-1' })
    const received: unknown[] = []
    celebrations.subscribe(value => received.push(value))
    expect(celebrations.acceptClubEvent(event, clubEvent('incorrect'))).toBe(
      false
    )
    expect(
      celebrations.acceptClubEvent(event, clubEvent('alreadySolved'))
    ).toBe(false)
    expect(
      celebrations.acceptClubEvent(event, {
        kind: BadRateLimit.kind,
        message: BadRateLimit.message,
        data: { timeLeft: 1000 },
      })
    ).toBe(false)
    expect(received).toEqual([])
    expect(celebrations.acceptClubEvent(event, clubEvent('correct'))).toBe(true)
    expect(celebrations.acceptClubEvent(event, clubEvent('correct'))).toBe(
      false
    )
    expect(received).toEqual([
      { title: 'Cookie Jar', result: 'Challenge solved', practice: false },
    ])
  })

  test('private event completion stays separate from practice and rejects the wrong mode', () => {
    const { celebrations, request } = setup()
    const event = celebrations.capture({ ...request!, eventId: 'club:event-1' })
    const archived = celebrations.capture({
      ...request!,
      mode: 'practice',
      eventId: 'event-1',
    })
    expect(celebrations.acceptClubEvent(archived, clubEvent('correct'))).toBe(
      false
    )
    expect(celebrations.acceptPractice(event, practice('correct'))).toBe(false)
    expect(celebrations.acceptClubEvent(event, clubEvent('correct'))).toBe(true)
    expect(celebrations.acceptPractice(archived, practice('correct'))).toBe(
      true
    )
    expect(celebrations.acceptEvent(request, goodFlag)).toBe(true)
  })

  test('private event responses cannot celebrate after the member session ends', () => {
    const { celebrations, request } = setup()
    const event = celebrations.capture({ ...request!, eventId: 'club:event-1' })
    celebrations.setUser(null)
    celebrations.setUser('alice')
    expect(celebrations.acceptClubEvent(event, clubEvent('correct'))).toBe(
      false
    )
  })

  test('logout clears the display and rejects a late response even after the same user logs back in', () => {
    const { celebrations, request } = setup()
    expect(celebrations.acceptEvent(request, goodFlag)).toBe(true)
    const received: unknown[] = []
    celebrations.subscribe(event => received.push(event))
    celebrations.setUser(null)
    expect(received).toEqual([null])
    celebrations.setUser('alice')
    expect(celebrations.acceptEvent(request, goodFlag)).toBe(false)
    const fresh = celebrations.capture({ ...request! })
    expect(celebrations.acceptEvent(fresh, goodFlag)).toBe(true)
  })

  test('switching users rejects previous requests and does not inherit their deduplication', () => {
    const { celebrations, request } = setup()
    expect(celebrations.acceptEvent(request, goodFlag)).toBe(true)
    celebrations.setUser('bob')
    expect(celebrations.acceptEvent(request, goodFlag)).toBe(false)
    expect(celebrations.capture({ ...request! })).toBeNull()
    const bob = celebrations.capture({ ...request!, userId: 'bob' })
    expect(celebrations.acceptEvent(bob, goodFlag)).toBe(true)
  })

  test('refreshing the current user preserves deduplication', () => {
    const { celebrations, request } = setup()
    expect(celebrations.acceptEvent(request, goodFlag)).toBe(true)
    celebrations.setUser('alice')
    expect(celebrations.acceptEvent(request, goodFlag)).toBe(false)
  })

  test('missing identity and mismatched response modes cannot celebrate', () => {
    const { celebrations, request } = setup()
    expect(celebrations.capture({ ...request!, challengeId: '' })).toBeNull()
    expect(celebrations.capture({ ...request!, eventId: '' })).toBeNull()
    expect(celebrations.acceptEvent(null, goodFlag)).toBe(false)
    expect(celebrations.acceptPractice(request, practice('correct'))).toBe(
      false
    )
    const archived = celebrations.capture({ ...request!, mode: 'practice' })
    expect(celebrations.acceptEvent(archived, goodFlag)).toBe(false)
  })
})
