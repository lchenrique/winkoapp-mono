-- First add the column as nullable
ALTER TABLE "users" ADD COLUMN "username" varchar(30);-->statement-breakpoint

-- Update existing users with generated usernames based on their name or email
UPDATE "users" SET "username" = 
  CASE 
    WHEN "email" IS NOT NULL THEN 
      LOWER(REPLACE(REPLACE(SPLIT_PART("email", '@', 1), '.', ''), '+', '')) || '_' || SUBSTRING("id"::text, 1, 4)
    ELSE 
      LOWER(REPLACE(REPLACE("name", ' ', ''), '.', '')) || '_' || SUBSTRING("id"::text, 1, 4)
  END
WHERE "username" IS NULL;-->statement-breakpoint

-- Make the column NOT NULL after updating existing records
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;-->statement-breakpoint

-- Create the unique index and constraint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_idx" ON "users" ("username");-->statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");
