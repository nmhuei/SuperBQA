import {
  GetClubEventsRouteV2,
  CreateClubEventRouteV2,
  UpdateClubEventRouteV2,
  GetClubEventRouteV2,
  SubmitClubEventRouteV2,
  ArchiveClubEventRouteV2,
  GetClubEventSubmissionsRouteV2,
  DeleteClubEventSolveRouteV2,
  AddClubEventChallengesRouteV2,
  DeleteClubEventChallengeRouteV2,
  GetClubTeamProgressRouteV2,
  Permissions,
} from '@rctf/types'
import { createRouterGroup } from '../../../lib/route-module'
import { getClubAccess } from '../../../services/club'
import {
  addClubEventChallenges,
  archiveClubEvent,
  createClubEvent,
  deleteClubEventChallenge,
  deleteClubEventSolve,
  getClubEvent,
  getClubEvents,
  getClubEventSubmissions,
  getClubTeamProgress,
  submitClubEvent,
  updateClubEvent,
} from '../../../services/club-events'
import { rateLimitFlag } from '../../../services/rate-limit'

const group = createRouterGroup()
group.route(GetClubEventsRouteV2, async ({ res, ctx, user }) => {
  const access = await getClubAccess(ctx.var.db, user)
  const isClubMember = access.role === 'member' || access.canManageArchives
  return res.goodClubEvents(
    await getClubEvents(
      ctx.var.db,
      user?.id,
      access.canManageArchives,
      isClubMember
    )
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
  const isClubMember = access.role === 'member' || access.canManageArchives
  const result = await getClubEvent(
    ctx.var.db,
    params.id,
    user?.id,
    access.canManageArchives,
    isClubMember
  )
  if (!result) return res.badClubEvent()
  return res.goodClubEvent(result)
})
group.route(
  SubmitClubEventRouteV2,
  async ({ res, ctx, user, params, body }) => {
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
      body.flag,
      ctx.var.ip
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
group.route(GetClubEventSubmissionsRouteV2, async ({ res, ctx, user, params }) => {
  if (!(await getClubAccess(ctx.var.db, user)).canManageArchives)
    return res.badPerms()
  const list = await getClubEventSubmissions(ctx.var.db, params.id)
  return res.goodClubEventSubmissions(list)
})
group.route(DeleteClubEventSolveRouteV2, async ({ res, ctx, user, params }) => {
  if (!(await getClubAccess(ctx.var.db, user)).canManageArchives)
    return res.badPerms()
  const ok = await deleteClubEventSolve(ctx.var.db, params.id, params.solveId)
  if (!ok) return res.badClubEvent()
  return res.goodClubEventSolveDelete({ id: params.solveId })
})
group.route(AddClubEventChallengesRouteV2, async ({ res, ctx, user, params, body }) => {
  if (!(await getClubAccess(ctx.var.db, user)).canManageArchives)
    return res.badPerms()
  if ((user.perms & Permissions.challsRead) !== Permissions.challsRead)
    return res.badPerms()
  const added = await addClubEventChallenges(
    ctx.var.db,
    params.id,
    body.challengeIds
  )
  return res.goodClubEventChallengesAdd({ added })
})
group.route(DeleteClubEventChallengeRouteV2, async ({ res, ctx, user, params }) => {
  if (!(await getClubAccess(ctx.var.db, user)).canManageArchives)
    return res.badPerms()
  const ok = await deleteClubEventChallenge(
    ctx.var.db,
    params.id,
    params.challengeId
  )
  if (!ok) return res.badClubEvent()
  return res.goodClubEventChallengeDelete({ challengeId: params.challengeId })
})
group.route(GetClubTeamProgressRouteV2, async ({ res, ctx, user }) => {
  const access = await getClubAccess(ctx.var.db, user)
  if (access.role !== 'member' && !access.canManageArchives) {
    return res.badPerms()
  }
  const progress = await getClubTeamProgress(ctx.var.db, user.id)
  return res.goodClubTeamProgress(progress)
})
export default group
