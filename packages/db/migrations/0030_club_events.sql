CREATE TABLE "club_event_challenges" (
	"event_id" text NOT NULL,
	"challenge_id" text NOT NULL,
	"public_data" jsonb NOT NULL,
	"static_flags" jsonb NOT NULL,
	CONSTRAINT "club_event_challenges_event_id_challenge_id_pk" PRIMARY KEY("event_id","challenge_id")
);
--> statement-breakpoint
CREATE TABLE "club_event_solves" (
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"challenge_id" text NOT NULL,
	"id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_event_solves_event_id_user_id_challenge_id_pk" PRIMARY KEY("event_id","user_id","challenge_id"),
	CONSTRAINT "club_event_solves_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "club_events" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"start_time" bigint NOT NULL,
	"end_time" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"challenge_count" integer NOT NULL,
	"archive_id" text,
	CONSTRAINT "club_events_valid_schedule" CHECK ("club_events"."end_time" > "club_events"."start_time")
);
--> statement-breakpoint
ALTER TABLE "club_event_challenges" ADD CONSTRAINT "club_event_challenges_event_id_club_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."club_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_event_solves" ADD CONSTRAINT "club_event_solves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "club_event_solves" ADD CONSTRAINT "club_event_solves_event_id_challenge_id_club_event_challenges_event_id_challenge_id_fk" FOREIGN KEY ("event_id","challenge_id") REFERENCES "public"."club_event_challenges"("event_id","challenge_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_events" ADD CONSTRAINT "club_events_archive_id_club_archives_id_fk" FOREIGN KEY ("archive_id") REFERENCES "public"."club_archives"("id") ON DELETE no action ON UPDATE no action;