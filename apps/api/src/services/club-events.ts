import {
  challenges,
  clubArchiveChallenges,
  clubArchives,
  clubEventChallenges,
  clubEvents,
  clubEventSolves,
  users,
  type ArchivedChallenge,
  type DatabaseClient,
  type DatabaseTx,
} from '@rctf/db'
import type {
  CreateClubEventRouteV2,
  UpdateClubEventRouteV2,
  RouteBody,
} from '@rctf/types'
import { and, asc, desc, eq, gt, inArray, isNull, lte, sql } from 'drizzle-orm'
import { timingSafeEqual } from '../util/timing-safe-equal'
import { getClubAccess, snapshotChallenge } from './club'

type Db = DatabaseClient | DatabaseTx
const summarySelection = {
  id: clubEvents.id,
  name: clubEvents.name,
  description: clubEvents.description,
  startTime: clubEvents.startTime,
  endTime: clubEvents.endTime,
  createdAt: clubEvents.createdAt,
  published: clubEvents.published,
  challengeCount: clubEvents.challengeCount,
  archiveId: clubEvents.archiveId,
}
const visible = (canManage: boolean) =>
  canManage ? undefined : eq(clubEvents.published, true)
const isOpen = (event: typeof clubEvents.$inferSelect) => {
  const now = Date.now()
  return (
    event.published &&
    !event.archiveId &&
    event.startTime <= now &&
    now < event.endTime
  )
}

export const getClubEvents = (
  db: Db,
  userId: string,
  canManage: boolean,
  eventId?: string
) =>
  db
    .select({
      ...summarySelection,
      participantCount:
        sql<number>`coalesce(max(${clubArchives.participantCount}), count(distinct ${clubEventSolves.userId}) filter (where ${users.banned} = false))`.mapWith(
          Number
        ),
      solvedCount:
        sql<number>`count(${clubEventSolves.challengeId}) filter (where ${clubEventSolves.userId} = ${userId} and ${users.banned} = false)`.mapWith(
          Number
        ),
    })
    .from(clubEvents)
    .leftJoin(clubEventSolves, eq(clubEventSolves.eventId, clubEvents.id))
    .leftJoin(users, eq(users.id, clubEventSolves.userId))
    .leftJoin(clubArchives, eq(clubArchives.id, clubEvents.archiveId))
    .where(
      and(visible(canManage), eventId ? eq(clubEvents.id, eventId) : undefined)
    )
    .groupBy(clubEvents.id)
    .orderBy(
      desc(clubEvents.startTime),
      desc(clubEvents.createdAt),
      asc(clubEvents.id)
    )

const eventResults = async (db: Db, eventId: string) => {
  const snapshots = await db
    .select({ publicData: clubEventChallenges.publicData })
    .from(clubEventChallenges)
    .where(eq(clubEventChallenges.eventId, eventId))
    .orderBy(asc(clubEventChallenges.challengeId))
  const solved = await db
    .select({
      challengeId: clubEventSolves.challengeId,
      userId: clubEventSolves.userId,
      name: users.name,
      division: users.division,
    })
    .from(clubEventSolves)
    .innerJoin(users, eq(users.id, clubEventSolves.userId))
    .where(and(eq(clubEventSolves.eventId, eventId), eq(users.banned, false)))
    .orderBy(
      asc(clubEventSolves.createdAt),
      asc(clubEventSolves.id),
      asc(clubEventSolves.userId)
    )
  const points = new Map(
    snapshots.map(row => [row.publicData.id, row.publicData.points])
  )
  const counts = new Map<string, number>()
  const teams = new Map<
    string,
    {
      id: string
      name: string
      division: string
      score: number
      lastSolveOrder: number
    }
  >()
  for (const [index, solve] of solved.entries()) {
    const team = teams.get(solve.userId) ?? {
      id: solve.userId,
      name: solve.name,
      division: solve.division,
      score: 0,
      lastSolveOrder: 0,
    }
    team.score += points.get(solve.challengeId) ?? 0
    team.lastSolveOrder = index
    teams.set(solve.userId, team)
    counts.set(solve.challengeId, (counts.get(solve.challengeId) ?? 0) + 1)
  }
  const leaderboard = [...teams.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.lastSolveOrder - b.lastSolveOrder ||
        a.id.localeCompare(b.id)
    )
    .map(({ lastSolveOrder: _lastSolveOrder, ...team }, index) => ({
      ...team,
      rank: index + 1,
    }))
  return {
    challenges: snapshots.map(({ publicData }) => ({
      ...publicData,
      solves: counts.get(publicData.id) ?? 0,
    })),
    leaderboard,
    solved,
  }
}

