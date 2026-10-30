import { CreateInstanceRouteV2 } from '@rctf/types'
import { createInstance } from '../../../../services/instance-lifecycle'
import { rateLimitCreateInstance } from '../../../../services/rate-limit'
import integrationsGroup from '../group'

integrationsGroup.route(
  CreateInstanceRouteV2,
  async ({ ctx, res, params, user }) => {
    const timeLeft = await rateLimitCreateInstance(
      ctx.var.redis,
      user.id,
      params.id
    )
    if (timeLeft) {
      return res.badRateLimit({ timeLeft })
    }
    return await createInstance({
      res,
      db: ctx.var.db,
      user,
      challengeId: params.id,
    })
  }
)
