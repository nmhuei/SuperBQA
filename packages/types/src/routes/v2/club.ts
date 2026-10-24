import { z } from 'zod/mini'
import { Permissions } from '../../enums/permissions'
import { defineRoute } from '../../internal'
import {
  BadBody,
  BadPerms,
  BadToken,
  BadUnknownUser,
  BadRateLimit,
} from '../../responses'
import {
  ClubRoleSchema,
  GoodClubAccess,
  GoodClubMembers,
  GoodClubMemberUpdate,
  GoodClubArchives,
  GoodClubArchiveCreate,
  GoodClubArchive,
  GoodClubPractice,
  BadClubEventActive,
  BadClubArchive,
  BadClubPracticeUnavailable,
} from '../../responses/club'

export const GetClubAccessRouteV2 = defineRoute({
  path: '/v2/club/access',
  method: 'GET',
  optionalAuth: true,
  goodResponses: [GoodClubAccess],
})
export const GetClubMembersRouteV2 = defineRoute({
  path: '/v2/club/members',
  method: 'GET',
  authRequired: true,
  permissions: Permissions.usersWrite,
  query: z.object({
    search: z.optional(z.string().check(z.maxLength(100))),
    limit: z._default(
      z.pipe(z.coerce.number(), z.int().check(z.gte(1), z.lte(100))),
      50
    ),
    offset: z._default(
      z.pipe(z.coerce.number(), z.int().check(z.gte(0), z.lte(1000000))),
      0
    ),
  }),
  goodResponses: [GoodClubMembers],
  badResponses: [BadBody, BadPerms, BadToken],
})
export const UpdateClubMemberRouteV2 = defineRoute({
  path: '/v2/club/members/:id',
  method: 'PUT',
  authRequired: true,
  permissions: Permissions.usersWrite,
  params: z.object({ id: z.string() }),
  body: z.object({ role: ClubRoleSchema }),
  goodResponses: [GoodClubMemberUpdate],
  badResponses: [BadBody, BadPerms, BadToken, BadUnknownUser],
})
export const GetClubArchivesRouteV2 = defineRoute({
  path: '/v2/club/archives',
  method: 'GET',
  authRequired: true,
  rejectBanned: true,
  goodResponses: [GoodClubArchives],
  badResponses: [BadPerms, BadToken],
})
export const CreateClubArchiveRouteV2 = defineRoute({
  path: '/v2/club/archives',
  method: 'POST',
  authRequired: true,
  permissions: Permissions.settingsWrite,
  body: z.object({
    name: z.optional(
      z.string().check(z.trim(), z.minLength(1), z.maxLength(200))
    ),
    description: z.optional(z.string().check(z.maxLength(5000))),
  }),
  goodResponses: [GoodClubArchiveCreate],
  badResponses: [BadBody, BadPerms, BadToken, BadClubEventActive],
})
export const GetClubArchiveRouteV2 = defineRoute({
  path: '/v2/club/archives/:id',
  method: 'GET',
  authRequired: true,
  rejectBanned: true,
  params: z.object({ id: z.string() }),
  goodResponses: [GoodClubArchive],
  badResponses: [BadBody, BadPerms, BadToken, BadClubArchive],
})
export const SubmitClubPracticeRouteV2 = defineRoute({
  path: '/v2/club/archives/:id/challenges/:challengeId/submit',
  method: 'POST',
  authRequired: true,
  rejectBanned: true,
  params: z.object({ id: z.string(), challengeId: z.string() }),
  body: z.object({
    flag: z.string().check(z.minLength(1), z.maxLength(10000)),
  }),
  goodResponses: [GoodClubPractice],
  badResponses: [
    BadBody,
    BadPerms,
    BadToken,
    BadClubArchive,
    BadClubPracticeUnavailable,
    BadRateLimit,
  ],
})
