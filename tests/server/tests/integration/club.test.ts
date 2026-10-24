import { config } from '@rctf/config'
import {
  challenges,
  clubMemberships,
  clubPracticeSolves,
  createDatabase,
  settings,
  solves,
  users,
} from '@rctf/db'
import { Permissions } from '@rctf/types'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import type { Hono } from 'hono'
import { invalidateResolvedSettingsCache } from '../../../../apps/api/src/services/settings'
import { createRedis } from '../../../../apps/api/src/util/redis'
import { getApp, request } from '../../app'
import {
  generateAuthToken,
  generateChallenge,
  generateRealTestUser,
} from '../../util'

const db = createDatabase(config.database.sql).db
let app: Hono<any>
let admin: Awaited<ReturnType<typeof generateRealTestUser>>
let guest: Awaited<ReturnType<typeof generateRealTestUser>>
let member: Awaited<ReturnType<typeof generateRealTestUser>>
let challenge: Awaited<ReturnType<typeof generateChallenge>>
const archivedIds: string[] = []

const call = async (
  path: string,
  userId?: string,
  method = 'GET',
  body?: unknown
) => {
  const response = await request(app, `/api/v2/club${path}`, {
    method,
    headers: {
      ...(userId
        ? { Authorization: `Bearer ${await generateAuthToken(userId)}` }
        : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return { status: response.status, body: await response.json() }
}
const promote = async () => {
  expect(
    (
      await call(`/members/${member.user.id}`, admin.user.id, 'PUT', {
        role: 'member',
      })
    ).status
  ).toBe(200)
}
const close = async () => {
  const data = { startTime: Date.now() - 3_600_000, endTime: Date.now() - 1000 }
  await db
    .insert(settings)
    .values({ id: 'value-0', data })
    .onConflictDoUpdate({ target: settings.id, set: { data } })
  await invalidateResolvedSettingsCache(await createRedis())
}
const archive = async () => {
  await close()
  const response = await call('/archives', admin.user.id, 'POST', {
    name: 'Past event',
    description: 'Frozen results',
  })
  expect(response.status).toBe(200)
  archivedIds.push(response.body.data.id)
  return response.body.data.id as string
}

beforeEach(async () => {
  app = await getApp()
  admin = await generateRealTestUser(
    Permissions.settingsWrite | Permissions.usersWrite
  )
  guest = await generateRealTestUser()
  member = await generateRealTestUser()
  challenge = await generateChallenge()
})
afterEach(async () => {
  const tables = await import('@rctf/db')
  if ('clubArchives' in tables)
    for (const id of archivedIds.splice(0))
      await db.delete(tables.clubArchives).where(eq(tables.clubArchives.id, id))
  await challenge.cleanup()
  await member.cleanup()
  await guest.cleanup()
  await admin.cleanup()
  await db.delete(settings).where(eq(settings.id, 'value-0'))
  await invalidateResolvedSettingsCache(await createRedis())
  await (await createRedis()).flushall()
})

describe('club archive permission and score isolation', () => {
  test('membership revoked during rate limiting cannot persist an archive practice solve', async () => {
    await promote()
    const archiveId = await archive()
    const redis = await createRedis()
    const rateLimit = redis.rctfRateLimit.bind(redis)
    const intercepted = spyOn(redis, 'rctfRateLimit').mockImplementation(
      async (key, limit, ttl) => {
        if (
          key ===
          `rl:FLAG:archive:${archiveId}:${challenge.challenge.id}:${member.user.id}`
        ) {
          await db
            .delete(clubMemberships)
            .where(eq(clubMemberships.userId, member.user.id))
        }
        return rateLimit(key, limit, ttl)
      }
    )
    try {
      const response = await call(
        `/archives/${archiveId}/challenges/${challenge.challenge.id}/submit`,
        member.user.id,
        'POST',
        { flag: challenge.challenge.flag }
      )
      expect(response.status).toBe(403)
      expect(
        await db
          .select()
          .from(clubPracticeSolves)
          .where(eq(clubPracticeSolves.archiveId, archiveId))
      ).toEqual([])
    } finally {
      intercepted.mockRestore()
    }
  })

  test('only settings administrators can persist Club mode and it closes scored submissions', async () => {
    const updateMode = async (userId: string, data: Record<string, unknown>) =>
      request(app, '/api/v2/admin/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${await generateAuthToken(userId)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data }),
      })
    expect((await updateMode(guest.user.id, { clubMode: 'club' })).status).toBe(
      403
    )
    const updated = await updateMode(admin.user.id, { clubMode: 'club' })
    expect(updated.status).toBe(200)
    expect((await updated.json()).data.overrides.clubMode).toBe('club')
    const client = await request(app, '/api/v2/integrations/client/config', {
      method: 'GET',
    })
    expect((await client.json()).data.clubMode).toBe('club')
    const submit = await request(
      app,
      `/api/v1/challs/${challenge.challenge.id}/submit`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await generateAuthToken(guest.user.id)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ flag: challenge.challenge.flag }),
      }
    )
    expect((await submit.json()).kind).toBe('badEnded')
    const restored = await updateMode(admin.user.id, { clubMode: 'event' })
    expect((await restored.json()).data.overrides.clubMode).toBe('event')
    expect(
      (await db.select().from(settings).where(eq(settings.id, 'value-0')))[0]
        ?.data.endTime
    ).toBeLessThanOrEqual(Date.now())
  })

  test('Club mode blocks scoring even when stored schedule still has a future end', async () => {
    await db
      .insert(settings)
      .values({
        id: 'value-0',
        data: {
          clubMode: 'club',
          startTime: Date.now() - 10000,
          endTime: Date.now() + 100000,
        },
      })
      .onConflictDoUpdate({
        target: settings.id,
        set: {
          data: {
            clubMode: 'club',
            startTime: Date.now() - 10000,
            endTime: Date.now() + 100000,
          },
        },
      })
    await invalidateResolvedSettingsCache(await createRedis())
    const submit = await request(
      app,
      `/api/v1/challs/${challenge.challenge.id}/submit`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await generateAuthToken(guest.user.id)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ flag: challenge.challenge.flag }),
      }
    )
    expect((await submit.json()).kind).toBe('badEnded')
  })

  test('archive scores are authoritative even before the leaderboard worker runs and exclude other events', async () => {
    await promote()
    await db
      .update(challenges)
      .set({ data: { ...challenge.challenge, points: { min: 500, max: 500 } } })
      .where(eq(challenges.id, challenge.challenge.id))
    await db.insert(solves).values([
      {
        id: crypto.randomUUID(),
        userid: member.user.id,
        challengeid: challenge.challenge.id,
        createdat: new Date(Date.now() - 10000).toISOString(),
        points: 500,
      },
      {
        id: crypto.randomUUID(),
        userid: guest.user.id,
        challengeid: challenge.challenge.id,
        createdat: new Date(Date.now() - 7_200_000).toISOString(),
        points: 500,
      },
    ])
    // The async leaderboard worker has not published either a score or rank.
    const id = await archive()
    const result = await call(`/archives/${id}`, member.user.id)
    expect(result.body.data.leaderboard).toEqual([
      {
        id: member.user.id,
        name: member.user.name,
        division: member.user.division,
        score: 500,
        rank: 1,
      },
    ])
    expect(
      result.body.data.challenges.find(
        (item: { id: string }) => item.id === challenge.challenge.id
      )
    ).toMatchObject({ points: 500, solves: 1 })
    expect(
      (await db.select().from(users).where(eq(users.id, member.user.id)))[0]
        ?.score
    ).toBe(0)
  })

  test('accounts default to Guest and direct archive APIs deny Guests', async () => {
    const access = await call('/access', guest.user.id)
    expect(access.status).toBe(200)
    expect(access.body.data).toMatchObject({
      role: 'guest',
      canAccessArchives: false,
      canManageMembers: false,
    })
    expect((await call('/archives')).status).toBe(401)
    expect((await call('/archives', guest.user.id)).status).toBe(403)
    expect((await call('/archives/unknown', guest.user.id)).status).toBe(403)
    expect(
      (
        await call(
          '/archives/unknown/challenges/unknown/submit',
          guest.user.id,
          'POST',
          { flag: 'guess' }
        )
      ).status
    ).toBe(403)
  })

  test('Guest can solve current challenges and the native end time stops scored submissions', async () => {
    const submit = async (userId: string) =>
      request(app, `/api/v1/challs/${challenge.challenge.id}/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await generateAuthToken(userId)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ flag: challenge.challenge.flag }),
      })
    expect((await (await submit(guest.user.id)).json()).kind).toBe('goodFlag')
    await close()
    expect((await (await submit(member.user.id)).json()).kind).toBe('badEnded')
    expect(
      await db.select().from(solves).where(eq(solves.userid, member.user.id))
    ).toHaveLength(0)
  })

  test('default static flags and challenge files survive archival while instance challenges cannot replay', async () => {
    await promote()
    const { flag, ...data } = challenge.challenge
    await db
      .update(challenges)
      .set({
        data: {
          ...data,
          description: `Do not display ${flag}`,
          flags: [{ config: { flag } }],
          files: [{ name: 'challenge.zip', url: '/uploads/challenge.zip' }],
        },
      })
      .where(eq(challenges.id, challenge.challenge.id))
    const id = await archive()
    const result = await call(`/archives/${id}`, member.user.id)
    expect(JSON.stringify(result.body)).not.toContain(flag)
    expect(result.body.data.challenges[0]).toMatchObject({
      practiceAvailable: true,
      files: [
        { name: 'challenge.zip', url: '/uploads/challenge.zip', size: null },
      ],
    })
    expect(
      (
        await call(
          `/archives/${id}/challenges/${challenge.challenge.id}/submit`,
          member.user.id,
          'POST',
          { flag }
        )
      ).body.data.result
    ).toBe('correct')
    await db
      .update(challenges)
      .set({
        data: {
          ...data,
          instancerConfig: {
            challengeIntegrationId: 'private-integration',
            config: { token: 'private-token' },
            timeoutMilliseconds: 60000,
          },
        },
      })
      .where(eq(challenges.id, challenge.challenge.id))
    const unavailableId = await archive()
    const unavailable = await call(`/archives/${unavailableId}`, member.user.id)
    expect(unavailable.body.data.challenges[0].practiceAvailable).toBe(false)
    expect(JSON.stringify(unavailable.body)).not.toContain('private-token')
  })

  test('membership requires usersWrite and revocation affects the next request', async () => {
    expect(
      (
        await call(`/members/${guest.user.id}`, guest.user.id, 'PUT', {
          role: 'member',
        })
      ).status
    ).toBe(403)
    await promote()
    expect((await call('/archives', member.user.id)).status).toBe(200)
    const list = await call(
      `/members?search=${encodeURIComponent(member.user.name)}&limit=50&offset=0`,
      admin.user.id
    )
    expect(list.body.data.users).toContainEqual({
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      role: 'member',
    })
    expect(
      (
        await call(`/members/${member.user.id}`, admin.user.id, 'PUT', {
          role: 'guest',
        })
      ).status
    ).toBe(200)
    expect((await call('/archives', member.user.id)).status).toBe(403)
    expect((await call('/archives', admin.user.id)).status).toBe(200)
  })

  test('only event managers can snapshot and active events cannot be archived', async () => {
    await promote()
    expect((await call('/archives', member.user.id, 'POST', {})).status).toBe(
      403
    )
    const response = await call('/archives', admin.user.id, 'POST', {})
    expect(response.status).toBe(409)
    expect(response.body.kind).toBe('badClubEventActive')
  })

  test('snapshots omit hidden and unreleased challenges and expose no provider secrets', async () => {
    await promote()
    const hidden = await generateChallenge()
    const future = await generateChallenge()
    try {
      await db
        .update(challenges)
        .set({ data: { ...hidden.challenge, hidden: true } })
        .where(eq(challenges.id, hidden.challenge.id))
      await db
        .update(challenges)
        .set({ data: { ...future.challenge, releaseTime: Date.now() + 60000 } })
        .where(eq(challenges.id, future.challenge.id))
      const id = await archive()
      const result = await call(`/archives/${id}`, member.user.id)
      expect(result.status).toBe(200)
      const ids = result.body.data.challenges.map(
        (item: { id: string }) => item.id
      )
      expect(ids).toContain(challenge.challenge.id)
      expect(ids).not.toContain(hidden.challenge.id)
      expect(ids).not.toContain(future.challenge.id)
      expect(JSON.stringify(result.body)).not.toContain(
        challenge.challenge.flag
      )
      expect(
        result.body.data.challenges.find(
          (item: { id: string }) => item.id === challenge.challenge.id
        )
      ).toMatchObject({
        practiceAvailable: true,
        practiceUnavailableReason: null,
      })
    } finally {
      await hidden.cleanup()
      await future.cleanup()
    }
  })

  test('practice is persistent, duplicate safe and never changes current or frozen scores', async () => {
    await promote()
    await db
      .update(users)
      .set({ score: 321, globalRank: 1 })
      .where(eq(users.id, member.user.id))
    const id = await archive()
    const before = await call(`/archives/${id}`, member.user.id)
    const path = `/archives/${id}/challenges/${challenge.challenge.id}/submit`
    const redis = await createRedis()
    expect(
      (await call(path, member.user.id, 'POST', { flag: 'wrong' })).body.data
        .result
    ).toBe('incorrect')
    await redis.flushall()
    const concurrent = await Promise.all([
      call(path, member.user.id, 'POST', { flag: challenge.challenge.flag }),
      call(path, member.user.id, 'POST', { flag: challenge.challenge.flag }),
    ])
    expect(
      concurrent.map(response => response.body.data.result).sort()
    ).toEqual(['alreadySolved', 'correct'])
    await redis.flushall()
    expect(
      (
        await call(path, member.user.id, 'POST', {
          flag: challenge.challenge.flag,
        })
      ).body.data.result
    ).toBe('alreadySolved')
    expect(
      await db.select().from(solves).where(eq(solves.userid, member.user.id))
    ).toHaveLength(0)
    expect(
      (await db.select().from(users).where(eq(users.id, member.user.id)))[0]
        ?.score
    ).toBe(321)
    const after = await call(`/archives/${id}`, member.user.id)
    expect(after.body.data.solvedIds).toEqual([challenge.challenge.id])
    expect(after.body.data.leaderboard).toEqual(before.body.data.leaderboard)
    await db
      .update(users)
      .set({ score: 999 })
      .where(eq(users.id, member.user.id))
    await db.delete(challenges).where(eq(challenges.id, challenge.challenge.id))
    expect(
      (await call(`/archives/${id}`, member.user.id)).body.data.leaderboard
    ).toEqual(before.body.data.leaderboard)
    expect(
      (await call(`/archives/${id}`, member.user.id)).body.data.challenges
    ).toEqual(before.body.data.challenges)
    expect(
      (
        await call(`/members/${guest.user.id}`, admin.user.id, 'PUT', {
          role: 'member',
        })
      ).status
    ).toBe(200)
    expect(
      (
        await call(path, guest.user.id, 'POST', {
          flag: challenge.challenge.flag,
        })
      ).body.data.result
    ).toBe('correct')
  })

  test("archive summaries count only the caller's practice solves within each snapshot", async () => {
    await promote()
    const other = await generateChallenge()
    const reference = await generateChallenge()
    try {
      await db
        .update(challenges)
        .set({
          data: {
            ...reference.challenge,
            instancerConfig: {
              challengeIntegrationId: 'private-integration',
              config: { token: 'private-token' },
              timeoutMilliseconds: 60000,
            },
          },
        })
        .where(eq(challenges.id, reference.challenge.id))
      const firstId = await archive()
      const secondId = await archive()
      const submit = async (
        archiveId: string,
        userId: string,
        target: typeof challenge.challenge
      ) => {
        const result = await call(
          `/archives/${archiveId}/challenges/${target.id}/submit`,
          userId,
          'POST',
          { flag: target.flag }
        )
        expect(result.status).toBe(200)
        expect(result.body.data.result).toBe('correct')
      }
      await submit(firstId, member.user.id, challenge.challenge)
      await submit(firstId, admin.user.id, other.challenge)
      // A legacy solve for a reference-only snapshot must not inflate progress.
      await db.insert(clubPracticeSolves).values({
        archiveId: firstId,
        challengeId: reference.challenge.id,
        userId: member.user.id,
      })
      await other.cleanup()
      await reference.cleanup()
      await challenge.cleanup()

      const firstList = await call('/archives', member.user.id)
      expect(firstList.status).toBe(200)
      expect(firstList.body.data).toContainEqual(
        expect.objectContaining({
          id: firstId,
          challengeCount: 3,
          practiceChallengeCount: 2,
          solvedCount: 1,
        })
      )
      expect(firstList.body.data).toContainEqual(
        expect.objectContaining({
          id: secondId,
          challengeCount: 3,
          practiceChallengeCount: 2,
          solvedCount: 0,
        })
      )
      const serialized = JSON.stringify(firstList.body)
      expect(serialized).not.toContain(challenge.challenge.flag)
      expect(serialized).not.toContain(other.challenge.flag)
      expect(serialized).not.toContain('staticFlags')
      expect(serialized).not.toContain('private-token')

      await submit(secondId, member.user.id, other.challenge)
      const secondList = await call('/archives', member.user.id)
      expect(secondList.body.data).toContainEqual(
        expect.objectContaining({
          id: firstId,
          practiceChallengeCount: 2,
          solvedCount: 1,
        })
      )
      expect(secondList.body.data).toContainEqual(
        expect.objectContaining({
          id: secondId,
          practiceChallengeCount: 2,
          solvedCount: 1,
        })
      )
      expect((await call('/archives', admin.user.id)).body.data).toContainEqual(
        expect.objectContaining({ id: secondId, solvedCount: 0 })
      )
    } finally {
      await other.cleanup()
      await reference.cleanup()
    }
  })

  test('archive summaries retain empty events with zero practice progress', async () => {
    await promote()
    expect((await call('/archives', member.user.id)).body.data).toEqual([])
    await db
      .update(challenges)
      .set({ data: { ...challenge.challenge, hidden: true } })
      .where(eq(challenges.id, challenge.challenge.id))
    const id = await archive()
    const result = await call('/archives', member.user.id)
    expect(result.status).toBe(200)
    expect(result.body.data).toEqual([
      expect.objectContaining({
        id,
        challengeCount: 0,
        practiceChallengeCount: 0,
        solvedCount: 0,
      }),
    ])
  })

  test('per-team flag challenges are explicitly unavailable for practice', async () => {
    await promote()
    await db
      .update(challenges)
      .set({
        data: {
          ...challenge.challenge,
          flags: [
            {
              provider: 'flags/instancer',
              config: { secret: 'private-provider-secret' },
            },
          ],
        },
      })
      .where(eq(challenges.id, challenge.challenge.id))
    const id = await archive()
    const result = await call(`/archives/${id}`, member.user.id)
    const item = result.body.data.challenges.find(
      (item: { id: string }) => item.id === challenge.challenge.id
    )
    expect(item.practiceAvailable).toBe(false)
    expect(item.practiceUnavailableReason).toEqual(expect.any(String))
    expect(JSON.stringify(result.body)).not.toContain('private-provider-secret')
    expect(
      (
        await call(
          `/archives/${id}/challenges/${challenge.challenge.id}/submit`,
          member.user.id,
          'POST',
          { flag: 'guess' }
        )
      ).status
    ).toBe(409)
  })
})
