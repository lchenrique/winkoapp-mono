DO $$ BEGIN
 CREATE TYPE "user_status" AS ENUM('online', 'busy', 'away', 'offline');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "user_status" "user_status" DEFAULT 'online';