import {
  GetClubEventsRouteV2,
  CreateClubEventRouteV2,
  UpdateClubEventRouteV2,
  GetClubEventRouteV2,
  SubmitClubEventRouteV2,
  ArchiveClubEventRouteV2,
  Permissions,
} from '@rctf/types'
import { createRouterGroup } from '../../../lib/route-module'
import { getClubAccess } from '../../../services/club'
import {
  archiveClubEvent,
  createClubEvent,
  getClubEvent,
  getClubEvents,
  submitClubEvent,
  updateClubEvent,
} from '../../../services/club-events'
import { rateLimitFlag } from '../../../services/rate-limit'

const group = createRouterGroup()
group.route(GetClubEventsRouteV2, async ({ res, ctx, user }) => {
  const access = await getClubAccess(ctx.var.db, user)
  if (!access.canAccessArchives) return res.badPerms()
  return res.goodClubEvents(
    await getClubEvents(ctx.var.db, user.id, access.canManageArchives)
  )
})
group.route(CreateClubEventRouteV2, async ({ res, ctx, user, body }) => {
  if (!(await getClubAccess(ctx.var.db, user)).canManageArchives)
    return res.badPerms()
  // Copying unpublished bank content requires its native read permission.
  // Settings managers can still create events from member-visible archives.
  if (
    body.sourceArchiveId === undefined &&
    (user.perms & Permissions.challsRead) !== Permissions.challsRead
  )
    return res.badPerms()
  const result = await createClubEvent(ctx.var.db, body)
  if (result === 'schedule') return res.badClubEventSchedule()
  if (result === 'selection') return res.badClubEventSelection()
  return res.goodClubEventCreate(result)
})
group.route(
  UpdateClubEventRouteV2,
  async ({ res, ctx, user, params, body }) => {
    if (!(await getClubAccess(ctx.var.db, user)).canManageArchives)
      return res.badPerms()
    const result = await updateClubEvent(ctx.var.db, params.id, user.id, body)
    if (result === 'notFound') return res.badClubEvent()
    if (result === 'schedule') return res.badClubEventSchedule()
    if (result === 'frozen') return res.badClubEventFrozen()
    return res.goodClubEventUpdate(result)
  }
)
group.route(GetClubEventRouteV2, async ({ res, ctx, user, params }) => {
  const access = await getClubAccess(ctx.var.db, user)
  if (!access.canAccessArchives) return res.badPerms()
  const result = await getClubEvent(
    ctx.var.db,
    params.id,
    user.id,
    access.canManageArchives
  )
  if (!result) return res.badClubEvent()
  return res.goodClubEvent(result)
})
group.route(
  SubmitClubEventRouteV2,
  async ({ res, ctx, user, params, body }) => {
    if (!(await getClubAccess(ctx.var.db, user)).canAccessArchives)
      return res.badPerms()
    const timeLeft = await rateLimitFlag(
      ctx.var.redis,
      user.id,
      `club-event:${params.id}:${params.challengeId}`
    )
    if (timeLeft !== undefined) return res.badRateLimit({ timeLeft })
    const result = await submitClubEvent(
      ctx.var.db,
      params.id,
      params.challengeId,
      user.id,
      body.flag
    )
    if (result === 'notFound') return res.badClubEvent()
    if (result === 'closed') return res.badClubEventClosed()
    if (result === 'forbidden') return res.badPerms()
    return res.goodClubEventSubmit({ result })
  }
)
group.route(ArchiveClubEventRouteV2, async ({ res, ctx, user, params }) => {
  if (!(await getClubAccess(ctx.var.db, user)).canManageArchives)
    return res.badPerms()
  const result = await archiveClubEvent(ctx.var.db, params.id)
  if (result === 'notFound') return res.badClubEvent()
  if (result === 'closed') return res.badClubEventClosed()
  return res.goodClubEventArchive(result)
})
export default group
