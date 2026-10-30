import { config } from '@rctf/config'
import {
  challenges,
  clubArchiveChallenges,
  clubArchives,
  clubEventChallenges,
  clubEvents,
  clubEventSolves,
  clubMemberships,
  createDatabase,
} from '@rctf/db'
import { Permissions } from '@rctf/types'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { inArray } from 'drizzle-orm'
import type { Hono } from 'hono'
import {
  getClubTeamProgress,
} from '../../../../apps/api/src/services/club-events'
import { createRedis } from '../../../../apps/api/src/util/redis'
import { getApp, request } from '../../app'
import {
  generateAuthToken,
  generateRealTestUser,
} from '../../util'

const db = createDatabase(config.database.sql).db
let app: Hono<any>
let admin: Awaited<ReturnType<typeof generateRealTestUser>>
let member: Awaited<ReturnType<typeof generateRealTestUser>>
let guest: Awaited<ReturnType<typeof generateRealTestUser>>

const createdEventIds: string[] = []
const createdArchiveIds: string[] = []
const createdChallengeIds: string[] = []

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

const createChallenge = async (category: string) => {
  const id = crypto.randomUUID()
  const flag = crypto.randomUUID()
  const data = {
    name: `Test Challenge ${category}`,
    description: 'Challenge description',
    category,
    author: 'Author',
    files: [],
    flags: [{ provider: 'flags/static', config: { flag } }],
    tiebreakEligible: true,
    points: { min: 100, max: 500 },
  }
  await db.insert(challenges).values({ id, data })
  createdChallengeIds.push(id)
  return { id, flag, data }
}

beforeEach(async () => {
  app = await getApp()
  admin = await generateRealTestUser(
    Permissions.settingsWrite | Permissions.usersWrite | Permissions.challsRead
  )
  member = await generateRealTestUser()
  guest = await generateRealTestUser()
  await db.insert(clubMemberships).values({ userId: member.user.id })
})

afterEach(async () => {
  if (createdEventIds.length) {
    await db
      .delete(clubEventSolves)
      .where(inArray(clubEventSolves.eventId, createdEventIds))
    await db
      .delete(clubEventChallenges)
      .where(inArray(clubEventChallenges.eventId, createdEventIds))
    await db
      .delete(clubEvents)
      .where(inArray(clubEvents.id, createdEventIds.splice(0)))
  }
  if (createdArchiveIds.length) {
    await db
      .delete(clubArchiveChallenges)
      .where(inArray(clubArchiveChallenges.archiveId, createdArchiveIds))
    await db
      .delete(clubArchives)
      .where(inArray(clubArchives.id, createdArchiveIds.splice(0)))
  }
  if (createdChallengeIds.length) {
    await db
      .delete(challenges)
      .where(inArray(challenges.id, createdChallengeIds.splice(0)))
  }
  await member.cleanup()
  await guest.cleanup()
  await admin.cleanup()
  await (await createRedis()).flushall()
})

