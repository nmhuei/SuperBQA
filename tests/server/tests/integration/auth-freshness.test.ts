import { config } from '@rctf/config'
import { challenges, createDatabase, users } from '@rctf/db'
import { BadNotStarted, BadPerms, BadToken, Permissions } from '@rctf/types'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import type { Hono } from 'hono'
import { setCachedUser } from '../../../../apps/api/src/cache/auth-cache'
import { createRedis } from '../../../../apps/api/src/util/redis'
import { getApp, request } from '../../app'
import {
  clearDatabase,
  expectResponse,
  generateAuthToken,
  generateChallenge,
  generateRealTestUser,
} from '../../util'

const db = createDatabase(config.database.sql).db
let app: Hono<any>
let admin: Awaited<ReturnType<typeof generateRealTestUser>>
let headers: { Authorization: string }
const originalStart = config.startTime

beforeEach(async () => {
  app = await getApp()
  await clearDatabase()
  await (await createRedis()).flushdb()
  admin = await generateRealTestUser(
    Permissions.challsRead |
      Permissions.challsWrite |
      Permissions.leaderboardRead
  )
  headers = {
    Authorization: `Bearer ${await generateAuthToken(admin.user.id)}`,
  }
  // A cached identity must not authorize a later request after persisted state changes.
  await setCachedUser(await createRedis(), admin.user)
})

afterEach(async () => {
  config.startTime = originalStart
  await clearDatabase()
  await (await createRedis()).flushdb()
})

describe('fresh identity authorization', () => {
  test('revoked read permission is rejected even while the previous admin record is cached', async () => {
    await db.update(users).set({ perms: 0 }).where(eq(users.id, admin.user.id))
    await expectResponse(
      await request(app, '/api/v2/admin/challs', { headers }),
      BadPerms
    )
  })

  test('revoked write permission cannot change a challenge through a stale cached identity', async () => {
    const { challenge } = await generateChallenge()
    await db.update(users).set({ perms: 0 }).where(eq(users.id, admin.user.id))
    await expectResponse(
      await request(app, `/api/v2/admin/challs/${challenge.id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { name: 'Unauthorized edit' } }),
      }),
      BadPerms
    )
    expect(
      (
        await db
          .select()
          .from(challenges)
          .where(eq(challenges.id, challenge.id))
      )[0]?.data.name
    ).toBe(challenge.name)
  })

  test('a newly banned administrator loses sensitive read and write access', async () => {
    const { challenge } = await generateChallenge()
    await db
      .update(users)
      .set({ banned: true })
      .where(eq(users.id, admin.user.id))
    await expectResponse(
      await request(app, '/api/v2/admin/challs', { headers }),
      BadPerms
    )
    await expectResponse(
      await request(app, `/api/v2/admin/challs/${challenge.id}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { name: 'Banned edit' } }),
      }),
      BadPerms
    )
  })

  test('a deleted identity cannot retrieve self-profile credentials from its cache', async () => {
    await db.delete(users).where(eq(users.id, admin.user.id))
    await expectResponse(
      await request(app, '/api/v2/users/me', { headers }),
      BadToken
    )
  })

  test('self-profile reports current permissions while public profiles omit private account fields', async () => {
    await db.update(users).set({ perms: 0 }).where(eq(users.id, admin.user.id))
    const selfResponse = await request(app, '/api/v2/users/me', { headers })
    expect(selfResponse.status).toBe(200)
    const self = await selfResponse.json()
    expect(self.data.perms).toBe(0)
    expect(self.data.email).toBe(admin.user.email)
    const publicResponse = await request(
      app,
      `/api/v2/users/${admin.user.id}`,
      {}
    )
    expect(publicResponse.status).toBe(200)
    const publicProfile = await publicResponse.json()
    expect(publicProfile.data).not.toHaveProperty('email')
    expect(publicProfile.data).not.toHaveProperty('teamToken')
    expect(publicProfile.data).not.toHaveProperty('perms')
  })

  test('Guests retain public Challenges and Scoreboard access after the event starts', async () => {
    await db.update(users).set({ perms: 0 }).where(eq(users.id, admin.user.id))
    expect((await request(app, '/api/v2/challs', { headers })).status).toBe(200)
    expect(
      (
        await request(app, '/api/v2/leaderboard/now?limit=10&offset=0', {
          headers,
        })
      ).status
    ).toBe(200)
  })

  test('revoked administrators cannot bypass the public event start gate', async () => {
    config.startTime = Date.now() + 60_000
    await db.update(users).set({ perms: 0 }).where(eq(users.id, admin.user.id))
    await expectResponse(
      await request(app, '/api/v2/challs', { headers }),
      BadNotStarted
    )
    await expectResponse(
      await request(app, '/api/v2/leaderboard/now?limit=10&offset=0', {
        headers,
      }),
      BadNotStarted
    )
  })

  test('banned administrators cannot use optional authentication to preview an unopened event', async () => {
    config.startTime = Date.now() + 60_000
    await db
      .update(users)
      .set({ banned: true })
      .where(eq(users.id, admin.user.id))
    await expectResponse(
      await request(app, '/api/v2/challs', { headers }),
      BadNotStarted
    )
  })
})
