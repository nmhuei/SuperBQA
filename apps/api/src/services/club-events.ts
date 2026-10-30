import {
  challenges,
  clubArchiveChallenges,
  clubArchives,
  clubEventChallenges,
  clubEvents,
  clubEventSolves,
  submissions,
  users,
  type ArchivedChallenge,
  type DatabaseClient,
  type DatabaseTx,
} from '@rctf/db'
import {
  SubmissionKind,
  SubmissionResult,
  type CreateClubEventRouteV2,
  type UpdateClubEventRouteV2,
  type RouteBody,
  type ClubTeamProgressCategory,
  type ClubTeamProgressData,
  type ClubTeamProgressEvent,
} from '@rctf/types'
import { and, asc, count, desc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm'
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
  clubOnly: clubEvents.clubOnly,
  challengeCount: clubEvents.challengeCount,
  archiveId: clubEvents.archiveId,
}
const visible = (canManage: boolean, isClubMember: boolean) =>
  canManage
    ? undefined
    : isClubMember
      ? eq(clubEvents.published, true)
      : and(eq(clubEvents.published, true), eq(clubEvents.clubOnly, false))
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
  userId: string | undefined,
  canManage: boolean,
  isClubMember = false,
  eventId?: string
) =>
  db
    .select({
      ...summarySelection,
      participantCount:
        sql<number>`coalesce(max(${clubArchives.participantCount}), count(distinct ${clubEventSolves.userId}) filter (where ${users.banned} = false))`.mapWith(
          Number
        ),
      solvedCount: userId
        ? sql<number>`count(${clubEventSolves.challengeId}) filter (where ${clubEventSolves.userId} = ${userId} and ${users.banned} = false)`.mapWith(
            Number
          )
        : sql<number>`0`.mapWith(Number),
    })
    .from(clubEvents)
    .leftJoin(clubEventSolves, eq(clubEventSolves.eventId, clubEvents.id))
    .leftJoin(users, eq(users.id, clubEventSolves.userId))
    .leftJoin(clubArchives, eq(clubArchives.id, clubEvents.archiveId))
    .where(
      and(
        visible(canManage, isClubMember),
        eventId ? eq(clubEvents.id, eventId) : undefined
      )
    )
    .groupBy(clubEvents.id)
    .orderBy(
      desc(clubEvents.startTime),
      desc(clubEvents.createdAt),
      asc(clubEvents.id)
    )

