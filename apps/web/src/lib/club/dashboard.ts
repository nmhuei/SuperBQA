export type EventPhase = 'upcoming' | 'live' | 'ended' | 'archived' | 'idle'

type EventSchedule = {
  startTime: number
  endTime: number
  isArchived: boolean
}

export function getEventPhase(config: EventSchedule, now: number): EventPhase {
  if (config.isArchived) return 'archived'
  if (config.endTime <= config.startTime) return 'idle'
  if (now < config.startTime) return 'upcoming'
  return now < config.endTime ? 'live' : 'ended'
}

export function getEventCountdown(config: EventSchedule, now: number): string {
  const phase = getEventPhase(config, now)
  if (phase === 'archived') return 'Read only'
  if (phase === 'idle') return 'Not scheduled'
  if (phase === 'ended') return 'Closed'

  const target = phase === 'upcoming' ? config.startTime : config.endTime
  const total = Math.max(0, Math.floor((target - now) / 1000))
  const days = Math.floor(total / 86_400)
  const clock = [
    Math.floor((total % 86_400) / 3600),
    Math.floor((total % 3600) / 60),
    total % 60,
  ]
    .map(part => String(part).padStart(2, '0'))
    .join(':')
  return days > 0 ? `${days}d ${clock}` : clock
}

export function getMissionProgress(
  challenges: readonly { id: string; hasFlag: boolean }[],
  solves: readonly { id: string }[] | null | undefined
): { solved: number; total: number; percent: number } {
  const visible = new Set(
    challenges
      .filter(challenge => challenge.hasFlag)
      .map(challenge => challenge.id)
  )
  const completed = new Set(
    (solves ?? []).map(solve => solve.id).filter(id => visible.has(id))
  )
  return {
    solved: completed.size,
    total: visible.size,
    percent:
      visible.size === 0
        ? 0
        : Math.round((completed.size / visible.size) * 100),
  }
}
