import { config } from '@rctf/config'
import {
  challenges,
  clubArchives,
  clubEvents,
  clubEventSolves,
  clubMemberships,
  clubPracticeSolves,
  createDatabase,
  solves,
  users,
} from '@rctf/db'
import { Permissions } from '@rctf/types'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { and, eq, inArray } from 'drizzle-orm'
import type { Hono } from 'hono'
import { seedDemoArchives } from '../../../../apps/cli/src/commands/seed-archives'
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
let member: Awaited<ReturnType<typeof generateRealTestUser>>
let guest: Awaited<ReturnType<typeof generateRealTestUser>>
let bank: Awaited<ReturnType<typeof generateChallenge>>
const eventIds: string[] = []
const archiveIds: string[] = []
const demoIds = [
  'ucs-demo-rookie-2026-09',
  'ucs-demo-web-crypto-2026-08',
  'ucs-demo-forensics-2026-07',
]
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
const create = async (overrides: Record<string, unknown> = {}) => {
  const result = await call('/events', admin.user.id, 'POST', {
    name: 'Private workshop',
    startTime: Date.now() - 60_000,
    endTime: Date.now() + 60_000,
    published: true,
    challengeIds: [bank.challenge.id],
    ...overrides,
  })
  expect(result.status).toBe(200)
  eventIds.push(result.body.data.id)
  return result.body.data
}
const submit = (
  id: string,
  challengeId: string,
  flag: string,
  userId = member.user.id
) =>
  call(`/events/${id}/challenges/${challengeId}/submit`, userId, 'POST', {
    flag,
  })

beforeEach(async () => {
  app = await getApp()
  admin = await generateRealTestUser(
    Permissions.settingsWrite | Permissions.usersWrite | Permissions.challsRead
  )
  member = await generateRealTestUser()
  guest = await generateRealTestUser()
  bank = await generateChallenge()
  await db.insert(clubMemberships).values({ userId: member.user.id })
})
afterEach(async () => {
  if (eventIds.length)
    await db
      .delete(clubEvents)
      .where(inArray(clubEvents.id, eventIds.splice(0)))
  await db
    .delete(clubArchives)
    .where(inArray(clubArchives.id, [...demoIds, ...archiveIds.splice(0)]))
  await bank.cleanup()
  await member.cleanup()
  await guest.cleanup()
  await admin.cleanup()
  await (await createRedis()).flushall()
})

