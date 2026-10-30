ALTER TABLE "club_events" ADD COLUMN IF NOT EXISTS "club_only" boolean DEFAULT false NOT NULL;
