import type { Hono } from 'hono'
import { Permissions } from '@rctf/types'
import type { AppEnv } from '../../../lib/app-env'
import { parseToken, TokenKind } from '../../../lib/tokens'
import { getUser } from '../../../services/users'
import {
  clearSecurityAlerts,
  createTeamByAdmin,
  getSecurityAlerts,
  resetTeamIps,
} from '../../../services/anticheat'

export const registerSecurityAdminRoutes = (app: Hono<AppEnv>) => {
  const getAdminUser = async (c: any) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return null
    }
    const token = authHeader.slice(7)
    const userId = await parseToken(TokenKind.Auth, token)
    if (!userId) {
      return null
    }
    const user = await getUser(c.var.db, userId)
    if (
      !user ||
      user.banned ||
      !user.perms ||
      user.perms <= 0 ||
      (user.perms & Permissions.usersWrite) === 0
    ) {
      return null
    }
    return user
  }

  // GET: List all security violation alerts
  app.get('/api/v2/admin/security/alerts', async c => {
    const admin = await getAdminUser(c)
    if (!admin) {
      return c.json({ kind: 'badPerms', message: 'Forbidden' }, 403)
    }

    const alerts = await getSecurityAlerts(c.var.redis)
    return c.json({
      kind: 'goodSecurityAlerts',
      message: 'Success',
      data: {
        alerts,
        maxIpsPerTeam: 4,
      },
    })
  })

  // POST: Clear all security violation alerts
  app.post('/api/v2/admin/security/alerts/clear', async c => {
    const admin = await getAdminUser(c)
    if (!admin) {
      return c.json({ kind: 'badPerms', message: 'Forbidden' }, 403)
    }

    await clearSecurityAlerts(c.var.redis)
    return c.json({
      kind: 'goodSecurityAlertsCleared',
      message: 'All violation reports have been cleared.',
    })
  })

  // POST: Reset registered IPs for a team
  app.post('/api/v2/admin/security/teams/:id/reset-ips', async c => {
    const admin = await getAdminUser(c)
    if (!admin) {
      return c.json({ kind: 'badPerms', message: 'Forbidden' }, 403)
    }

    const teamId = c.req.param('id')
    await resetTeamIps(c.var.redis, teamId)
    return c.json({
      kind: 'goodTeamIpsReset',
      message: `Reset IP tracking for team ${teamId}. Team can now register 4 new devices.`,
    })
  })

  // POST: Admin creates a team directly from Admin Panel
  app.post('/api/v2/admin/security/teams/create', async c => {
    const admin = await getAdminUser(c)
    if (!admin) {
      return c.json({ kind: 'badPerms', message: 'Forbidden' }, 403)
    }

    let body: any
    try {
      body = await c.req.json()
    } catch {
      return c.json({ kind: 'badBody', message: 'Invalid JSON body' }, 400)
    }

    const { name, email, division } = body
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return c.json({ kind: 'badBody', message: 'Team name must be at least 2 characters' }, 400)
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return c.json({ kind: 'badBody', message: 'Invalid email address' }, 400)
    }
    if (!division || typeof division !== 'string') {
      return c.json({ kind: 'badBody', message: 'Division is required' }, 400)
    }

    const result = await createTeamByAdmin(c.var.db, c.var.redis, {
      name: name.trim(),
      email: email.trim(),
      division: division.trim(),
    })

    if (!result.success) {
      if (result.error === 'badKnownName') {
        return c.json({ kind: 'badKnownName', message: 'This team name is already taken!' }, 400)
      }
      if (result.error === 'badKnownEmail') {
        return c.json({ kind: 'badKnownEmail', message: 'This email is already in use!' }, 400)
      }
      return c.json({ kind: 'badEndpoint', message: `Failed to create team: ${result.error}` }, 400)
    }

    return c.json({
      kind: 'goodTeamCreated',
      message: 'Team created successfully!',
      data: result.team,
    })
  })
}
