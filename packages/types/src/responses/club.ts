import { z } from 'zod/mini'
import { response } from '../internal'

export const ClubRoleSchema = z.enum(['guest', 'member'])
export const ClubArchiveSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  createdAt: z.string(),
  challengeCount: z.int(),
  participantCount: z.int(),
  practiceChallengeCount: z.optional(z.int()),
  solvedCount: z.optional(z.int()),
})
export const ClubArchiveChallengeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  author: z.string(),
  files: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      size: z.nullable(z.number()),
    })
  ),
  points: z.number(),
  solves: z.int(),
  tags: z.array(z.string()),
  practiceAvailable: z.boolean(),
  practiceUnavailableReason: z.nullable(z.string()),
  firstSolvers: z.optional(z.array(z.object({ id: z.string() }))),
  flags: z.optional(z.array(z.string())),
})
export const ClubArchiveLeaderboardSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    division: z.string(),
    score: z.number(),
    rank: z.int(),
    solves: z.optional(
      z.array(
        z.object({
          id: z.string(),
          solveTime: z.number(),
        })
      )
    ),
    graph: z.optional(
      z.array(
        z.object({
          score: z.number(),
          time: z.number(),
        })
      )
    ),
  })
)
export const GoodClubAccess = response('goodClubAccess', {
  status: 200,
  message: 'Club access was retrieved.',
  data: z.object({
    role: ClubRoleSchema,
    canManageMembers: z.boolean(),
    canManageArchives: z.boolean(),
    canAccessArchives: z.boolean(),
  }),
})
export const GoodClubMembers = response('goodClubMembers', {
  status: 200,
  message: 'Club members were retrieved.',
  data: z.object({
    total: z.int(),
    users: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        email: z.nullable(z.string()),
        role: ClubRoleSchema,
      })
    ),
  }),
})
export const GoodClubMemberUpdate = response('goodClubMemberUpdate', {
  status: 200,
  message: 'Club membership was updated.',
  data: z.object({ id: z.string(), role: ClubRoleSchema }),
})
export const GoodClubArchives = response('goodClubArchives', {
  status: 200,
  message: 'Past events were retrieved.',
  data: z.array(ClubArchiveSummarySchema),
})
export const GoodClubArchiveCreate = response('goodClubArchiveCreate', {
  status: 200,
  message: 'The closed event was archived.',
  data: ClubArchiveSummarySchema,
})
export const GoodClubArchive = response('goodClubArchive', {
  status: 200,
  message: 'The archived event was retrieved.',
  data: z.extend(ClubArchiveSummarySchema, {
    challenges: z.array(ClubArchiveChallengeSchema),
    leaderboard: ClubArchiveLeaderboardSchema,
    solvedIds: z.array(z.string()),
  }),
})
export const GoodClubPractice = response('goodClubPractice', {
  status: 200,
  message: 'The practice flag was checked.',
  data: z.object({ result: z.enum(['correct', 'incorrect', 'alreadySolved']) }),
})
export const BadClubEventActive = response('badClubEventActive', {
  status: 409,
  message: 'Close the current event before creating an archive.',
})
export const BadClubArchive = response('badClubArchive', {
  status: 404,
  message: 'The archived event or challenge was not found.',
})
export const BadClubPracticeUnavailable = response(
  'badClubPracticeUnavailable',
  {
    status: 409,
    message: 'This challenge cannot be replayed in archived practice.',
  }
)
