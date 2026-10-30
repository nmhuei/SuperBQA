import { describe, expect, it } from 'bun:test'
import {
  buildEventMetadata,
  canCloseClubEvent,
  eventChallengeUnavailableReason,
  formatDatetimeLocal,
  parseDatetimeLocal,
  validateTiming,
} from '../../../src/lib/club/events-admin-model'
import {
  ChallengeScoringKind,
  DynamicScoringTransport,
  type AdminChallenge,
} from '@rctf/types'

describe('events-admin-model', () => {
  it('formats and parses datetime-local correctly', () => {
    const timestamp = 1730000000000
    const str = formatDatetimeLocal(timestamp)
    expect(str).toContain('T')
    const parsed = parseDatetimeLocal(str)
    expect(parsed).not.toBeNull()
  })

  it('validates event timing', () => {
    expect(validateTiming(null, null, true)).toBe('Start and end time are required.')
    expect(validateTiming(200, 100, true)).toBe('Start time must be before end time.')
    expect(validateTiming(100, 200, true)).toBeNull()
    expect(validateTiming(200, 100, false)).toBeNull()
  })

  it('checks challenge eligibility', () => {
    const validChall: AdminChallenge = {
      id: 'c1',
      name: 'Test',
      category: 'misc',
      author: 'admin',
      description: 'desc',
      files: [],
      hidden: false,
      tiebreakEligible: true,
      points: { min: 100, max: 500 },
      flags: [{ provider: 'flags/static', config: { flag: 'flag{test}' } }],
    }
    expect(eventChallengeUnavailableReason(validChall)).toBeNull()

    const dynamicChall: AdminChallenge = {
      ...validChall,
      scoring: {
        kind: ChallengeScoringKind.DYNAMIC,
        source: { transport: DynamicScoringTransport.WEBHOOK, secret: 'sec' },
      },
    }
    expect(eventChallengeUnavailableReason(dynamicChall)).toBe('Uses a live scoring feed.')
  })

  it('builds event metadata correctly', () => {
    const form = {
      name: 'Autumn CTF',
      description: 'Exciting event',
      start: '2026-11-01T10:00',
      end: '2026-11-01T18:00',
      published: true,
      clubOnly: true,
    }
    const res = buildEventMetadata(form, Date.now())
    expect(res.error).toBeNull()
    expect(res.data?.name).toBe('Autumn CTF')
    expect(res.data?.clubOnly).toBe(true)
  })

  it('canCloseClubEvent checks schedule boundaries', () => {
    const schedule = {
      startTime: 1000,
      endTime: 5000,
      archiveId: null,
    }
    expect(canCloseClubEvent(schedule, 500)).toBe(false)
    expect(canCloseClubEvent(schedule, 3000)).toBe(true)
    expect(canCloseClubEvent(schedule, 6000)).toBe(false)
  })
})
