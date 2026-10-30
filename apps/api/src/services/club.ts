import {
  challenges,
  clubArchiveChallenges,
  clubArchives,
  clubMemberships,
  clubPracticeSolves,
  settings,
  solves,
  users,
  type ArchivedChallenge,
  type DatabaseClient,
  type DatabaseTx,
  type User,
} from '@rctf/db'
import { ChallengeScoringKind, Permissions } from '@rctf/types'
import { and, asc, count, desc, eq, gte, ilike, lt, or, sql } from 'drizzle-orm'
import { timingSafeEqual } from '../util/timing-safe-equal'
import { calculateArchivedLeaderboard } from './leaderboard-calculation'
import { resolveSettings } from './settings'

export const getClubAccess = async (
  db: DatabaseClient | DatabaseTx,
  user?: Pick<User, 'id'>
) => {
  const [current] = user
    ? await db
        .select({
          perms: users.perms,
          banned: users.banned,
          memberId: clubMemberships.userId,
        })
        .from(users)
        .leftJoin(clubMemberships, eq(clubMemberships.userId, users.id))
        .where(eq(users.id, user.id))
    : []
  const role =
    current && !current.banned && current.memberId
      ? ('member' as const)
      : ('guest' as const)
  const canManageMembers = Boolean(
    current && !current.banned && current.perms & Permissions.usersWrite
  )
  const canManageArchives = Boolean(
    current && !current.banned && current.perms & Permissions.settingsWrite
  )
  return {
    role,
    canManageMembers,
    canManageArchives,
    canAccessArchives: Boolean(
      current &&
      !current.banned &&
      (role === 'member' || canManageMembers || canManageArchives)
    ),
  }
}

export const getClubMembers = async (
  db: DatabaseClient,
  query: { search?: string; limit: number; offset: number }
) => {
  const escapedSearch = query.search?.replace(/[\\%_]/g, '\\$&')
  const filter = escapedSearch
    ? or(
        ilike(users.name, `%${escapedSearch}%`),
        ilike(users.email, `%${escapedSearch}%`)
      )
    : undefined
  const [rows, totals] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        memberId: clubMemberships.userId,
      })
      .from(users)
      .leftJoin(clubMemberships, eq(clubMemberships.userId, users.id))
      .where(filter)
      .orderBy(asc(users.name), asc(users.id))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ count: count() }).from(users).where(filter),
  ])
  return {
    total: totals[0]?.count ?? 0,
    users: rows.map(({ memberId, ...row }) => ({
      ...row,
      role: memberId ? ('member' as const) : ('guest' as const),
    })),
  }
}

export const updateClubMember = async (
  db: DatabaseClient,
  id: string,
  role: 'guest' | 'member'
) =>
  db.transaction(async tx => {
    const [target] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .for('update')
    if (!target) return false
    if (role === 'member')
      await tx
        .insert(clubMemberships)
        .values({ userId: id })
        .onConflictDoNothing()
    else await tx.delete(clubMemberships).where(eq(clubMemberships.userId, id))
    return true
  })

const archiveSummarySelection = {
  id: clubArchives.id,
  name: clubArchives.name,
  description: clubArchives.description,
  startTime: clubArchives.startTime,
  endTime: clubArchives.endTime,
  createdAt: clubArchives.createdAt,
  challengeCount: clubArchives.challengeCount,
  participantCount: clubArchives.participantCount,
}

export const getClubArchives = (db: DatabaseClient, userId: string) =>
  db
    .select({
      ...archiveSummarySelection,
      practiceChallengeCount: count(clubArchiveChallenges.challengeId),
      solvedCount: count(clubPracticeSolves.challengeId),
    })
    .from(clubArchives)
    // Aggregate public availability without loading snapshots or private flags.
    // Filtering in the join preserves empty and reference-only archives.
    .leftJoin(
      clubArchiveChallenges,
      and(
        eq(clubArchiveChallenges.archiveId, clubArchives.id),
        sql`${clubArchiveChallenges.publicData}->'practiceAvailable' = 'true'::jsonb`
      )
    )
    .leftJoin(
      clubPracticeSolves,
      and(
        eq(clubPracticeSolves.archiveId, clubArchiveChallenges.archiveId),
        eq(clubPracticeSolves.challengeId, clubArchiveChallenges.challengeId),
        eq(clubPracticeSolves.userId, userId)
      )
    )
    .groupBy(clubArchives.id)
    .orderBy(desc(clubArchives.endTime), desc(clubArchives.createdAt))

export const snapshotChallenge = (
  challenge: typeof challenges.$inferSelect
) => {
  const data = challenge.data
  const staticFlags = (data.flags ?? []).flatMap(entry =>
    (entry.provider ?? 'flags/static') === 'flags/static' &&
    typeof entry.config.flag === 'string' &&
    entry.config.flag.length > 0
      ? [entry.config.flag]
      : []
  )
  let reason: string | null = null
  if (data.instancerConfig || data.adminBotConfig)
    reason =
      'This challenge requires a live instance or admin bot that is not available in archived practice.'
  else if (data.scoring?.kind === ChallengeScoringKind.DYNAMIC)
    reason =
      'This challenge uses a live scoring feed and is not available in archived practice.'
  else if (staticFlags.length === 0 || staticFlags.length !== data.flags.length)
    reason =
      'This challenge uses unsupported or per-team flags. Archived practice currently supports static flags.'
  const redactFlags = (text: string) =>
    staticFlags.reduce(
      (result, flag) => result.replaceAll(flag, '[redacted]'),
      text
    )
  const publicData: ArchivedChallenge = {
    id: challenge.id,
    name: redactFlags(data.name),
    description: redactFlags(data.description),
    category: data.category,
    author: data.author,
    files: data.files.map(file => ({
      name: file.name,
      url: file.url,
      size: file.size ?? null,
    })),
    points: challenge.score,
    solves: challenge.solveCount,
    tags: data.tags ?? [],
    practiceAvailable: reason === null,
    practiceUnavailableReason: reason,
  }
  return {
    challengeId: challenge.id,
    publicData,
    staticFlags: reason === null ? staticFlags : [],
  }
}

