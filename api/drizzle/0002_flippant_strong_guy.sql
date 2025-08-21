DO $$ BEGIN
 CREATE TYPE "friend_request_status" AS ENUM('pending', 'accepted', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "friend_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid NOT NULL,
	"receiver_id" uuid NOT NULL,
	"status" "friend_request_status" DEFAULT 'pending' NOT NULL,
	"message" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "friend_request_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "friend_requests_sender_receiver_idx" ON "friend_requests" ("sender_id","receiver_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "friend_requests_sender_idx" ON "friend_requests" ("sender_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "friend_requests_receiver_idx" ON "friend_requests" ("receiver_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "friend_requests_status_idx" ON "friend_requests" ("status");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contacts" ADD CONSTRAINT "contacts_friend_request_id_friend_requests_id_fk" FOREIGN KEY ("friend_request_id") REFERENCES "friend_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
