import {
  createPracticeSubmissionGuard,
  type PracticeContext,
} from '$lib/club/practice-submission'
import { describe, expect, test } from 'bun:test'

function setup() {
  let context: PracticeContext = {
    userId: 'alice',
    archiveId: 'spring',
    challengeId: 'shared-challenge',
    allowed: true,
  }
  const guard = createPracticeSubmissionGuard(() => context)
  const applied: string[] = []
  let resolve!: () => void
  const response = new Promise<void>(done => {
    resolve = done
  })
  const request = guard.capture()
  const completion = response.then(() => {
    if (guard.isCurrent(request))
      applied.push(
        `${request!.userId}/${request!.archiveId}/${request!.challengeId}`
      )
  })
  return {
    guard,
    request,
    applied,
    async finish() {
      resolve()
      await completion
    },
    change(patch: Partial<PracticeContext>) {
      context = { ...context, ...patch }
      guard.refresh()
    },
  }
}

describe('archive practice request ownership', () => {
  test('applies a delayed response to its still-active member and challenge', async () => {
    const state = setup()
    await state.finish()
    expect(state.applied).toEqual(['alice/spring/shared-challenge'])
  })

  test('rejects a delayed response after switching to an archive with the same challenge ID', async () => {
    const state = setup()
    state.change({ archiveId: 'autumn' })
    await state.finish()
    expect(state.applied).toEqual([])
  })

  test('switching practice to a private event retires the old response even when IDs match', async () => {
    const state = setup()
    state.change({ mode: 'event' })
    state.change({ mode: 'practice' })
    await state.finish()
    expect(state.applied).toEqual([])
  })

  test('captures the private event namespace and rejects it in practice mode', () => {
    const state = setup()
    state.change({ mode: 'event' })
    const request = state.guard.capture()
    expect(request?.mode).toBe('event')
    state.change({ mode: 'practice' })
    expect(state.guard.isCurrent(request)).toBe(false)
  })

  test('rejects an earlier challenge response even after returning to that challenge', async () => {
    const state = setup()
    state.change({ challengeId: 'another-challenge' })
    state.change({ challengeId: 'shared-challenge' })
    await state.finish()
    expect(state.applied).toEqual([])
  })

  test('logout and same-user login cannot revive an earlier request', async () => {
    const state = setup()
    state.change({ userId: null })
    state.change({ userId: 'alice' })
    await state.finish()
    expect(state.applied).toEqual([])
  })

  test('rejects another member receiving the previous member response', async () => {
    const state = setup()
    state.change({ userId: 'bob' })
    await state.finish()
    expect(state.applied).toEqual([])
  })

  test('revocation or access-query failure retires a request even if access is restored', async () => {
    const state = setup()
    state.change({ allowed: false })
    state.change({ allowed: true })
    await state.finish()
    expect(state.applied).toEqual([])
  })

  test('unmounting retires pending work permanently', async () => {
    const state = setup()
    state.guard.dispose()
    await state.finish()
    expect(state.applied).toEqual([])
    expect(state.guard.capture()).toBeNull()
  })

  test('only the latest request can update the same challenge', async () => {
    const state = setup()
    const latest = state.guard.capture()
    await state.finish()
    expect(state.applied).toEqual([])
    expect(state.guard.isCurrent(latest)).toBe(true)
  })

  test('checks current identity at completion even before a reactive refresh', () => {
    let current: PracticeContext = {
      userId: 'alice',
      archiveId: 'spring',
      challengeId: 'shared-challenge',
      allowed: true,
    }
    const guard = createPracticeSubmissionGuard(() => current)
    const request = guard.capture()
    current = { ...current, userId: 'bob' }
    expect(guard.isCurrent(request)).toBe(false)
  })

  test.each([
    { userId: null },
    { archiveId: '' },
    { challengeId: '' },
    { allowed: false },
  ])('does not capture a request without valid practice context: %j', patch => {
    const state = setup()
    state.change(patch)
    expect(state.guard.capture()).toBeNull()
    expect(state.guard.isCurrent(state.request)).toBe(false)
  })
})
