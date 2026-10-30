import { ExternalAuthTokenRouteV2 } from '@rctf/types'
import { createToken, TokenKind } from '../../../../lib/tokens'
import {
  consumeExternalAuthCode,
  verifyExternalAuthClientSecret,
} from '../../../../services/external-auth'
import { rateLimitExternalAuthToken } from '../../../../services/rate-limit'
import externalAuthGroup from '../group'

externalAuthGroup.route(
  ExternalAuthTokenRouteV2,
  async ({ ctx, res, body }) => {
    const timeLeft = await rateLimitExternalAuthToken(ctx.var.redis, ctx.var.ip)
    if (timeLeft) {
      return res.badRateLimit({ timeLeft })
    }

    const ok = await verifyExternalAuthClientSecret(
      ctx.var.db,
      body.clientId,
      body.clientSecret
    )
    if (!ok) {
      return res.badExternalAuthRequest()
    }

    const payload = await consumeExternalAuthCode(ctx.var.redis, body.code)
    if (!payload || payload.clientId !== body.clientId) {
      return res.badExternalAuthRequest()
    }

    const accessToken = await createToken(TokenKind.Auth, payload.userId)
    return res.goodExternalAuthToken({ accessToken, tokenType: 'bearer' })
  }
)
