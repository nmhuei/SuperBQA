import type { User } from '@rctf/db'
import { LoginRoute } from '@rctf/types'
import { checkTeamIpLimit } from '../../../../services/anticheat'
import { createToken, parseToken, TokenKind } from '../../../../lib/tokens'
import { getUser, getUserByCtftimeId } from '../../../../services/users'
import authGroup from '../group'

authGroup.route(LoginRoute, async ({ ctx, res, body }) => {
  let user: User | undefined

  if (body.ctftimeToken) {
    // Login with ctftime:
    const ctfTimeToken = await parseToken(
      TokenKind.CtftimeAuth,
      body.ctftimeToken ?? ''
    )
    if (!ctfTimeToken) {
      return res.badCtftimeToken()
    }
    user = await getUserByCtftimeId(ctx.var.db, ctfTimeToken.ctftimeId)
  } else {
    // Login with team token:
    const teamId = await parseToken(TokenKind.Team, body.teamToken ?? '')
    if (!teamId) {
      return res.badTokenVerification()
    }
    user = await getUser(ctx.var.db, teamId)
  }

  if (!user) {
    return res.badUnknownUser()
  }

  if (user.banned) {
    return ctx.json(
      {
        kind: 'badPerms',
        message:
          'Your team has been banned. If you have any questions, please open a ticket on our Discord server.',
      },
      403
    )
  }

  // Anti-Cheat: check 4-IP limit for this team
  const ipCheck = await checkTeamIpLimit(
    ctx.var.redis,
    user,
    ctx.var.ip,
    ctx.req.path,
    ctx.req.method
  )
  if (!ipCheck.allowed) {
    return ctx.json(
      {
        kind: 'badTeamIpLimit',
        message:
          'Team has reached the maximum limit of 4 devices/IPs. Device #5 has been blocked and a security violation has been reported to organizers.',
        data: {
          maxIps: 4,
          activeIps: ipCheck.activeIps,
        },
      },
      403
    )
  }

  const authToken = await createToken(TokenKind.Auth, user.id)
  return res.goodLogin({ authToken })
})
