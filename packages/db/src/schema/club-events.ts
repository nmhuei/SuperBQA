import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'
import { clubArchives, type ArchivedChallenge } from './club'
import { users } from './users'

export const clubEvents = pgTable(
  'club_events',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    description: text().notNull(),
    startTime: bigint('start_time', { mode: 'number' }).notNull(),
    endTime: bigint('end_time', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    published: boolean().notNull().default(false),
    challengeCount: integer('challenge_count').notNull(),
    clubOnly: boolean('club_only').notNull().default(false),
    archiveId: text('archive_id').references(() => clubArchives.id),
  },
  table => [
    check(
      'club_events_valid_schedule',
      sql`${table.endTime} > ${table.startTime}`
    ),
  ]
)

export const clubEventChallenges = pgTable(
  'club_event_challenges',
  {
    eventId: text('event_id')
      .notNull()
      .references(() => clubEvents.id, { onDelete: 'cascade' }),
    challengeId: text('challenge_id').notNull(),
    publicData: jsonb('public_data').$type<ArchivedChallenge>().notNull(),
    staticFlags: jsonb('static_flags').$type<string[]>().notNull(),
  },
  table => [primaryKey({ columns: [table.eventId, table.challengeId] })]
)

export const clubEventSolves = pgTable(
  'club_event_solves',
  {
    eventId: text('event_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    challengeId: text('challenge_id').notNull(),
    id: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  table => [
    primaryKey({ columns: [table.eventId, table.userId, table.challengeId] }),
    unique('club_event_solves_id_unique').on(table.id),
    foreignKey({
      columns: [table.eventId, table.challengeId],
      foreignColumns: [
        clubEventChallenges.eventId,
        clubEventChallenges.challengeId,
      ],
    }).onDelete('cascade'),
  ]
)
