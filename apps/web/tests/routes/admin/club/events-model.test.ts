import {
  ChallengeScoringKind,
  DynamicScoringTransport,
  type AdminChallenge,
} from '@rctf/types'
import {
  buildEventMetadata,
  canCloseClubEvent,
  eventChallengeUnavailableReason,
} from '../../../../src/routes/admin/club/events/events-model'
import { formatDatetimeLocal } from '../../../../src/routes/admin/settings/settings-model'
import { describe, expect, test } from 'bun:test'

const challenge: AdminChallenge = {
  id: 'a',
  name: 'A',
  description: '',
  category: 'web',
  author: '',
  files: [],
  flags: [{ provider: 'flags/static', config: { flag: 'test-only-flag' } }],
  points: { min: 100, max: 500 },
  hidden: false,
  tiebreakEligible: true,
}

describe('private event challenge eligibility', () => {
  test('accepts static snapshots while excluding unsupported flag providers', () => {
    expect(eventChallengeUnavailableReason(challenge)).toBeNull()
    expect(
      eventChallengeUnavailableReason({ ...challenge, flags: [] })
    ).not.toBeNull()
    expect(
      eventChallengeUnavailableReason({
        ...challenge,
        flags: [{ provider: 'flags/remote', config: {} }],
      })
    ).not.toBeNull()
  })

  test('rejects live scoring and missing static flag values', () => {
    expect(
      eventChallengeUnavailableReason({
        ...challenge,
        scoring: {
          kind: ChallengeScoringKind.DYNAMIC,
          source: {
            transport: DynamicScoringTransport.WEBHOOK,
            secret: 'test-only-secret',
          },
        },
      })
    ).not.toBeNull()
    expect(
      eventChallengeUnavailableReason({
        ...challenge,
        flags: [{ provider: 'flags/static', config: { flag: '' } }],
      })
    ).not.toBeNull()
    expect(
      eventChallengeUnavailableReason({
        ...challenge,
        points: { min: 0, max: -1 },
      })
    ).not.toBeNull()
  })

  test('rejects challenge snapshots that require an instance or admin bot', () => {
    expect(
      eventChallengeUnavailableReason({
        ...challenge,
        instancerConfig: {
          challengeIntegrationId: 'a',
          config: {},
          timeoutMilliseconds: 60000,
        },
      })
    ).not.toBeNull()
    expect(
      eventChallengeUnavailableReason({
        ...challenge,
        adminBotConfig: {
          code: 'bot',
          inputs: {},
          revision: '1',
          timeoutMilliseconds: 60000,
        },
      })
    ).not.toBeNull()
  })
})

const current = {
  startTime: 1_800_000_000_123,
  endTime: 1_800_003_600_456,
  archiveId: null,
}
const form = {
  name: '  Club Night  ',
  description: 'Details',
  published: true,
  clubOnly: true,
  start: formatDatetimeLocal(current.startTime),
  end: formatDatetimeLocal(current.endTime),
}

describe('private event schedule edits', () => {
  test('metadata edits preserve stored millisecond timestamps instead of rounding a started event', () => {
    const result = buildEventMetadata(form, current.startTime + 1000, current)
    expect(result.error).toBeNull()
    expect(result.data).toEqual({
      name: 'Club Night',
      description: 'Details',
      published: true,
      clubOnly: true,
      startTime: 1_800_000_000_123,
      endTime: 1_800_003_600_456,
    })
  })

  test('rejects changes to a start time once the event has begun', () => {
    const result = buildEventMetadata(
      { ...form, start: formatDatetimeLocal(current.startTime + 60000) },
      current.startTime,
      current
    )
    expect(result.data).toBeNull()
    expect(result.error).toBeTruthy()
  })

  test('rejects empty names and invalid or reversed schedules', () => {
    for (const patch of [
      { name: '   ' },
      { start: '' },
      { end: 'not-a-date' },
      { end: form.start },
    ]) {
      expect(buildEventMetadata({ ...form, ...patch }, 0).data).toBeNull()
    }
  })

  test('does not edit an archived event', () => {
    expect(
      buildEventMetadata(form, current.endTime + 1000, {
        ...current,
        archiveId: 'archive-a',
      }).data
    ).toBeNull()
  })

  test('close-now is only valid strictly after start and before the existing end', () => {
    expect(canCloseClubEvent(current, current.startTime - 1)).toBe(false)
    expect(canCloseClubEvent(current, current.startTime)).toBe(false)
    expect(canCloseClubEvent(current, current.startTime + 1)).toBe(true)
    expect(canCloseClubEvent(current, current.endTime)).toBe(false)
    expect(
      canCloseClubEvent(
        { ...current, archiveId: 'archive-a' },
        current.startTime + 1
      )
    ).toBe(false)
  })
})
