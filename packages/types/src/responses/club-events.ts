import { z } from 'zod/mini'
import { response } from '../internal'
import {
  ClubArchiveChallengeSchema,
  ClubArchiveLeaderboardSchema,
} from './club'

export const ClubEventSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  createdAt: z.string(),
  published: z.boolean(),
  challengeCount: z.int(),
  participantCount: z.int(),
  archiveId: z.nullable(z.string()),
  solvedCount: z.optional(z.int()),
})
export type ClubEventSummary = z.infer<typeof ClubEventSummarySchema>
export const GoodClubEvents = response('goodClubEvents', {
  status: 200,
  message: 'Club events were retrieved.',
  data: z.array(ClubEventSummarySchema),
})
export const GoodClubEventCreate = response('goodClubEventCreate', {
  status: 200,
  message: 'The club event was created.',
  data: ClubEventSummarySchema,
})
export const GoodClubEventUpdate = response('goodClubEventUpdate', {
  status: 200,
  message: 'The club event was updated.',
  data: ClubEventSummarySchema,
})
export const GoodClubEvent = response('goodClubEvent', {
  status: 200,
  message: 'The club event was retrieved.',
  data: z.extend(ClubEventSummarySchema, {
    challenges: z.array(ClubArchiveChallengeSchema),
    leaderboard: ClubArchiveLeaderboardSchema,
    solvedIds: z.array(z.string()),
  }),
})
export const GoodClubEventSubmit = response('goodClubEventSubmit', {
  status: 200,
  message: 'The event flag was checked.',
  data: z.object({ result: z.enum(['correct', 'incorrect', 'alreadySolved']) }),
})
export const GoodClubEventArchive = response('goodClubEventArchive', {
  status: 200,
  message: 'The club event was archived.',
  data: z.object({ id: z.string() }),
})
export const BadClubEvent = response('badClubEvent', {
  status: 404,
  message: 'The club event or challenge was not found.',
})
export const BadClubEventSchedule = response('badClubEventSchedule', {
  status: 400,
  message:
    'The schedule is invalid, or the start time was changed after the event began.',
})
export const BadClubEventSelection = response('badClubEventSelection', {
  status: 400,
  message:
    'Select existing, distinct challenges with static flags and no live service dependencies.',
})
export const BadClubEventClosed = response('badClubEventClosed', {
  status: 409,
  message:
    'This action is not available in the current event state. Submissions require a published event within its schedule; archiving requires an ended event.',
})
export const BadClubEventFrozen = response('badClubEventFrozen', {
  status: 409,
  message: 'An archived club event cannot be changed.',
})
