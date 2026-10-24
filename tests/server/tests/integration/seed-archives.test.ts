import { config } from '@rctf/config'
import {
  challenges,
  clubArchiveChallenges,
  clubArchives,
  clubPracticeSolves,
  createDatabase,
  settings,
  solves,
  users,
} from '@rctf/db'
import { ClubArchiveChallengeSchema } from '@rctf/types'
import { afterEach, describe, expect, test } from 'bun:test'
import { eq, inArray, sql } from 'drizzle-orm'
import { seedDemoArchives } from '../../../../apps/cli/src/commands/seed-archives'
import { generateChallenge, generateRealTestUser } from '../../util'

const db = createDatabase(config.database.sql).db
const ids = [
  'ucs-demo-rookie-2026-09',
  'ucs-demo-web-crypto-2026-08',
  'ucs-demo-forensics-2026-07',
]

afterEach(async () => {
  await db.execute(
    sql`drop trigger if exists reject_demo_archive on club_archive_challenges`
  )
  await db.execute(sql`drop function if exists reject_demo_archive()`)
  await db.delete(clubArchives).where(inArray(clubArchives.id, ids))
})

describe('additive demo archive seeding', () => {
  test('creates three complete past events with valid, self-contained practice snapshots', async () => {
    expect(await seedDemoArchives(db)).toEqual({ created: ids, skipped: [] })
    const archives = await db
      .select()
      .from(clubArchives)
      .where(inArray(clubArchives.id, ids))
    const snapshots = await db
      .select()
      .from(clubArchiveChallenges)
      .where(inArray(clubArchiveChallenges.archiveId, ids))
    expect(archives.map(archive => archive.name).sort()).toEqual([
      'UCS Forensics Night',
      'UCS Rookie CTF',
      'UCS Web & Crypto Lab',
    ])
    for (const archive of archives) {
      const rows = snapshots.filter(row => row.archiveId === archive.id)
      expect(archive.description).toStartWith('Demo archive for club practice.')
      expect(archive.startTime).toBeLessThan(archive.endTime)
      expect(archive.endTime).toBeLessThan(Date.parse('2026-10-01T00:00:00Z'))
      expect(rows.length).toBeGreaterThanOrEqual(4)
      expect(rows.length).toBeLessThanOrEqual(8)
      expect(archive.challengeCount).toBe(rows.length)
      expect(new Set(rows.map(row => row.challengeId)).size).toBe(rows.length)
      expect(archive.participantCount).toBe(archive.leaderboard.length)
      expect(archive.leaderboard[0]?.score).toBe(
        rows.reduce((sum, row) => sum + row.publicData.points, 0)
      )
      expect(
        archive.leaderboard.every(team => team.name.startsWith('Demo Team '))
      ).toBe(true)
      for (const row of rows) {
        expect(
          ClubArchiveChallengeSchema.safeParse(row.publicData).success
        ).toBe(true)
        expect(row.publicData.id).toBe(row.challengeId)
        expect(row.publicData.description.length).toBeGreaterThan(70)
        if (row.publicData.practiceAvailable) {
          expect(row.staticFlags).toHaveLength(1)
          expect(row.publicData.practiceUnavailableReason).toBeNull()
          expect(row.publicData.description).toContain('```')
        } else {
          expect(row.staticFlags).toEqual([])
          expect(row.publicData.practiceUnavailableReason).toEqual(
            expect.any(String)
          )
        }
        for (const flag of row.staticFlags) {
          expect(flag).toMatch(/^UCS\{.+\}$/)
          expect(JSON.stringify(row.publicData)).not.toContain(flag)
        }
      }
    }
    expect(new Set(snapshots.map(row => row.publicData.category))).toEqual(
      new Set(['Web', 'Crypto', 'Reverse', 'Forensics', 'Misc'])
    )
    expect(
      snapshots.filter(row => !row.publicData.practiceAvailable)
    ).toHaveLength(1)
    expect(snapshots.filter(row => row.challengeId === 'signal')).toHaveLength(
      2
    )
    expect(
      new Set(
        snapshots
          .filter(row => row.challengeId === 'signal')
          .map(row => row.staticFlags[0])
      ).size
    ).toBe(2)
  })

  test('repeat runs skip entire existing archives and preserve solves and live event data', async () => {
    const user = await generateRealTestUser()
    const challenge = await generateChallenge()
    const settingId = 'seed-archives-preservation-test'
    try {
      await db
        .insert(settings)
        .values({ id: settingId, data: { ctfName: 'Keep this event' } })
      await db.insert(solves).values({
        id: crypto.randomUUID(),
        userid: user.user.id,
        challengeid: challenge.challenge.id,
        points: 123,
        createdat: new Date().toISOString(),
      })
      const before = {
        users: await db.select().from(users),
        challenges: await db.select().from(challenges),
        solves: await db.select().from(solves),
        settings: await db.select().from(settings),
      }
      expect((await seedDemoArchives(db)).created).toEqual(ids)
      await db
        .update(clubArchives)
        .set({ name: 'Edited demo name' })
        .where(eq(clubArchives.id, ids[0]!))
      await db.insert(clubPracticeSolves).values({
        archiveId: ids[0]!,
        challengeId: 'signal',
        userId: user.user.id,
      })
      await db
        .delete(clubArchiveChallenges)
        .where(eq(clubArchiveChallenges.challengeId, 'live-memory-desk'))
      const snapshots = await db.select().from(clubArchiveChallenges)
      expect(await seedDemoArchives(db)).toEqual({ created: [], skipped: ids })
      expect(
        (
          await db
            .select()
            .from(clubArchives)
            .where(eq(clubArchives.id, ids[0]!))
        )[0]?.name
      ).toBe('Edited demo name')
      expect(await db.select().from(clubArchiveChallenges)).toEqual(snapshots)
      expect(
        await db
          .select()
          .from(clubPracticeSolves)
          .where(eq(clubPracticeSolves.userId, user.user.id))
      ).toHaveLength(1)
      expect({
        users: await db.select().from(users),
        challenges: await db.select().from(challenges),
        solves: await db.select().from(solves),
        settings: await db.select().from(settings),
      }).toEqual(before)
    } finally {
      await db.delete(settings).where(eq(settings.id, settingId))
      await challenge.cleanup()
      await user.cleanup()
    }
  })

  test('a snapshot insert failure rolls back that entire archive', async () => {
    await db.execute(sql`
      create function reject_demo_archive() returns trigger language plpgsql as $$
      begin
        if new.archive_id = 'ucs-demo-web-crypto-2026-08' then
          raise exception 'Simulated snapshot write failure';
        end if;
        return new;
      end $$
    `)
    await db.execute(sql`
      create trigger reject_demo_archive before insert on club_archive_challenges
      for each row execute function reject_demo_archive()
    `)
    await expect(seedDemoArchives(db)).rejects.toThrow()
    expect(
      (
        await db
          .select({ id: clubArchives.id })
          .from(clubArchives)
          .where(inArray(clubArchives.id, ids))
      ).map(row => row.id)
    ).toEqual([ids[0]!])
    expect(
      await db
        .select()
        .from(clubArchiveChallenges)
        .where(eq(clubArchiveChallenges.archiveId, ids[1]!))
    ).toEqual([])
  })
})