const eventResults = async (db: Db, eventId: string, canManage = false) => {
  const snapshots = await db
    .select({
      publicData: clubEventChallenges.publicData,
      staticFlags: clubEventChallenges.staticFlags,
    })
    .from(clubEventChallenges)
    .where(eq(clubEventChallenges.eventId, eventId))
    .orderBy(asc(clubEventChallenges.challengeId))
  const solved = await db
    .select({
      challengeId: clubEventSolves.challengeId,
      userId: clubEventSolves.userId,
      name: users.name,
      division: users.division,
      createdAt: clubEventSolves.createdAt,
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
  const firstSolversMap = new Map<string, { id: string }[]>()
  for (const solve of solved) {
    const list = firstSolversMap.get(solve.challengeId) ?? []
    if (list.length < 3) {
      list.push({ id: solve.userId })
      firstSolversMap.set(solve.challengeId, list)
    }
  }

  const teams = new Map<
    string,
    {
      id: string
      name: string
      division: string
      score: number
      lastSolveOrder: number
      solves: { id: string; solveTime: number }[]
      graph: { score: number; time: number }[]
    }
  >()
  for (const [index, solve] of solved.entries()) {
    const solveTime = new Date(solve.createdAt).getTime()
    const team = teams.get(solve.userId) ?? {
      id: solve.userId,
      name: solve.name,
      division: solve.division,
      score: 0,
      lastSolveOrder: 0,
      solves: [],
      graph: [],
    }
    team.score += points.get(solve.challengeId) ?? 0
    team.lastSolveOrder = index
    team.solves.push({ id: solve.challengeId, solveTime })
    team.graph.push({ score: team.score, time: solveTime })
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
    challenges: snapshots.map(({ publicData, staticFlags }) => ({
      ...publicData,
      solves: counts.get(publicData.id) ?? 0,
      firstSolvers: firstSolversMap.get(publicData.id) ?? [],
      ...(canManage ? { flags: staticFlags } : {}),
    })),
    leaderboard,
    solved,
  }
}

export const getClubEvent = async (
  db: Db,
  eventId: string,
  userId: string | undefined,
  canManage: boolean,
  isClubMember = false
) => {
  const [summary] = await getClubEvents(
    db,
    userId,
    canManage,
    isClubMember,
    eventId
  )
  if (!summary) return null
  if (!canManage && Date.now() < summary.startTime)
    return { ...summary, challenges: [], leaderboard: [], solvedIds: [] }
  if (summary.archiveId) {
    const [archive] = await db
      .select({ leaderboard: clubArchives.leaderboard })
      .from(clubArchives)
      .where(eq(clubArchives.id, summary.archiveId))
    const snapshots = await db
      .select({
        publicData: clubArchiveChallenges.publicData,
        staticFlags: clubArchiveChallenges.staticFlags,
      })
      .from(clubArchiveChallenges)
      .where(eq(clubArchiveChallenges.archiveId, summary.archiveId))
      .orderBy(asc(clubArchiveChallenges.challengeId))
    const solved = userId
      ? await db
          .select({ challengeId: clubEventSolves.challengeId })
          .from(clubEventSolves)
          .where(
            and(
              eq(clubEventSolves.eventId, eventId),
              eq(clubEventSolves.userId, userId)
            )
          )
      : []
    return {
      ...summary,
      challenges: snapshots.map(row => ({
        ...row.publicData,
        ...(canManage ? { flags: row.staticFlags } : {}),
      })),
      leaderboard: archive?.leaderboard ?? [],
      solvedIds: solved.map(row => row.challengeId),
    }
  }
  const results = await eventResults(db, eventId, canManage)
  return {
    ...summary,
    challenges: results.challenges,
    leaderboard: results.leaderboard,
    solvedIds: userId
      ? results.solved
          .filter(row => row.userId === userId)
          .map(row => row.challengeId)
      : [],
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
          clubOnly: input.clubOnly,
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
        clubOnly: input.clubOnly ?? event.clubOnly,
      })
      .where(eq(clubEvents.id, eventId))
    return (await getClubEvents(tx, userId, true, true, eventId))[0]!
  })

