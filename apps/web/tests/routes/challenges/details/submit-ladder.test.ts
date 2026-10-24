import {
  resolveSubmitState,
  type SubmitLadderInput,
  type SubmitState,
} from '$routes/challenges/details/submit-ladder'
import { describe, expect, test } from 'bun:test'

function input(overrides: Partial<SubmitLadderInput> = {}): SubmitLadderInput {
  return {
    clubMode: 'event',
    isArchived: false,
    endTime: 100,
    now: 50,
    isAuthenticated: true,
    isSolved: false,
    ...overrides,
  }
}

describe('resolveSubmitState', () => {
  test.each<[string, Partial<SubmitLadderInput>, SubmitState]>([
    [
      'archived beats everything',
      { isArchived: true, now: 200, isAuthenticated: false, isSolved: true },
      'archived',
    ],
    ['archived beats solved', { isArchived: true, isSolved: true }, 'archived'],
    ['club mode closes scheduled live event', { clubMode: 'club' }, 'ended'],
    [
      'club mode beats login',
      { clubMode: 'club', isAuthenticated: false },
      'ended',
    ],
    ['club mode beats solved', { clubMode: 'club', isSolved: true }, 'ended'],
    ['ended beats login', { now: 200, isAuthenticated: false }, 'ended'],
    ['ended beats solved', { now: 200, isSolved: true }, 'ended'],
    ['ended beats form', { now: 200 }, 'ended'],
    [
      'ended when unauthenticated',
      { now: 200, isAuthenticated: false },
      'ended',
    ],
    ['login when unauthenticated', { isAuthenticated: false }, 'login'],
    ['login beats solved', { isAuthenticated: false, isSolved: true }, 'login'],
    ['solved when solved', { isSolved: true }, 'solved'],
    ['form otherwise', {}, 'form'],
  ])('%s', (_label, overrides, expected) => {
    expect(resolveSubmitState(input(overrides))).toBe(expected)
  })

  describe('ended boundary (matches API endTime cutoff)', () => {
    test('now === endTime is ended', () => {
      expect(resolveSubmitState(input({ now: 100, endTime: 100 }))).toBe(
        'ended'
      )
    })

    test('now === endTime closes submission before login', () => {
      expect(
        resolveSubmitState(
          input({ now: 100, endTime: 100, isAuthenticated: false })
        )
      ).toBe('ended')
    })

    test('now === endTime + 1 is ended', () => {
      expect(resolveSubmitState(input({ now: 101, endTime: 100 }))).toBe(
        'ended'
      )
    })
  })
})
