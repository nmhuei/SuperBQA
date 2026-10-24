import type { z } from 'zod/mini'
import type {
  ClubArchiveChallengeSchema,
  ClubArchiveLeaderboardSchema,
} from '@rctf/types'
import {
  bigint,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { users } from './users'

export type ArchivedChallenge = z.infer<typeof ClubArchiveChallengeSchema>
export type ArchivedLeaderboard = z.infer<typeof ClubArchiveLeaderboardSchema>

// Missing row means Guest. Native rCTF permission bits remain independent.
export const clubMemberships = pgTable('club_memberships', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  grantedAt: timestamp('granted_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
})

export const clubArchives = pgTable('club_archives', {
  id: text().primaryKey(),
  name: text().notNull(),
  description: text().notNull(),
  startTime: bigint('start_time', { mode: 'number' }).notNull(),
  endTime: bigint('end_time', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
  challengeCount: integer('challenge_count').notNull(),
  participantCount: integer('participant_count').notNull(),
  leaderboard: jsonb().$type<ArchivedLeaderboard>().notNull(),
})

// Standalone copies survive changes/deletion of current-event challenges.
export const clubArchiveChallenges = pgTable(
  'club_archive_challenges',
  {
    archiveId: text('archive_id')
      .notNull()
      .references(() => clubArchives.id, { onDelete: 'cascade' }),
    challengeId: text('challenge_id').notNull(),
    publicData: jsonb('public_data').$type<ArchivedChallenge>().notNull(),
    staticFlags: jsonb('static_flags').$type<string[]>().notNull(),
  },
  table => [primaryKey({ columns: [table.archiveId, table.challengeId] })]
)

export const clubPracticeSolves = pgTable(
  'club_practice_solves',
  {
    archiveId: text('archive_id').notNull(),
    challengeId: text('challenge_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  table => [
    primaryKey({ columns: [table.archiveId, table.userId, table.challengeId] }),
    foreignKey({
      columns: [table.archiveId, table.challengeId],
      foreignColumns: [
        clubArchiveChallenges.archiveId,
        clubArchiveChallenges.challengeId,
      ],
    }).onDelete('cascade'),
  ]
)
