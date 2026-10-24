import {
  GetClubAccessRouteV2,
  GetClubMembersRouteV2,
  UpdateClubMemberRouteV2,
  GetClubArchivesRouteV2,
  CreateClubArchiveRouteV2,
  GetClubArchiveRouteV2,
  SubmitClubPracticeRouteV2,
} from '@rctf/types'
import { createRouterGroup } from '../../../lib/route-module'
import {
  createClubArchive,
  getClubAccess,
  getClubArchive,
  getClubArchives,
  getClubMembers,
  submitClubPractice,
  updateClubMember,
} from '../../../services/club'
import { rateLimitFlag } from '../../../services/rate-limit'

const group = createRouterGroup()
group.route(GetClubAccessRouteV2, async ({ res, ctx, user }) =>
  res.goodClubAccess(await getClubAccess(ctx.var.db, user))
)
group.route(GetClubMembersRouteV2, async ({ res, ctx, user, query }) => {
  if (!(await getClubAccess(ctx.var.db, user)).canManageMembers)
    return res.badPerms()
  return res.goodClubMembers(await getClubMembers(ctx.var.db, query))
})
group.route(
  UpdateClubMemberRouteV2,
  async ({ res, ctx, user, params, body }) => {
    if (!(await getClubAccess(ctx.var.db, user)).canManageMembers)
      return res.badPerms()
    if (!(await updateClubMember(ctx.var.db, params.id, body.role)))
      return res.badUnknownUser()
    return res.goodClubMemberUpdate({ id: params.id, role: body.role })
  }
)
group.route(GetClubArchivesRouteV2, async ({ res, ctx, user }) => {
  if (!(await getClubAccess(ctx.var.db, user)).canAccessArchives)
    return res.badPerms()
  return res.goodClubArchives(await getClubArchives(ctx.var.db, user.id))
})
group.route(CreateClubArchiveRouteV2, async ({ res, ctx, user, body }) => {
  if (!(await getClubAccess(ctx.var.db, user)).canManageArchives)
    return res.badPerms()
  const archive = await createClubArchive(ctx.var.db, body)
  if (!archive) return res.badClubEventActive()
  return res.goodClubArchiveCreate(archive)
})
group.route(GetClubArchiveRouteV2, async ({ res, ctx, user, params }) => {
  if (!(await getClubAccess(ctx.var.db, user)).canAccessArchives)
    return res.badPerms()
  const archive = await getClubArchive(ctx.var.db, params.id, user.id)
  if (!archive) return res.badClubArchive()
  return res.goodClubArchive(archive)
})
group.route(
  SubmitClubPracticeRouteV2,
  async ({ res, ctx, user, params, body }) => {
    if (!(await getClubAccess(ctx.var.db, user)).canAccessArchives)
      return res.badPerms()
    const timeLeft = await rateLimitFlag(
      ctx.var.redis,
      user.id,
      `archive:${params.id}:${params.challengeId}`
    )
    if (timeLeft !== undefined) return res.badRateLimit({ timeLeft })
    const result = await submitClubPractice(
      ctx.var.db,
      params.id,
      params.challengeId,
      user.id,
      body.flag
    )
    if (result === 'notFound') return res.badClubArchive()
    if (result === 'unavailable') return res.badClubPracticeUnavailable()
    if (result === 'forbidden') return res.badPerms()
    return res.goodClubPractice({ result })
  }
)
export default group
