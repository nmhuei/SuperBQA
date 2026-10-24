CREATE TABLE "club_archive_challenges" (
	"archive_id" text NOT NULL,
	"challenge_id" text NOT NULL,
	"public_data" jsonb NOT NULL,
	"static_flags" jsonb NOT NULL,
	CONSTRAINT "club_archive_challenges_archive_id_challenge_id_pk" PRIMARY KEY("archive_id","challenge_id")
);
--> statement-breakpoint
CREATE TABLE "club_archives" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"start_time" bigint NOT NULL,
	"end_time" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"challenge_count" integer NOT NULL,
	"participant_count" integer NOT NULL,
	"leaderboard" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_memberships" (
	"user_id" text PRIMARY KEY NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_practice_solves" (
	"archive_id" text NOT NULL,
	"challenge_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_practice_solves_archive_id_user_id_challenge_id_pk" PRIMARY KEY("archive_id","user_id","challenge_id")
);
--> statement-breakpoint
ALTER TABLE "club_archive_challenges" ADD CONSTRAINT "club_archive_challenges_archive_id_club_archives_id_fk" FOREIGN KEY ("archive_id") REFERENCES "public"."club_archives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_memberships" ADD CONSTRAINT "club_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "club_practice_solves" ADD CONSTRAINT "club_practice_solves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "club_practice_solves" ADD CONSTRAINT "club_practice_solves_archive_id_challenge_id_club_archive_challenges_archive_id_challenge_id_fk" FOREIGN KEY ("archive_id","challenge_id") REFERENCES "public"."club_archive_challenges"("archive_id","challenge_id") ON DELETE cascade ON UPDATE no action;