export interface PracticeContext {
  mode?: 'practice' | 'event'
  userId: string | null
  archiveId: string
  challengeId: string
  allowed: boolean
}

export interface PracticeRequest {
  readonly mode: 'practice' | 'event'
  readonly userId: string
  readonly archiveId: string
  readonly challengeId: string
  readonly requestId: number
}

// One guard belongs to one mounted detail. Refresh synchronously when session
// queries change so logout/relogin or revoke/restore cannot revive old work.
export function createPracticeSubmissionGuard(
  readContext: () => PracticeContext
) {
  let active: PracticeRequest | null = null
  let requestId = 0
  let disposed = false

  function refresh() {
    const current = readContext()
    if (
      active &&
      (!current.allowed ||
        (current.mode ?? 'practice') !== active.mode ||
        current.userId !== active.userId ||
        current.archiveId !== active.archiveId ||
        current.challengeId !== active.challengeId)
    )
      active = null
  }

  return {
    capture(): PracticeRequest | null {
      refresh()
      const current = readContext()
      if (
        disposed ||
        !current.allowed ||
        !current.userId ||
        !current.archiveId ||
        !current.challengeId
      )
        return null
      active = {
        mode: current.mode ?? 'practice',
        userId: current.userId,
        archiveId: current.archiveId,
        challengeId: current.challengeId,
        requestId: ++requestId,
      }
      return active
    },
    isCurrent(request: PracticeRequest | null): request is PracticeRequest {
      refresh()
      return !disposed && request !== null && request === active
    },
    refresh,
    dispose() {
      disposed = true
      active = null
    },
  }
}
