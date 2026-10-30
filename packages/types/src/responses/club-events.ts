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
  clubOnly: z._default(z.boolean(), false),
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
export const ClubEventSubmissionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  challengeId: z.string(),
  challengeName: z.string(),
  submittedFlag: z.optional(z.string()),
  result: z.string(),
  createdAt: z.string(),
  isSolve: z.boolean(),
  solveId: z.optional(z.string()),
})
export type ClubEventSubmission = z.infer<typeof ClubEventSubmissionSchema>

export const GoodClubEventSubmissions = response('goodClubEventSubmissions', {
  status: 200,
  message: 'Club event submissions were retrieved.',
  data: z.array(ClubEventSubmissionSchema),
})
export const GoodClubEventSolveDelete = response('goodClubEventSolveDelete', {
  status: 200,
  message: 'The club event solve was deleted.',
  data: z.object({ id: z.string() }),
})
export const GoodClubEventChallengesAdd = response('goodClubEventChallengesAdd', {
  status: 200,
  message: 'Challenges were added to the club event.',
  data: z.object({ added: z.int() }),
})
export const GoodClubEventChallengeDelete = response('goodClubEventChallengeDelete', {
  status: 200,
  message: 'The challenge was removed from the club event.',
  data: z.object({ challengeId: z.string() }),
})
export const ClubTeamProgressCategorySchema = z.object({
  category: z.string(),
  solved: z.int(),
  total: z.int(),
  percentage: z.number(),
})
export type ClubTeamProgressCategory = z.infer<
  typeof ClubTeamProgressCategorySchema
>

export const ClubTeamProgressEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  solved: z.int(),
  total: z.int(),
})
export type ClubTeamProgressEvent = z.infer<typeof ClubTeamProgressEventSchema>

export const ClubTeamProgressDataSchema = z.object({
  totalSolved: z.int(),
  totalChallenges: z.int(),
  percentage: z.number(),
  categories: z.array(ClubTeamProgressCategorySchema),
  events: z.array(ClubTeamProgressEventSchema),
})
export type ClubTeamProgressData = z.infer<typeof ClubTeamProgressDataSchema>

export const GoodClubTeamProgress = response('goodClubTeamProgress', {
  status: 200,
  message: 'Team progress was retrieved.',
  data: ClubTeamProgressDataSchema,
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
