import { ChallengeScoringKind, type AdminChallenge } from '@rctf/types'

export function formatDatetimeLocal(
  timestamp: number | null | undefined
): string {
  if (timestamp === null || timestamp === undefined) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => value.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function parseDatetimeLocal(value: string): number | null {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

export function validateTiming(
  start: number | null,
  end: number | null,
  active: boolean
): string | null {
  if (!active) return null
  if (start === null || end === null) {
    return 'Start and end time are required.'
  }
  if (start >= end) {
    return 'Start time must be before end time.'
  }
  return null
}

export function eventChallengeUnavailableReason(
  challenge: AdminChallenge
): string | null {
  if (challenge.instancerConfig || challenge.adminBotConfig)
    return 'Requires a live instance or admin bot.'
  if (challenge.scoring?.kind === ChallengeScoringKind.DYNAMIC)
    return 'Uses a live scoring feed.'
  if (
    !challenge.flags.length ||
    challenge.flags.some(
      entry =>
        (entry.provider ?? 'flags/static') !== 'flags/static' ||
        typeof entry.config.flag !== 'string' ||
        !entry.config.flag.length
    )
  )
    return 'Requires supported static flags.'
  if (!Number.isFinite(challenge.points.max) || challenge.points.max < 0)
    return 'Requires valid fixed points.'
  return null
}

export interface EventForm {
  name: string
  description: string
  start: string
  end: string
  published: boolean
  clubOnly: boolean
}

export interface EventSchedule {
  startTime: number
  endTime: number
  archiveId: string | null
}

export function buildEventMetadata(
  form: EventForm,
  now: number,
  current?: EventSchedule
) {
  const invalid = (error: string) => ({ data: null, error })
  if (current?.archiveId) return invalid('Archived events cannot be changed.')
  if (!form.name.trim()) return invalid('Enter an event name.')
  if (
    current &&
    now >= current.startTime &&
    form.start !== formatDatetimeLocal(current.startTime)
  )
    return invalid('The start time cannot change after the event has begun.')
  const startTime =
    current && form.start === formatDatetimeLocal(current.startTime)
      ? current.startTime
      : parseDatetimeLocal(form.start)
  const endTime =
    current && form.end === formatDatetimeLocal(current.endTime)
      ? current.endTime
      : parseDatetimeLocal(form.end)
  const timingError = validateTiming(startTime, endTime, true)
  if (timingError || startTime === null || endTime === null)
    return invalid(timingError ?? 'Enter a valid schedule.')
  return {
    data: {
      name: form.name.trim(),
      description: form.description,
      startTime,
      endTime,
      published: form.published,
      clubOnly: form.clubOnly,
    },
    error: null,
  }
}

export function canCloseClubEvent(event: EventSchedule, now: number): boolean {
  return !event.archiveId && now > event.startTime && now < event.endTime
}