describe('Team Progress API & Service', () => {
  describe('GET /v2/club/team-progress route permissions', () => {
    test('rejects anonymous callers with 401', async () => {
      const res = await call('/team-progress')
      expect(res.status).toBe(401)
      expect(res.body.kind).toBe('badToken')
    })

    test('rejects guests (non-members) with 403 badPerms', async () => {
      const res = await call('/team-progress', guest.user.id)
      expect(res.status).toBe(403)
      expect(res.body.kind).toBe('badPerms')
    })

    test('allows club members with 200 goodClubTeamProgress', async () => {
      const res = await call('/team-progress', member.user.id)
      expect(res.status).toBe(200)
      expect(res.body.kind).toBe('goodClubTeamProgress')
      expect(res.body.data).toBeDefined()
      expect(typeof res.body.data.totalSolved).toBe('number')
      expect(typeof res.body.data.totalChallenges).toBe('number')
      expect(typeof res.body.data.percentage).toBe('number')
      expect(Array.isArray(res.body.data.categories)).toBe(true)
      expect(Array.isArray(res.body.data.events)).toBe(true)
    })

    test('allows archive managers with 200 goodClubTeamProgress', async () => {
      const res = await call('/team-progress', admin.user.id)
      expect(res.status).toBe(200)
      expect(res.body.kind).toBe('goodClubTeamProgress')
    })
  })

  describe('getClubTeamProgress service logic', () => {
    test('computes progress correctly across active events with categories', async () => {
      const cWeb = await createChallenge('web-exploitation')
      const cCrypto = await createChallenge('cryptography')
      const cPwn = await createChallenge('pwn')

      const eventId = crypto.randomUUID()
      createdEventIds.push(eventId)

      const now = Date.now()
      await db.insert(clubEvents).values({
        id: eventId,
        name: 'Spring Qualifier 2026',
        description: 'Testing event',
        startTime: now - 3600_000,
        endTime: now + 3600_000,
        published: true,
        challengeCount: 3,
        clubOnly: false,
      })

      const makeSnapshot = (id: string, name: string, category: string) => ({
        id,
        name,
        description: 'desc',
        category,
        author: 'author',
        files: [],
        points: 100,
        solves: 0,
        tags: [],
        practiceAvailable: true,
        practiceUnavailableReason: null,
      })

      await db.insert(clubEventChallenges).values([
        {
          eventId,
          challengeId: cWeb.id,
          publicData: makeSnapshot(cWeb.id, 'Web 1', 'web-exploitation'),
          staticFlags: [cWeb.flag],
        },
        {
          eventId,
          challengeId: cCrypto.id,
          publicData: makeSnapshot(cCrypto.id, 'Crypto 1', 'cryptography'),
          staticFlags: [cCrypto.flag],
        },
        {
          eventId,
          challengeId: cPwn.id,
          publicData: makeSnapshot(cPwn.id, 'Pwn 1', 'pwn'),
          staticFlags: [cPwn.flag],
        },
      ])

      // Initial progress: 0 solves
      const initial = await getClubTeamProgress(db, member.user.id)
      const eventInitial = initial.events.find(e => e.id === eventId)
      expect(eventInitial).toBeDefined()
      expect(eventInitial?.solved).toBe(0)
      expect(eventInitial?.total).toBe(3)

      // Add 1 solve for web
      await db.insert(clubEventSolves).values({
        id: crypto.randomUUID(),
        eventId,
        userId: member.user.id,
        challengeId: cWeb.id,
      })

      const afterWeb = await getClubTeamProgress(db, member.user.id)
      const eventAfterWeb = afterWeb.events.find(e => e.id === eventId)
      expect(eventAfterWeb?.solved).toBe(1)
      expect(eventAfterWeb?.total).toBe(3)

      const webCat = afterWeb.categories.find(c => c.category === 'Web')
      expect(webCat).toBeDefined()
      expect(webCat?.solved).toBe(1)
      expect(webCat?.total).toBe(1)
      expect(webCat?.percentage).toBe(100)

      const cryptoCat = afterWeb.categories.find(c => c.category === 'Crypto')
      expect(cryptoCat).toBeDefined()
      expect(cryptoCat?.solved).toBe(0)
      expect(cryptoCat?.total).toBe(1)
      expect(cryptoCat?.percentage).toBe(0)

      const pwnCat = afterWeb.categories.find(c => c.category === 'Pwn')
      expect(pwnCat).toBeDefined()
      expect(pwnCat?.solved).toBe(0)
      expect(pwnCat?.total).toBe(1)
      expect(pwnCat?.percentage).toBe(0)

      // Add solve for crypto via HTTP submit
      const submitRes = await call(
        `/events/${eventId}/challenges/${cCrypto.id}/submit`,
        member.user.id,
        'POST',
        { flag: cCrypto.flag }
      )
      expect(submitRes.status).toBe(200)

      // Fetch progress via HTTP endpoint
      const apiRes = await call('/team-progress', member.user.id)
      expect(apiRes.status).toBe(200)
      const progress = apiRes.body.data

      const eventProg = progress.events.find((e: any) => e.id === eventId)
      expect(eventProg.solved).toBe(2)
      expect(eventProg.total).toBe(3)

      const webCategory = progress.categories.find((c: any) => c.category === 'Web')
      expect(webCategory.solved).toBe(1)
      expect(webCategory.total).toBe(1)
      expect(webCategory.percentage).toBe(100)

      const cryptoCategory = progress.categories.find((c: any) => c.category === 'Crypto')
      expect(cryptoCategory.solved).toBe(1)
      expect(cryptoCategory.total).toBe(1)
      expect(cryptoCategory.percentage).toBe(100)
    })

    test('retrieves challenges from clubArchiveChallenges for archived events', async () => {
      const cRev = await createChallenge('reverse')
      const cMisc = await createChallenge('misc')

      const archiveId = crypto.randomUUID()
      const eventId = crypto.randomUUID()
      createdArchiveIds.push(archiveId)
      createdEventIds.push(eventId)

      const now = Date.now()
      await db.insert(clubArchives).values({
        id: archiveId,
        name: 'Archived Workshop',
        description: 'Past event',
        startTime: now - 7200_000,
        endTime: now - 3600_000,
        challengeCount: 2,
        participantCount: 1,
        leaderboard: [],
      })

      await db.insert(clubEvents).values({
        id: eventId,
        name: 'Archived Workshop',
        description: 'Past event',
        startTime: now - 7200_000,
        endTime: now - 3600_000,
        published: true,
        challengeCount: 2,
        clubOnly: true,
        archiveId,
      })

      const makeSnapshot = (id: string, name: string, category: string) => ({
        id,
        name,
        description: 'desc',
        category,
        author: 'author',
        files: [],
        points: 200,
        solves: 1,
        tags: [],
        practiceAvailable: true,
        practiceUnavailableReason: null,
      })

      await db.insert(clubEventChallenges).values([
        {
          eventId,
          challengeId: cRev.id,
          publicData: makeSnapshot(cRev.id, 'Rev 1', 'reverse'),
          staticFlags: [cRev.flag],
        },
        {
          eventId,
          challengeId: cMisc.id,
          publicData: makeSnapshot(cMisc.id, 'Misc 1', 'misc'),
          staticFlags: [cMisc.flag],
        },
      ])

      await db.insert(clubArchiveChallenges).values([
        {
          archiveId,
          challengeId: cRev.id,
          publicData: makeSnapshot(cRev.id, 'Rev 1', 'reverse'),
          staticFlags: [cRev.flag],
        },
        {
          archiveId,
          challengeId: cMisc.id,
          publicData: makeSnapshot(cMisc.id, 'Misc 1', 'misc'),
          staticFlags: [cMisc.flag],
        },
      ])

      // Add a solve for cRev
      await db.insert(clubEventSolves).values({
        id: crypto.randomUUID(),
        eventId,
        userId: member.user.id,
        challengeId: cRev.id,
      })

      const progress = await getClubTeamProgress(db, member.user.id)
      const ev = progress.events.find(e => e.id === eventId)
      expect(ev).toBeDefined()
      expect(ev?.solved).toBe(1)
      expect(ev?.total).toBe(2)

      const revCat = progress.categories.find(c => c.category === 'Reverse')
      expect(revCat).toBeDefined()
      expect(revCat?.solved).toBe(1)
      expect(revCat?.total).toBe(1)
      expect(revCat?.percentage).toBe(100)

      const miscCat = progress.categories.find(c => c.category === 'Misc')
      expect(miscCat).toBeDefined()
      expect(miscCat?.solved).toBe(0)
      expect(miscCat?.total).toBe(1)
      expect(miscCat?.percentage).toBe(0)
    })

    test('ignores unpublished events and future events that have not started', async () => {
      const _c = await createChallenge('forensic')
      const now = Date.now()

      const unpublishedId = crypto.randomUUID()
      const futureId = crypto.randomUUID()
      createdEventIds.push(unpublishedId, futureId)

      await db.insert(clubEvents).values([
        {
          id: unpublishedId,
          name: 'Unpublished Event',
          description: 'Draft',
          startTime: now - 3600_000,
          endTime: now + 3600_000,
          published: false,
          challengeCount: 1,
          clubOnly: false,
        },
        {
          id: futureId,
          name: 'Future Event',
          description: 'Not started',
          startTime: now + 3600_000,
          endTime: now + 7200_000,
          published: true,
          challengeCount: 1,
          clubOnly: false,
        },
      ])

      const progress = await getClubTeamProgress(db, member.user.id)
      const unpub = progress.events.find(e => e.id === unpublishedId)
      const fut = progress.events.find(e => e.id === futureId)
      expect(unpub).toBeUndefined()
      expect(fut).toBeUndefined()
    })
  })
})
