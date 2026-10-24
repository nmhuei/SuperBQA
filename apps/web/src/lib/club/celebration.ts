import {
  GoodClubEventSubmit,
  GoodClubPractice,
  GoodFlag,
  type RouteResponse,
  type SubmitClubPracticeRouteV2,
  type SubmitClubEventRouteV2,
  type SubmitFlagRoute,
} from '@rctf/types'

export const solveCelebrationContext = Symbol('solve-celebrations')

interface SolveIdentity {
  userId: string
  mode: 'event' | 'practice'
  eventId: string
  challengeId: string
  title: string
}

export interface SolveRequest extends SolveIdentity {
  session: number
}

export interface SolveCelebration {
  title: string
  result: 'Challenge solved' | 'Practice complete'
  practice: boolean
}

// One controller belongs to one root layout, never to a shared SSR module.
export function createSolveCelebrations() {
  let userId: string | null = null
  let session = 0
  const completed = new Set<string>()
  const listeners = new Set<(event: SolveCelebration | null) => void>()

  function setUser(nextUserId: string | null) {
    if (nextUserId === userId) return
    userId = nextUserId
    session += 1
    completed.clear()
    for (const listener of listeners) listener(null)
  }

  function capture(identity: SolveIdentity): SolveRequest | null {
    if (
      !userId ||
      identity.userId !== userId ||
      !identity.eventId.trim() ||
      !identity.challengeId.trim()
    )
      return null
    return { ...identity, session }
  }

  function accept(request: SolveRequest | null, mode: SolveIdentity['mode']) {
    if (
      !request ||
      request.mode !== mode ||
      request.session !== session ||
      request.userId !== userId
    )
      return false
    const key = JSON.stringify([
      userId,
      mode,
      request.eventId,
      request.challengeId,
    ])
    if (completed.has(key)) return false
    completed.add(key)
    const practice = mode === 'practice'
    // Neither success API returns awarded points. Never infer them from a
    // challenge's pre-solve value, especially with dynamic scoring.
    const event: SolveCelebration = {
      title: request.title.trim() || 'Challenge',
      result: practice ? 'Practice complete' : 'Challenge solved',
      practice,
    }
    for (const listener of listeners) listener(event)
    return true
  }

  return {
    setUser,
    capture,
    subscribe(listener: (event: SolveCelebration | null) => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    acceptEvent(
      request: SolveRequest | null,
      response: RouteResponse<typeof SubmitFlagRoute>
    ) {
      return response.kind === GoodFlag.kind && accept(request, 'event')
    },
    acceptPractice(
      request: SolveRequest | null,
      response: RouteResponse<typeof SubmitClubPracticeRouteV2>
    ) {
      return (
        response.kind === GoodClubPractice.kind &&
        response.data.result === 'correct' &&
        accept(request, 'practice')
      )
    },
    acceptClubEvent(
      request: SolveRequest | null,
      response: RouteResponse<typeof SubmitClubEventRouteV2>
    ) {
      return (
        response.kind === GoodClubEventSubmit.kind &&
        response.data.result === 'correct' &&
        accept(request, 'event')
      )
    },
  }
}

export type SolveCelebrations = ReturnType<typeof createSolveCelebrations>
