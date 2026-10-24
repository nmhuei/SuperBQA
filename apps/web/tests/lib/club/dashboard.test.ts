import { describe, expect, test } from 'bun:test'
import {
  getEventCountdown,
  getEventPhase,
  getMissionProgress,
} from '../../../src/lib/club/dashboard'

describe('getEventPhase', () => {
  const config = { startTime: 1_000, endTime: 5_000, isArchived: false }

  test('opens at the start and closes exactly at the end', () => {
    expect(getEventPhase(config, 999)).toBe('upcoming')
    expect(getEventPhase(config, 1_000)).toBe('live')
    expect(getEventPhase(config, 4_999)).toBe('live')
    expect(getEventPhase(config, 5_000)).toBe('ended')
  })

  test('an archived event stays read-only regardless of its schedule', () => {
    expect(getEventPhase({ ...config, isArchived: true }, 2_000)).toBe(
      'archived'
    )
  })

  test('an unset or invalid event window never advertises live submissions', () => {
    expect(getEventPhase({ ...config, startTime: 0, endTime: 0 }, 2_000)).toBe(
      'idle'
    )
    expect(getEventPhase({ ...config, startTime: 6_000 }, 2_000)).toBe('idle')
  })
})

describe('getEventCountdown', () => {
  const config = { startTime: 1_000, endTime: 3_662_000, isArchived: false }

  test('counts down to the start and then the end in English', () => {
    expect(getEventCountdown(config, 0)).toBe('00:00:01')
    expect(getEventCountdown(config, 1_000)).toBe('01:01:01')
    expect(getEventCountdown({ ...config, endTime: 90_062_000 }, 1_000)).toBe(
      '1d 01:01:01'
    )
  })

  test('does not show a negative or misleading countdown after closure', () => {
    expect(getEventCountdown(config, config.endTime)).toBe('Closed')
    expect(getEventCountdown({ ...config, isArchived: true }, 1_000)).toBe(
      'Read only'
    )
    expect(getEventCountdown({ ...config, endTime: 0 }, 1_000)).toBe(
      'Not scheduled'
    )
  })
})

describe('getMissionProgress', () => {
  test('counts visible flag challenges once and ignores hidden solves', () => {
    const challenges = [
      { id: 'web-1', hasFlag: true },
      { id: 'web-1', hasFlag: true },
      { id: 'crypto-1', hasFlag: true },
      { id: 'koth-1', hasFlag: false },
    ]
    const solves = [
      { id: 'web-1' },
      { id: 'web-1' },
      { id: 'hidden' },
      { id: 'koth-1' },
    ]
    expect(getMissionProgress(challenges, solves)).toEqual({
      solved: 1,
      total: 2,
      percent: 50,
    })
  })

  test('empty and unauthenticated states have finite zero progress', () => {
    expect(getMissionProgress([], undefined)).toEqual({
      solved: 0,
      total: 0,
      percent: 0,
    })
    expect(getMissionProgress([{ id: 'one', hasFlag: true }], null)).toEqual({
      solved: 0,
      total: 1,
      percent: 0,
    })
  })
})