export const getClubEvent = async (
  db: Db,
  eventId: string,
  userId: string,
  canManage: boolean
) => {
  const [summary] = await getClubEvents(db, userId, canManage, eventId)
  if (!summary) return null
  if (!canManage && Date.now() < summary.startTime)
    return { ...summary, challenges: [], leaderboard: [], solvedIds: [] }
  if (summary.archiveId) {
    const [archive] = await db
      .select({ leaderboard: clubArchives.leaderboard })
      .from(clubArchives)
      .where(eq(clubArchives.id, summary.archiveId))
    const snapshots = await db
      .select({ publicData: clubArchiveChallenges.publicData })
      .from(clubArchiveChallenges)
      .where(eq(clubArchiveChallenges.archiveId, summary.archiveId))
      .orderBy(asc(clubArchiveChallenges.challengeId))
    const solved = await db
      .select({ challengeId: clubEventSolves.challengeId })
      .from(clubEventSolves)
      .where(
        and(
          eq(clubEventSolves.eventId, eventId),
          eq(clubEventSolves.userId, userId)
        )
      )
    return {
      ...summary,
      challenges: snapshots.map(row => row.publicData),
      leaderboard: archive?.leaderboard ?? [],
      solvedIds: solved.map(row => row.challengeId),
    }
  }
  const results = await eventResults(db, eventId)
  return {
    ...summary,
    challenges: results.challenges,
    leaderboard: results.leaderboard,
    solvedIds: results.solved
      .filter(row => row.userId === userId)
      .map(row => row.challengeId),
  }
}

export const createClubEvent = async (
  db: DatabaseClient,
  input: RouteBody<typeof CreateClubEventRouteV2>
) => {
  if (input.endTime <= input.startTime) return 'schedule' as const
  if (
    !input.challengeIds.length ||
    new Set(input.challengeIds).size !== input.challengeIds.length
  )
    return 'selection' as const
  return db.transaction(
    async tx => {
      const snapshots =
        input.sourceArchiveId !== undefined
          ? await tx
              .select({
                challengeId: clubArchiveChallenges.challengeId,
                publicData: clubArchiveChallenges.publicData,
                staticFlags: clubArchiveChallenges.staticFlags,
              })
              .from(clubArchiveChallenges)
              .where(
                and(
                  eq(clubArchiveChallenges.archiveId, input.sourceArchiveId),
                  inArray(clubArchiveChallenges.challengeId, input.challengeIds)
                )
              )
          : (
              await tx
                .select()
                .from(challenges)
                .where(inArray(challenges.id, input.challengeIds))
            ).map(row =>
              snapshotChallenge({
                ...row,
                score: row.data.points.max,
                solveCount: 0,
              })
            )
      if (
        snapshots.length !== input.challengeIds.length ||
        snapshots.some(
          row =>
            !row.publicData.practiceAvailable ||
            !row.staticFlags.length ||
            row.staticFlags.some(
              flag => typeof flag !== 'string' || !flag.length
            ) ||
            !Number.isFinite(row.publicData.points) ||
            row.publicData.points < 0
        )
      )
        return 'selection' as const
      const [event] = await tx
        .insert(clubEvents)
        .values({
          id: crypto.randomUUID(),
          name: input.name,
          description: input.description ?? '',
          startTime: input.startTime,
          endTime: input.endTime,
          published: input.published,
          challengeCount: snapshots.length,
        })
        .returning(summarySelection)
      await tx.insert(clubEventChallenges).values(
        snapshots.map(row => ({
          eventId: event!.id,
          challengeId: row.challengeId,
          staticFlags: row.staticFlags,
          publicData: { ...row.publicData, solves: 0 },
        }))
      )
      return { ...event!, participantCount: 0, solvedCount: 0 }
    },
    { isolationLevel: 'repeatable read' }
  )
}

export const updateClubEvent = async (
  db: DatabaseClient,
  eventId: string,
  userId: string,
  input: RouteBody<typeof UpdateClubEventRouteV2>
) =>
  db.transaction(async tx => {
    const [event] = await tx
      .select()
      .from(clubEvents)
      .where(eq(clubEvents.id, eventId))
      .for('update')
    if (!event) return 'notFound' as const
    if (event.archiveId) return 'frozen' as const
    const startTime = input.startTime ?? event.startTime
    const endTime = input.endTime ?? event.endTime
    if (
      endTime <= startTime ||
      (startTime !== event.startTime && Date.now() >= event.startTime)
    )
      return 'schedule' as const
    await tx
      .update(clubEvents)
      .set({
        name: input.name ?? event.name,
        description: input.description ?? event.description,
        startTime,
        endTime,
        published: input.published ?? event.published,
      })
      .where(eq(clubEvents.id, eventId))
    return (await getClubEvents(tx, userId, true, eventId))[0]!
  })