export const createClubArchive = async (
  db: DatabaseClient,
  input: { name?: string; description?: string }
) =>
  db.transaction(
    async tx => {
      // Read timing in the same repeatable-read snapshot as the event data.
      const [setting] = await tx
        .select()
        .from(settings)
        .where(eq(settings.id, 'value-0'))
      const timing = resolveSettings(setting?.data ?? {})
      if (Date.now() < timing.endTime) return null
      const currentChallenges = await tx
        .select()
        .from(challenges)
        .orderBy(asc(challenges.id))
      const publicChallenges = currentChallenges.filter(
        challenge =>
          !challenge.data.hidden &&
          (challenge.data.releaseTime == null ||
            challenge.data.releaseTime < timing.endTime)
      )
      const dbUsers = await tx
        .select({
          id: users.id,
          name: users.name,
          division: users.division,
          banned: users.banned,
        })
        .from(users)
        .orderBy(asc(users.createdAt), asc(users.id))
      const eventSolves = await tx
        .select()
        .from(solves)
        .where(
          and(
            gte(solves.createdat, new Date(timing.startTime).toISOString()),
            lt(solves.createdat, new Date(timing.endTime).toISOString())
          )
        )
        .orderBy(asc(solves.createdat), asc(solves.id))
      const calculated = calculateArchivedLeaderboard(
        { dbUsers, dbChallenges: publicChallenges, solves: eventSolves },
        timing
      )
      const leaderboard = calculated.users.map((entry, index) => ({
        id: entry.id,
        name: entry.name,
        division: entry.division ?? '',
        score: entry.score,
        rank: index + 1,
      }))
      const snapshots = publicChallenges.map(challenge => {
        const calculatedChallenge = calculated.challengeInfos.get(challenge.id)!
        return snapshotChallenge({
          ...challenge,
          score: calculatedChallenge.score,
          solveCount: calculatedChallenge.solves,
        })
      })
      const id = crypto.randomUUID()
      const [archive] = await tx
        .insert(clubArchives)
        .values({
          id,
          name: input.name ?? timing.ctfName,
          description: input.description ?? '',
          startTime: timing.startTime,
          endTime: timing.endTime,
          challengeCount: snapshots.length,
          participantCount: leaderboard.length,
          leaderboard,
        })
        .returning(archiveSummarySelection)
      if (snapshots.length)
        await tx
          .insert(clubArchiveChallenges)
          .values(snapshots.map(snapshot => ({ archiveId: id, ...snapshot })))
      return archive!
    },
    { isolationLevel: 'repeatable read' }
  )

export const getClubArchive = async (
  db: DatabaseClient,
  archiveId: string,
  userId: string
) => {
  const [archive] = await db
    .select()
    .from(clubArchives)
    .where(eq(clubArchives.id, archiveId))
  if (!archive) return null
  const [snapshotChallenges, practiceSolves] = await Promise.all([
    // Select publicData explicitly; never serialize private flag storage.
    db
      .select({ publicData: clubArchiveChallenges.publicData })
      .from(clubArchiveChallenges)
      .where(eq(clubArchiveChallenges.archiveId, archiveId))
      .orderBy(asc(clubArchiveChallenges.challengeId)),
    db
      .select({ challengeId: clubPracticeSolves.challengeId })
      .from(clubPracticeSolves)
      .where(
        and(
          eq(clubPracticeSolves.archiveId, archiveId),
          eq(clubPracticeSolves.userId, userId)
        )
      ),
  ])
  return {
    ...archive,
    challenges: snapshotChallenges.map(row => row.publicData),
    solvedIds: practiceSolves.map(row => row.challengeId),
  }
}

export const submitClubPractice = async (
  db: DatabaseClient,
  archiveId: string,
  challengeId: string,
  userId: string,
  flag: string
) => {
  // Membership can change while the route awaits rate limiting.
  if (!(await getClubAccess(db, { id: userId })).canAccessArchives)
    return 'forbidden' as const
  const [challenge] = await db
    .select()
    .from(clubArchiveChallenges)
    .where(
      and(
        eq(clubArchiveChallenges.archiveId, archiveId),
        eq(clubArchiveChallenges.challengeId, challengeId)
      )
    )
  if (!challenge) return 'notFound' as const
  if (!challenge.publicData.practiceAvailable) return 'unavailable' as const
  const [existing] = await db
    .select({ userId: clubPracticeSolves.userId })
    .from(clubPracticeSolves)
    .where(
      and(
        eq(clubPracticeSolves.archiveId, archiveId),
        eq(clubPracticeSolves.challengeId, challengeId),
        eq(clubPracticeSolves.userId, userId)
      )
    )
  if (existing) return 'alreadySolved' as const
  let accepted = false
  for (const expected of challenge.staticFlags)
    accepted = timingSafeEqual(expected, flag) || accepted
  if (!accepted) return 'incorrect' as const
  if (!(await getClubAccess(db, { id: userId })).canAccessArchives)
    return 'forbidden' as const
  const inserted = await db
    .insert(clubPracticeSolves)
    .values({ archiveId, challengeId, userId })
    .onConflictDoNothing()
    .returning({ userId: clubPracticeSolves.userId })
  return inserted.length ? ('correct' as const) : ('alreadySolved' as const)
}