export const submitClubEvent = async (
  db: DatabaseClient,
  eventId: string,
  challengeId: string,
  userId: string,
  flag: string,
  ip = '127.0.0.1'
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
    if (event.clubOnly && !access.canAccessArchives) return 'forbidden' as const
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
    if (existing) {
      await tx.insert(submissions).values({
        id: crypto.randomUUID(),
        kind: SubmissionKind.FLAG,
        challengeId,
        userId,
        ip,
        result: SubmissionResult.ALREADY_SOLVED,
        details: { eventId, submittedFlag: flag },
        relatedId: eventId,
        createdAt: new Date().toISOString(),
      })
      return 'alreadySolved' as const
    }
    let accepted = false
    for (const expected of challenge.staticFlags)
      accepted = timingSafeEqual(expected, flag) || accepted
    if (!accepted) {
      await tx.insert(submissions).values({
        id: crypto.randomUUID(),
        kind: SubmissionKind.FLAG,
        challengeId,
        userId,
        ip,
        result: SubmissionResult.INCORRECT,
        details: { eventId, submittedFlag: flag },
        relatedId: eventId,
        createdAt: new Date().toISOString(),
      })
      return 'incorrect' as const
    }
    if (
      event.clubOnly &&
      !(await getClubAccess(tx, { id: userId })).canAccessArchives
    )
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
    if (inserted.length) {
      await tx.insert(submissions).values({
        id: crypto.randomUUID(),
        kind: SubmissionKind.FLAG,
        challengeId,
        userId,
        ip,
        result: SubmissionResult.CORRECT,
        details: { eventId, submittedFlag: flag },
        relatedId: eventId,
        createdAt: new Date().toISOString(),
      })
      return 'correct' as const
    }
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

export const getClubEventSubmissions = async (db: Db, eventId: string) => {
  const solves = await db
    .select({
      id: clubEventSolves.id,
      userId: clubEventSolves.userId,
      userName: users.name,
      challengeId: clubEventSolves.challengeId,
      createdAt: clubEventSolves.createdAt,
    })
    .from(clubEventSolves)
    .innerJoin(users, eq(users.id, clubEventSolves.userId))
    .where(eq(clubEventSolves.eventId, eventId))
    .orderBy(desc(clubEventSolves.createdAt))

  const challRows = await db
    .select({
      challengeId: clubEventChallenges.challengeId,
      publicData: clubEventChallenges.publicData,
    })
    .from(clubEventChallenges)
    .where(eq(clubEventChallenges.eventId, eventId))

  const challengeMap = new Map(
    challRows.map(r => [r.challengeId, r.publicData.name])
  )

  const logs = await db
    .select({
      id: submissions.id,
      userId: submissions.userId,
      userName: users.name,
      challengeId: submissions.challengeId,
      result: submissions.result,
      details: submissions.details,
      createdAt: submissions.createdAt,
    })
    .from(submissions)
    .innerJoin(users, eq(users.id, submissions.userId))
    .where(
      or(
        eq(submissions.relatedId, eventId),
        sql`${submissions.details} ->> 'eventId' = ${eventId}`
      )
    )
    .orderBy(desc(submissions.createdAt))

  const items: Array<{
    id: string
    userId: string
    userName: string
    challengeId: string
    challengeName: string
    submittedFlag?: string
    result: string
    createdAt: string
    isSolve: boolean
    solveId?: string
  }> = []

  for (const log of logs) {
    const flag =
      typeof log.details?.submittedFlag === 'string'
        ? log.details.submittedFlag
        : undefined
    items.push({
      id: log.id,
      userId: log.userId,
      userName: log.userName ?? log.userId,
      challengeId: log.challengeId,
      challengeName: challengeMap.get(log.challengeId) ?? log.challengeId,
      submittedFlag: flag,
      result: log.result,
      createdAt:
        typeof log.createdAt === 'string'
          ? log.createdAt
          : new Date(log.createdAt).toISOString(),
      isSolve: log.result === 'correct',
    })
  }

  for (const s of solves) {
    const match = items.find(
      item =>
        item.isSolve &&
        item.userId === s.userId &&
        item.challengeId === s.challengeId
    )
    if (match) {
      match.solveId = s.id
    } else {
      items.push({
        id: s.id,
        userId: s.userId,
        userName: s.userName ?? s.userId,
        challengeId: s.challengeId,
        challengeName: challengeMap.get(s.challengeId) ?? s.challengeId,
        result: 'correct',
        createdAt:
          typeof s.createdAt === 'string'
            ? s.createdAt
            : new Date(s.createdAt).toISOString(),
        isSolve: true,
        solveId: s.id,
      })
    }
  }

  items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  return items
}

export const deleteClubEventSolve = async (
  db: Db,
  eventId: string,
  solveId: string
) => {
  const [event] = await db
    .select({ archiveId: clubEvents.archiveId })
    .from(clubEvents)
    .where(eq(clubEvents.id, eventId))
  if (!event || event.archiveId) return false

  const deleted = await db
    .delete(clubEventSolves)
    .where(
      and(eq(clubEventSolves.eventId, eventId), eq(clubEventSolves.id, solveId))
    )
    .returning({ id: clubEventSolves.id })
  return deleted.length > 0
}

export const addClubEventChallenges = async (
  db: DatabaseClient,
  eventId: string,
  challengeIds: string[]
) => {
  const [event] = await db
    .select({ archiveId: clubEvents.archiveId })
    .from(clubEvents)
    .where(eq(clubEvents.id, eventId))
  if (!event || event.archiveId) return 0

  const challRows = await db
    .select()
    .from(challenges)
    .where(inArray(challenges.id, challengeIds))

  const snapshots = challRows.map(row =>
    snapshotChallenge({
      ...row,
      score: row.data.points.max,
      solveCount: 0,
    })
  )

  let added = 0
  for (const snap of snapshots) {
    const inserted = await db
      .insert(clubEventChallenges)
      .values({
        eventId,
        challengeId: snap.challengeId,
        publicData: snap.publicData,
        staticFlags: snap.staticFlags,
      })
      .onConflictDoNothing()
      .returning({ challengeId: clubEventChallenges.challengeId })
    if (inserted.length) added++
  }

  const countRes = await db
    .select({ count: count() })
    .from(clubEventChallenges)
    .where(eq(clubEventChallenges.eventId, eventId))
  const newCount = countRes[0]?.count ?? 0
  await db
    .update(clubEvents)
    .set({ challengeCount: newCount })
    .where(eq(clubEvents.id, eventId))

  return added
}

export const deleteClubEventChallenge = async (
  db: DatabaseClient,
  eventId: string,
  challengeId: string
) => {
  const [event] = await db
    .select({ archiveId: clubEvents.archiveId })
    .from(clubEvents)
    .where(eq(clubEvents.id, eventId))
  if (!event || event.archiveId) return false

  const deleted = await db
    .delete(clubEventChallenges)
    .where(
      and(
        eq(clubEventChallenges.eventId, eventId),
        eq(clubEventChallenges.challengeId, challengeId)
      )
    )
    .returning({ challengeId: clubEventChallenges.challengeId })

  const countRes = await db
    .select({ count: count() })
    .from(clubEventChallenges)
    .where(eq(clubEventChallenges.eventId, eventId))
  const newCount = countRes[0]?.count ?? 0
  await db
    .update(clubEvents)
    .set({ challengeCount: newCount })
    .where(eq(clubEvents.id, eventId))

  return deleted.length > 0
}

export const PROMINENT_CATEGORIES = [
  'Web',
  'Crypto',
  'Pwn',
  'Reverse',
  'Forensics',
  'Misc',
  'Other',
] as const
export type ProminentCategory = (typeof PROMINENT_CATEGORIES)[number]

export const normalizeCategory = (
  rawCategory: string | undefined | null
): ProminentCategory => {
  if (!rawCategory) return 'Other'
  const c = rawCategory.trim().toLowerCase()
  if (
    c === 'web' ||
    c.startsWith('web-') ||
    c.startsWith('web/') ||
    c.startsWith('web ') ||
    c.startsWith('web_') ||
    c === 'web exploitation'
  ) {
    return 'Web'
  }
  if (
    c === 'crypto' ||
    c === 'cryptography' ||
    c.startsWith('crypto-') ||
    c.startsWith('crypto/') ||
    c.startsWith('crypto ') ||
    c.startsWith('crypto_') ||
    c.startsWith('cryptography-') ||
    c.startsWith('cryptography/') ||
    c.startsWith('cryptography ')
  ) {
    return 'Crypto'
  }
  if (
    c === 'pwn' ||
    c === 'binary' ||
    c === 'binary exploitation' ||
    c === 'binary-exploitation' ||
    c.startsWith('pwn-') ||
    c.startsWith('pwn/') ||
    c.startsWith('pwn ') ||
    c.startsWith('pwn_') ||
    c.startsWith('pwnable') ||
    c.startsWith('binary exploitation') ||
    c.startsWith('binary-')
  ) {
    return 'Pwn'
  }
  if (
    c === 'rev' ||
    c === 'reverse' ||
    c === 'reversing' ||
    c === 'reverse engineering' ||
    c === 'reverse-engineering' ||
    c.startsWith('rev-') ||
    c.startsWith('rev/') ||
    c.startsWith('rev ') ||
    c.startsWith('rev_') ||
    c.startsWith('reverse-') ||
    c.startsWith('reverse/') ||
    c.startsWith('reverse ') ||
    c.startsWith('reverse_') ||
    c.startsWith('reversing-') ||
    c.startsWith('reversing/') ||
    c.startsWith('reverse engineering')
  ) {
    return 'Reverse'
  }
  if (
    c === 'forensic' ||
    c === 'forensics' ||
    c.startsWith('forensic-') ||
    c.startsWith('forensic/') ||
    c.startsWith('forensic ') ||
    c.startsWith('forensic_') ||
    c.startsWith('forensics-') ||
    c.startsWith('forensics/') ||
    c.startsWith('forensics ') ||
    c.startsWith('forensics_')
  ) {
    return 'Forensics'
  }
  if (
    c === 'misc' ||
    c === 'miscellaneous' ||
    c.startsWith('misc-') ||
    c.startsWith('misc/') ||
    c.startsWith('misc ') ||
    c.startsWith('misc_') ||
    c.startsWith('miscellaneous-') ||
    c.startsWith('miscellaneous/') ||
    c.startsWith('miscellaneous ')
  ) {
    return 'Misc'
  }
  return 'Other'
}

export const getClubTeamProgress = async (
  db: Db,
  userId: string
): Promise<ClubTeamProgressData> => {
  const now = Date.now()
  const eventRows = await db
    .select({
      id: clubEvents.id,
      name: clubEvents.name,
      startTime: clubEvents.startTime,
      endTime: clubEvents.endTime,
      archiveId: clubEvents.archiveId,
    })
    .from(clubEvents)
    .where(
      and(
        eq(clubEvents.published, true),
        lte(clubEvents.startTime, now)
      )
    )
    .orderBy(
      desc(clubEvents.startTime),
      desc(clubEvents.createdAt),
      asc(clubEvents.id)
    )

  if (eventRows.length === 0) {
    return {
      totalSolved: 0,
      totalChallenges: 0,
      percentage: 0,
      categories: [],
      events: [],
    }
  }

  const nonArchivedEventIds = eventRows
    .filter(e => !e.archiveId)
    .map(e => e.id)
  const archiveIds = [
    ...new Set(
      eventRows
        .filter(e => Boolean(e.archiveId))
        .map(e => e.archiveId as string)
    ),
  ]

  const [nonArchivedChallenges, archivedChallenges, solveRows] =
    await Promise.all([
      nonArchivedEventIds.length > 0
        ? db
            .select({
              eventId: clubEventChallenges.eventId,
              challengeId: clubEventChallenges.challengeId,
              publicData: clubEventChallenges.publicData,
            })
            .from(clubEventChallenges)
            .where(inArray(clubEventChallenges.eventId, nonArchivedEventIds))
            .orderBy(asc(clubEventChallenges.challengeId))
        : [],
      archiveIds.length > 0
        ? db
            .select({
              archiveId: clubArchiveChallenges.archiveId,
              challengeId: clubArchiveChallenges.challengeId,
              publicData: clubArchiveChallenges.publicData,
            })
            .from(clubArchiveChallenges)
            .where(inArray(clubArchiveChallenges.archiveId, archiveIds))
            .orderBy(asc(clubArchiveChallenges.challengeId))
        : [],
      db
        .select({
          eventId: clubEventSolves.eventId,
          challengeId: clubEventSolves.challengeId,
        })
        .from(clubEventSolves)
        .where(
          and(
            inArray(
              clubEventSolves.eventId,
              eventRows.map(e => e.id)
            ),
            eq(clubEventSolves.userId, userId)
          )
        ),
    ])

  const challengesByEvent = new Map<
    string,
    Array<{ challengeId: string; publicData: ArchivedChallenge }>
  >()
  for (const c of nonArchivedChallenges) {
    let list = challengesByEvent.get(c.eventId)
    if (!list) {
      list = []
      challengesByEvent.set(c.eventId, list)
    }
    list.push(c)
  }

  const challengesByArchive = new Map<
    string,
    Array<{ challengeId: string; publicData: ArchivedChallenge }>
  >()
  for (const c of archivedChallenges) {
    let list = challengesByArchive.get(c.archiveId)
    if (!list) {
      list = []
      challengesByArchive.set(c.archiveId, list)
    }
    list.push(c)
  }

  const solvesByEvent = new Map<string, Set<string>>()
  for (const s of solveRows) {
    let set = solvesByEvent.get(s.eventId)
    if (!set) {
      set = new Set()
      solvesByEvent.set(s.eventId, set)
    }
    set.add(s.challengeId)
  }

  const categoryStatsMap = new Map<
    ProminentCategory,
    { solved: number; total: number }
  >()
  for (const cat of PROMINENT_CATEGORIES) {
    categoryStatsMap.set(cat, { solved: 0, total: 0 })
  }

  const events: ClubTeamProgressEvent[] = []
  let totalSolved = 0
  let totalChallenges = 0

  for (const event of eventRows) {
    const eventSolves = solvesByEvent.get(event.id) ?? new Set<string>()
    const challs = event.archiveId
      ? (challengesByArchive.get(event.archiveId) ?? [])
      : (challengesByEvent.get(event.id) ?? [])

    let eventSolved = 0
    const eventTotal = challs.length

    for (const ch of challs) {
      const isSolved = eventSolves.has(ch.challengeId)
      if (isSolved) {
        eventSolved++
      }
      const cat = normalizeCategory(ch.publicData?.category)
      const stats = categoryStatsMap.get(cat) ?? categoryStatsMap.get('Other')!
      stats.total++
      if (isSolved) {
        stats.solved++
      }
    }

    totalSolved += eventSolved
    totalChallenges += eventTotal

    events.push({
      id: event.id,
      name: event.name,
      startTime: Number(event.startTime),
      endTime: Number(event.endTime),
      solved: eventSolved,
      total: eventTotal,
    })
  }

  const categories: ClubTeamProgressCategory[] = []
  for (const cat of PROMINENT_CATEGORIES) {
    const stats = categoryStatsMap.get(cat)!
    if (stats.total > 0) {
      categories.push({
        category: cat,
        solved: stats.solved,
        total: stats.total,
        percentage: Math.round((stats.solved / stats.total) * 100),
      })
    }
  }

  const percentage =
    totalChallenges > 0 ? Math.round((totalSolved / totalChallenges) * 100) : 0

  return {
    totalSolved,
    totalChallenges,
    percentage,
    categories,
    events,
  }
}

export const syncClubEventChallenge = async (
  db: DatabaseClient,
  challenge: typeof challenges.$inferSelect
) => {
  const activeEvents = await db
    .select({ id: clubEvents.id })
    .from(clubEvents)
    .where(isNull(clubEvents.archiveId))

  if (activeEvents.length === 0) return

  const activeEventIds = activeEvents.map(e => e.id)

  const snap = snapshotChallenge({
    ...challenge,
    score: challenge.data.points.max,
    solveCount: 0,
  })

  await db
    .update(clubEventChallenges)
    .set({
      publicData: snap.publicData,
      staticFlags: snap.staticFlags,
    })
    .where(
      and(
        eq(clubEventChallenges.challengeId, challenge.id),
        inArray(clubEventChallenges.eventId, activeEventIds)
      )
    )
}

export const syncAllActiveClubEventChallenges = async (db: DatabaseClient) => {
  const activeEvents = await db
    .select({ id: clubEvents.id })
    .from(clubEvents)
    .where(isNull(clubEvents.archiveId))

  if (activeEvents.length === 0) return

  const activeEventIds = activeEvents.map(e => e.id)

  const activeEventChalls = await db
    .select({
      challengeId: clubEventChallenges.challengeId,
    })
    .from(clubEventChallenges)
    .where(inArray(clubEventChallenges.eventId, activeEventIds))

  const uniqueChallengeIds = [
    ...new Set(activeEventChalls.map(c => c.challengeId)),
  ]
  if (uniqueChallengeIds.length === 0) return

  const challRows = await db
    .select()
    .from(challenges)
    .where(inArray(challenges.id, uniqueChallengeIds))

  for (const row of challRows) {
    const snap = snapshotChallenge({
      ...row,
      score: row.data.points.max,
      solveCount: 0,
    })

    await db
      .update(clubEventChallenges)
      .set({
        publicData: snap.publicData,
        staticFlags: snap.staticFlags,
      })
      .where(
        and(
          eq(clubEventChallenges.challengeId, row.id),
          inArray(clubEventChallenges.eventId, activeEventIds)
        )
      )
  }
}