describe('private club events', () => {
  test('settings managers without challenge-read permission can reuse archives but cannot copy the native bank', async () => {
    const manager = await generateRealTestUser(Permissions.settingsWrite)
    try {
      const body = {
        name: 'Scoped source',
        startTime: Date.now() + 1000,
        endTime: Date.now() + 60_000,
        challengeIds: [bank.challenge.id],
      }
      const denied = await call('/events', manager.user.id, 'POST', body)
      expect(denied.status).toBe(403)
      expect(denied.body.kind).toBe('badPerms')
      expect(await db.select().from(clubEvents)).toEqual([])
      await seedDemoArchives(db)
      const allowed = await call('/events', manager.user.id, 'POST', {
        ...body,
        sourceArchiveId: demoIds[0],
        challengeIds: ['signal'],
      })
      expect(allowed.status).toBe(200)
      eventIds.push(allowed.body.data.id)
    } finally {
      await manager.cleanup()
    }
  })

  test('anonymous and Guest requests cannot call private event endpoints directly', async () => {
    const event = await create()
    const endpoints = [
      { path: '/events', method: 'GET' },
      { path: `/events/${event.id}`, method: 'GET' },
      {
        path: '/events',
        method: 'POST',
        body: {
          name: 'Denied',
          startTime: 1,
          endTime: 2,
          challengeIds: [bank.challenge.id],
        },
      },
      {
        path: `/events/${event.id}`,
        method: 'PATCH',
        body: { published: false },
      },
      { path: `/events/${event.id}/archive`, method: 'POST' },
      {
        path: `/events/${event.id}/challenges/${bank.challenge.id}/submit`,
        method: 'POST',
        body: { flag: bank.challenge.flag },
      },
    ]
    for (const endpoint of endpoints) {
      expect(
        (await call(endpoint.path, undefined, endpoint.method, endpoint.body))
          .status
      ).toBe(401)
      expect(
        (
          await call(
            endpoint.path,
            guest.user.id,
            endpoint.method,
            endpoint.body
          )
        ).status
      ).toBe(403)
    }
    expect(await db.select().from(clubEventSolves)).toEqual([])
  })

  test('gates every API, hides drafts, and previews scheduled challenges only for event managers', async () => {
    const draft = await create({
      published: false,
      startTime: Date.now() + 20_000,
    })
    expect((await call('/events')).status).toBe(401)
    expect((await call('/events', guest.user.id)).status).toBe(403)
    expect((await call('/events', member.user.id)).body.data).toEqual([])
    expect((await call('/events', admin.user.id)).body.data).toContainEqual(
      expect.objectContaining({ id: draft.id, published: false })
    )
    expect((await call(`/events/${draft.id}`, member.user.id)).status).toBe(404)
    expect((await call(`/events/${draft.id}`, guest.user.id)).status).toBe(403)
    expect(
      (await call(`/events/${draft.id}`, admin.user.id)).body.data.challenges
    ).toHaveLength(1)
    expect(
      (
        await call('/events', member.user.id, 'POST', {
          name: 'Denied',
          startTime: 1,
          endTime: 2,
          challengeIds: [bank.challenge.id],
        })
      ).status
    ).toBe(403)
    expect(
      (
        await call(`/events/${draft.id}`, member.user.id, 'PATCH', {
          published: true,
        })
      ).status
    ).toBe(403)
    expect(
      (await call(`/events/${draft.id}/archive`, guest.user.id, 'POST')).status
    ).toBe(403)
    expect(
      (await submit(draft.id, bank.challenge.id, 'guess', guest.user.id)).status
    ).toBe(403)
    await db
      .update(users)
      .set({ perms: Permissions.usersWrite })
      .where(eq(users.id, guest.user.id))
    expect((await call('/events', guest.user.id)).body.data).toEqual([])
    expect((await call(`/events/${draft.id}`, guest.user.id)).status).toBe(404)
    expect(
      (
        await call(`/events/${draft.id}`, admin.user.id, 'PATCH', {
          published: true,
        })
      ).status
    ).toBe(200)
    expect(
      (await call(`/events/${draft.id}`, member.user.id)).body.data.challenges
    ).toEqual([])
    expect(
      (await submit(draft.id, bank.challenge.id, bank.challenge.flag)).status
    ).toBe(409)
    await db
      .delete(clubMemberships)
      .where(eq(clubMemberships.userId, member.user.id))
    expect((await call('/events', member.user.id)).status).toBe(403)
    expect(
      (await submit(draft.id, bank.challenge.id, bank.challenge.flag)).status
    ).toBe(403)
    await db
      .update(users)
      .set({ banned: true })
      .where(eq(users.id, admin.user.id))
    expect((await call(`/events/${draft.id}`, admin.user.id)).status).toBe(403)
  })

  test('rejects invalid schedules, duplicate IDs, unknown IDs, and unsupported source challenges', async () => {
    const body = {
      name: 'Workshop',
      startTime: 100,
      endTime: 200,
      challengeIds: [bank.challenge.id],
    }
    for (const patch of [
      { endTime: 100 },
      { challengeIds: [] },
      { challengeIds: [bank.challenge.id, bank.challenge.id] },
      { challengeIds: ['missing'] },
    ]) {
      expect(
        (await call('/events', admin.user.id, 'POST', { ...body, ...patch }))
          .status
      ).toBe(400)
    }
    await db
      .update(challenges)
      .set({
        data: {
          ...bank.challenge,
          instancerConfig: {
            challengeIntegrationId: 'secret',
            config: { token: 'private-token' },
            timeoutMilliseconds: 5000,
          },
        },
      })
      .where(eq(challenges.id, bank.challenge.id))
    const invalid = await call('/events', admin.user.id, 'POST', body)
    expect(invalid.status).toBe(400)
    expect(invalid.body.kind).toBe('badClubEventSelection')
    expect(JSON.stringify(invalid.body)).not.toContain('private-token')
    await seedDemoArchives(db)
    for (const source of [
      { sourceArchiveId: demoIds[2], challengeIds: ['live-memory-desk'] },
      { sourceArchiveId: demoIds[0], challengeIds: ['packet-notes'] },
    ]) {
      expect(
        (await call('/events', admin.user.id, 'POST', { ...body, ...source }))
          .body.kind
      ).toBe('badClubEventSelection')
    }
    expect(await db.select().from(clubEvents)).toEqual([])
  })

  test('copies source snapshots and scopes different flags, scores, progress, and rate limits by event', async () => {
    await seedDemoArchives(db)
    const first = await create({
      sourceArchiveId: demoIds[0],
      challengeIds: ['signal'],
    })
    const second = await create({
      sourceArchiveId: demoIds[1],
      challengeIds: ['signal'],
    })
    await db.delete(clubArchives).where(eq(clubArchives.id, demoIds[0]!))
    expect(
      (await submit(first.id, 'signal', 'UCS{web_signal}')).body.data.result
    ).toBe('incorrect')
    expect(
      (await submit(first.id, 'signal', 'UCS{rookie_signal}')).body.data.result
    ).toBe('correct')
    expect(
      (await submit(first.id, 'signal', 'UCS{rookie_signal}')).body.data.result
    ).toBe('alreadySolved')
    const firstDetail = await call(`/events/${first.id}`, member.user.id)
    expect(firstDetail.body.data.solvedIds).toEqual(['signal'])
    expect(firstDetail.body.data.leaderboard).toEqual([
      expect.objectContaining({ id: member.user.id, score: 100, rank: 1 }),
    ])
    expect(firstDetail.body.data.challenges[0]).toMatchObject({
      points: 100,
      solves: 1,
    })
    expect(JSON.stringify(firstDetail.body)).not.toContain('UCS{rookie_signal}')
    expect(JSON.stringify(firstDetail.body)).not.toContain('staticFlags')
    expect(
      (await call(`/events/${second.id}`, member.user.id)).body.data.solvedIds
    ).toEqual([])
    expect((await call('/events', admin.user.id)).body.data).toContainEqual(
      expect.objectContaining({
        id: first.id,
        solvedCount: 0,
        participantCount: 1,
      })
    )
    for (let index = 0; index < 3; index++)
      await submit(first.id, 'signal', 'wrong')
    expect((await submit(first.id, 'signal', 'wrong')).status).toBe(429)
    expect(
      (await submit(second.id, 'signal', 'UCS{web_signal}')).body.data.result
    ).toBe('correct')
    expect(
      await db.select().from(solves).where(eq(solves.userid, member.user.id))
    ).toEqual([])
    expect(
      await db
        .select()
        .from(clubPracticeSolves)
        .where(eq(clubPracticeSolves.userId, member.user.id))
    ).toEqual([])
    expect(
      (await db.select().from(users).where(eq(users.id, member.user.id)))[0]
        ?.score
    ).toBe(0)
  })

  test('native bank snapshots survive edits and use fixed maximum points independently from live scores', async () => {
    await db
      .update(challenges)
      .set({
        data: {
          ...bank.challenge,
          description: `Do not reveal ${bank.challenge.flag}`,
        },
      })
      .where(eq(challenges.id, bank.challenge.id))
    const event = await create()
    await bank.cleanup()
    const detail = await call(`/events/${event.id}`, member.user.id)
    expect(detail.body.data.challenges[0]).toMatchObject({
      points: 500,
      solves: 0,
      practiceAvailable: true,
    })
    expect(JSON.stringify(detail.body)).not.toContain(bank.challenge.flag)
    const concurrent = await Promise.all([
      submit(event.id, bank.challenge.id, bank.challenge.flag),
      submit(event.id, bank.challenge.id, bank.challenge.flag),
    ])
    expect(concurrent.map(result => result.body.data.result).sort()).toEqual([
      'alreadySolved',
      'correct',
    ])
    expect(
      (await call(`/events/${event.id}`, member.user.id)).body.data
        .leaderboard[0].score
    ).toBe(500)
  })

  test('closing prevents later submissions and archiving freezes scores while practice starts independently', async () => {
    const event = await create()
    expect(
      (
        await call(`/events/${event.id}`, admin.user.id, 'PATCH', {
          startTime: Date.now() - 120_000,
        })
      ).status
    ).toBe(400)
    expect(
      (await call(`/events/${event.id}/archive`, admin.user.id, 'POST')).status
    ).toBe(409)
    expect(
      (await submit(event.id, bank.challenge.id, bank.challenge.flag)).body.data
        .result
    ).toBe('correct')
    expect(
      (
        await call(`/events/${event.id}`, admin.user.id, 'PATCH', {
          endTime: Date.now() - 1,
        })
      ).status
    ).toBe(200)
    expect(
      (await submit(event.id, bank.challenge.id, bank.challenge.flag)).status
    ).toBe(409)
    const archived = await call(
      `/events/${event.id}/archive`,
      admin.user.id,
      'POST'
    )
    expect(archived.status).toBe(200)
    archiveIds.push(archived.body.data.id)
    expect(
      (await call(`/events/${event.id}/archive`, admin.user.id, 'POST')).body
        .data.id
    ).toBe(archived.body.data.id)
    expect(
      (
        await call(`/events/${event.id}`, admin.user.id, 'PATCH', {
          name: 'Changed',
        })
      ).body.kind
    ).toBe('badClubEventFrozen')
    const before = await call(
      `/archives/${archived.body.data.id}`,
      member.user.id
    )
    expect(before.body.data.solvedIds).toEqual([])
    expect(before.body.data.leaderboard[0].score).toBe(500)
    expect(before.body.data.challenges[0].solves).toBe(1)
    expect(
      (
        await call(
          `/archives/${archived.body.data.id}/challenges/${bank.challenge.id}/submit`,
          member.user.id,
          'POST',
          { flag: bank.challenge.flag }
        )
      ).body.data.result
    ).toBe('correct')
    expect(
      (await call(`/archives/${archived.body.data.id}`, member.user.id)).body
        .data.leaderboard
    ).toEqual(before.body.data.leaderboard)
    expect(
      await db
        .select()
        .from(clubEventSolves)
        .where(eq(clubEventSolves.eventId, event.id))
    ).toHaveLength(1)
    await db
      .update(users)
      .set({ name: `${member.user.name}-changed` })
      .where(eq(users.id, member.user.id))
    expect(
      (await call(`/archives/${archived.body.data.id}`, member.user.id)).body
        .data.leaderboard
    ).toEqual(before.body.data.leaderboard)
  })

  test('equal point totals rank by last solve time then solve ID deterministically', async () => {
    const event = await create()
    await db.insert(clubMemberships).values({ userId: guest.user.id })
    expect(
      (await submit(event.id, bank.challenge.id, bank.challenge.flag)).status
    ).toBe(200)
    expect(
      (
        await submit(
          event.id,
          bank.challenge.id,
          bank.challenge.flag,
          guest.user.id
        )
      ).status
    ).toBe(200)
    const timestamp = new Date().toISOString()
    await db
      .update(clubEventSolves)
      .set({ id: 'tie-z', createdAt: timestamp })
      .where(
        and(
          eq(clubEventSolves.eventId, event.id),
          eq(clubEventSolves.userId, member.user.id)
        )
      )
    await db
      .update(clubEventSolves)
      .set({ id: 'tie-a', createdAt: timestamp })
      .where(
        and(
          eq(clubEventSolves.eventId, event.id),
          eq(clubEventSolves.userId, guest.user.id)
        )
      )
    const detail = await call(`/events/${event.id}`, member.user.id)
    expect(
      detail.body.data.leaderboard.map((row: { id: string }) => row.id)
    ).toEqual([guest.user.id, member.user.id])
  })

  test('unpublishing a running event hides its payload and stops new solves for members and managers', async () => {
    const event = await create()
    expect(
      (
        await call(`/events/${event.id}`, admin.user.id, 'PATCH', {
          published: false,
        })
      ).status
    ).toBe(200)
    expect((await call(`/events/${event.id}`, member.user.id)).status).toBe(404)
    expect(
      (await submit(event.id, bank.challenge.id, bank.challenge.flag)).status
    ).toBe(404)
    expect(
      (
        await submit(
          event.id,
          bank.challenge.id,
          bank.challenge.flag,
          admin.user.id
        )
      ).status
    ).toBe(409)
    expect(
      await db
        .select()
        .from(clubEventSolves)
        .where(eq(clubEventSolves.eventId, event.id))
    ).toEqual([])
  })
})
