import type { DatabaseClient, User } from '@rctf/db'
import type { TypedRedis } from '../cache/scripts'
import { createToken, TokenKind } from '../lib/tokens'
import { createUserInternal } from './users'

export const MAX_IPS_PER_TEAM = 4

export interface IpViolation {
  id: string
  teamId: string
  teamName: string
  division: string
  blockedIp: string
  activeIps: string[]
  timestamp: number
  path: string
  method: string
}

/**
 * Checks if the request IP is allowed for the team.
 * If team already has 4 distinct IPs and a 5th arrives:
 * blocks and records the violation.
 */
export const checkTeamIpLimit = async (
  redis: TypedRedis,
  user: User,
  clientIp: string,
  path: string,
  method: string
): Promise<{ allowed: boolean; activeIps?: string[] }> => {
  // Admins are exempt from the 4-IP limit
  if (user.perms > 0) {
    return { allowed: true }
  }

  // Normalise IP (trim, ipv6 mapping)
  const normalizedIp = clientIp.trim().replace(/^::ffff:/, '')
  const setKey = `anticheat:team_ips:${user.id}`

  // Atomic IP check & registration via Lua to prevent race conditions
  const allowed = await (redis as any).eval(
    `
    local key = KEYS[1]
    local ip = ARGV[1]
    local maxIps = tonumber(ARGV[2])
    local ttl = tonumber(ARGV[3])

    if redis.call('sismember', key, ip) == 1 then
      return 1
    end

    local count = redis.call('scard', key)
    if count < maxIps then
      redis.call('sadd', key, ip)
      redis.call('expire', key, ttl)
      return 1
    end

    return 0
    `,
    1,
    setKey,
    normalizedIp,
    MAX_IPS_PER_TEAM.toString(),
    (14 * 86400).toString()
  )

  if (allowed === 1) {
    return { allowed: true }
  }

  // 3. 5th IP (or more) detected! VIOLATION!
  const activeIps = await redis.smembers(setKey)

  const violation: IpViolation = {
    id: crypto.randomUUID(),
    teamId: user.id,
    teamName: user.name,
    division: user.division,
    blockedIp: normalizedIp,
    activeIps,
    timestamp: Date.now(),
    path,
    method,
  }

  // Log violation and save to Redis list for Admin Panel
  console.warn(
    `[ANTI-CHEAT VIOLATION] Team "${user.name}" (${user.id}) blocked 5th IP: ${normalizedIp}. Active IPs: [${activeIps.join(', ')}]`
  )

  await redis.lpush('anticheat:violations', JSON.stringify(violation))
  await redis.ltrim('anticheat:violations', 0, 500) // Keep last 500 reports

  return { allowed: false, activeIps }
}

/**
 * Get all security violation reports for Admin Panel
 */
export const getSecurityAlerts = async (
  redis: TypedRedis
): Promise<IpViolation[]> => {
  const items = await redis.lrange('anticheat:violations', 0, 500)
  return items.map(item => {
    try {
      return JSON.parse(item) as IpViolation
    } catch {
      return null
    }
  }).filter((item): item is IpViolation => item !== null)
}

/**
 * Clear all security alerts
 */
export const clearSecurityAlerts = async (
  redis: TypedRedis
): Promise<void> => {
  await redis.del('anticheat:violations')
}

/**
 * Reset allowed IPs for a team (in case a member legitimately changed network)
 */
export const resetTeamIps = async (
  redis: TypedRedis,
  teamId: string
): Promise<void> => {
  await redis.del(`anticheat:team_ips:${teamId}`)
}

/**
 * Admin creates a team account directly from the Admin Panel
 */
export const createTeamByAdmin = async (
  db: DatabaseClient,
  _redis: TypedRedis,
  params: {
    name: string
    email: string
    division: string
  }
): Promise<
  | { success: true; team: { id: string; name: string; email: string; division: string; token: string } }
  | { success: false; error: string }
> => {
  const result = await createUserInternal(db, {
    name: params.name.trim(),
    email: params.email.trim(),
    division: params.division.trim(),
    ctftimeId: null,
  })

  if (!result.success) {
    return { success: false, error: result.error }
  }

  const token = await createToken(TokenKind.Team, result.userId)

  return {
    success: true,
    team: {
      id: result.userId,
      name: params.name.trim(),
      email: params.email.trim(),
      division: params.division.trim(),
      token,
    },
  }
}
