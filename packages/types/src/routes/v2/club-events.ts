import { z } from 'zod/mini'
import { Permissions } from '../../enums/permissions'
import { defineRoute } from '../../internal'
import { BadBody, BadPerms, BadToken, BadRateLimit } from '../../responses'
import {
  GoodClubEvents,
  GoodClubEventCreate,
  GoodClubEventUpdate,
  GoodClubEvent,
  GoodClubEventSubmit,
  GoodClubEventArchive,
  BadClubEvent,
  BadClubEventSchedule,
  BadClubEventSelection,
  BadClubEventClosed,
  BadClubEventFrozen,
} from '../../responses/club-events'

const idParams = z.object({ id: z.string() })
const name = z.string().check(z.trim(), z.minLength(1), z.maxLength(200))
const description = z.string().check(z.maxLength(5000))
const time = z.int().check(z.gte(0), z.lte(8_640_000_000_000_000))
const common = { authRequired: true, rejectBanned: true } as const
const errors = [BadBody, BadPerms, BadToken, BadClubEvent] as const

export const GetClubEventsRouteV2 = defineRoute({
  ...common,
  path: '/v2/club/events',
  method: 'GET',
  goodResponses: [GoodClubEvents],
  badResponses: errors,
})
export const CreateClubEventRouteV2 = defineRoute({
  ...common,
  path: '/v2/club/events',
  method: 'POST',
  permissions: Permissions.settingsWrite,
  body: z.object({
    name,
    description: z.optional(description),
    startTime: time,
    endTime: time,
    published: z._default(z.boolean(), false),
    sourceArchiveId: z.optional(z.string()),
    challengeIds: z.array(z.string()).check(z.minLength(1), z.maxLength(1000)),
  }),
  goodResponses: [GoodClubEventCreate],
  badResponses: [...errors, BadClubEventSchedule, BadClubEventSelection],
})
export const UpdateClubEventRouteV2 = defineRoute({
  ...common,
  path: '/v2/club/events/:id',
  method: 'PATCH',
  permissions: Permissions.settingsWrite,
  params: idParams,
  body: z.object({
    name: z.optional(name),
    description: z.optional(description),
    startTime: z.optional(time),
    endTime: z.optional(time),
    published: z.optional(z.boolean()),
  }),
  goodResponses: [GoodClubEventUpdate],
  badResponses: [...errors, BadClubEventSchedule, BadClubEventFrozen],
})
export const GetClubEventRouteV2 = defineRoute({
  ...common,
  path: '/v2/club/events/:id',
  method: 'GET',
  params: idParams,
  goodResponses: [GoodClubEvent],
  badResponses: errors,
})
export const SubmitClubEventRouteV2 = defineRoute({
  ...common,
  path: '/v2/club/events/:id/challenges/:challengeId/submit',
  method: 'POST',
  params: z.object({ id: z.string(), challengeId: z.string() }),
  body: z.object({
    flag: z.string().check(z.minLength(1), z.maxLength(10000)),
  }),
  goodResponses: [GoodClubEventSubmit],
  badResponses: [...errors, BadClubEventClosed, BadRateLimit],
})
export const ArchiveClubEventRouteV2 = defineRoute({
  ...common,
  path: '/v2/club/events/:id/archive',
  method: 'POST',
  permissions: Permissions.settingsWrite,
  params: idParams,
  goodResponses: [GoodClubEventArchive],
  badResponses: [...errors, BadClubEventClosed],
})