export const submitClubEvent = async (
  db: DatabaseClient,
  eventId: string,
  challengeId: string,
  userId: string,
  flag: string
) =>
  db.transaction(async tx => {
    // Schedule edits, archiving, and submissions serialize on this same row.
    const [event] = await tx
      .select()
      .from(clubEvents)
      .where(eq(clubEvents.id, eventId))
      .for('update')
    if (!event) return 'notFound' as const
    const access = await getClubAccess(tx, { id: userId })
    if (!access.canAccessArchives) return 'forbidden' as const
    if (!event.published && !access.canManageArchives)
      return 'notFound' as const
    if (!isOpen(event)) return 'closed' as const
    const [challenge] = await tx
      .select({ staticFlags: clubEventChallenges.staticFlags })
      .from(clubEventChallenges)
      .where(
        and(
          eq(clubEventChallenges.eventId, eventId),
          eq(clubEventChallenges.challengeId, challengeId)
        )
      )
    if (!challenge) return 'notFound' as const
    const solveFilter = and(
      eq(clubEventSolves.eventId, eventId),
      eq(clubEventSolves.challengeId, challengeId),
      eq(clubEventSolves.userId, userId)
    )
    const [existing] = await tx
      .select({ id: clubEventSolves.id })
      .from(clubEventSolves)
      .where(solveFilter)
    if (existing) return 'alreadySolved' as const
    let accepted = false
    for (const expected of challenge.staticFlags)
      accepted = timingSafeEqual(expected, flag) || accepted
    if (!accepted) return 'incorrect' as const
    if (!(await getClubAccess(tx, { id: userId })).canAccessArchives)
      return 'forbidden' as const
    if (!isOpen(event)) return 'closed' as const
    // Recheck the persisted state and database clock in the inserting statement.
    const now = sql`extract(epoch from clock_timestamp()) * 1000`
    const inserted = await tx
      .insert(clubEventSolves)
      .select(
        tx
          .select({
            eventId: clubEvents.id,
            userId: sql<string>`${userId}`.as('user_id'),
            challengeId: sql<string>`${challengeId}`.as('challenge_id'),
            id: sql<string>`${crypto.randomUUID()}`.as('id'),
            createdAt: sql<string>`clock_timestamp()`.as('created_at'),
          })
          .from(clubEvents)
          .where(
            and(
              eq(clubEvents.id, eventId),
              eq(clubEvents.published, true),
              isNull(clubEvents.archiveId),
              lte(clubEvents.startTime, now),
              gt(clubEvents.endTime, now)
            )
          )
      )
      .onConflictDoNothing()
      .returning({ id: clubEventSolves.id })
    if (inserted.length) return 'correct' as const
    const [duplicate] = await tx
      .select({ id: clubEventSolves.id })
      .from(clubEventSolves)
      .where(solveFilter)
    return duplicate ? ('alreadySolved' as const) : ('closed' as const)
  })

export const archiveClubEvent = async (db: DatabaseClient, eventId: string) =>
  db.transaction(async tx => {
    const [event] = await tx
      .select()
      .from(clubEvents)
      .where(eq(clubEvents.id, eventId))
      .for('update')
    if (!event) return 'notFound' as const
    if (event.archiveId) return { id: event.archiveId }
    if (Date.now() < event.endTime) return 'closed' as const
    const results = await eventResults(tx, eventId)
    const snapshots = await tx
      .select()
      .from(clubEventChallenges)
      .where(eq(clubEventChallenges.eventId, eventId))
    const finalChallenges = new Map<string, ArchivedChallenge>(
      results.challenges.map(challenge => [challenge.id, challenge])
    )
    const id = crypto.randomUUID()
    await tx.insert(clubArchives).values({
      id,
      name: event.name,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      challengeCount: snapshots.length,
      participantCount: results.leaderboard.length,
      leaderboard: results.leaderboard,
    })
    if (snapshots.length)
      await tx.insert(clubArchiveChallenges).values(
        snapshots.map(row => ({
          archiveId: id,
          challengeId: row.challengeId,
          staticFlags: row.staticFlags,
          publicData: finalChallenges.get(row.challengeId)!,
        }))
      )
    await tx
      .update(clubEvents)
      .set({ archiveId: id })
      .where(eq(clubEvents.id, eventId))
    return { id }
  })
