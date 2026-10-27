import { VerifyRoute } from '@rctf/types'
import { checkTeamIpLimit } from '../../../../services/anticheat'
import { checkLoginVerification } from '../../../../cache/auth-cache'
import {
  createToken,
  parseTokenWithMultipleKinds,
  TokenKind,
} from '../../../../lib/tokens'
import { claimPendingRegistrationVerificationByToken } from '../../../../services/registration-verifications'
import {
  createUserInternal,
  getUser,
  updateUserEmail,
} from '../../../../services/users'
import { divisionAllowed } from '../../../../util/acl'
import authGroup from '../group'

authGroup.route(VerifyRoute, async ({ ctx, body, res }) => {
  const result = await parseTokenWithMultipleKinds(
    [TokenKind.Verify, TokenKind.Team],
    body.verifyToken
  )
  if (!result) {
    const pending = await claimPendingRegistrationVerificationByToken(
      ctx.var.db,
      body.verifyToken
    )
    if (!pending) {
      return res.badTokenVerification()
    }

    const created = await createUserInternal(ctx.var.db, {
      division: pending.division,
      email: pending.email,
      name: pending.name,
      ctftimeId: null,
    })

    if (!created.success) {
      if (created.error === 'badKnownEmail') {
        return res.badKnownEmail()
      }
      if (created.error === 'badKnownName') {
        return res.badKnownName()
      }
      throw new Error(`Unexpected user creation error: ${created.error}`)
    }

    const authToken = await createToken(TokenKind.Auth, created.userId)
    return res.goodRegister({ authToken })
  }

  const [kind, data] = result

  if (kind === TokenKind.Team) {
    const user = await getUser(ctx.var.db, data)
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
    return res.goodVerify({ authToken })
  }

  const tokenUnused = await checkLoginVerification(ctx.var.redis, data.verifyId)
  if (!tokenUnused) {
    return res.badTokenVerification()
  }

  if (data.kind === 'update') {
    const user = await getUser(ctx.var.db, data.userId)
    if (!user) {
      return res.badUnknownUser()
    }

    if (!divisionAllowed(data.email, user.division)) {
      return res.badEmailChangeDivision()
    }

    return await updateUserEmail(res, ctx.var.db, ctx.var.redis, data.userId, {
      email: data.email,
    })
  }

  throw new Error(`Unsupported kind: ${data}`)
})
