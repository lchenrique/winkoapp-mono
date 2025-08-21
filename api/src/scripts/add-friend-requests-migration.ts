import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/whatsapp_chat';

const client = postgres(connectionString);

async function runMigration() {
  try {
    console.log('🚀 Starting friend requests migration...');
    
    // Step 1: Create enum type
    console.log('Step 1: Creating friend_request_status enum...');
    await client`
      DO $$ BEGIN
       CREATE TYPE "friend_request_status" AS ENUM('pending', 'accepted', 'rejected');
      EXCEPTION
       WHEN duplicate_object THEN null;
      END $$;
    `;
    
    // Step 2: Create friend_requests table
    console.log('Step 2: Creating friend_requests table...');
    await client`
      CREATE TABLE IF NOT EXISTS "friend_requests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "sender_id" uuid NOT NULL,
        "receiver_id" uuid NOT NULL,
        "status" "friend_request_status" DEFAULT 'pending' NOT NULL,
        "message" varchar(255),
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `;
    
    // Step 3: Add friend_request_id column to contacts
    console.log('Step 3: Adding friend_request_id column to contacts...');
    try {
      await client`ALTER TABLE "contacts" ADD COLUMN "friend_request_id" uuid`;
    } catch (error) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
      console.log('Column already exists, skipping...');
    }
    
    // Step 4: Create indexes
    console.log('Step 4: Creating indexes...');
    await client`CREATE UNIQUE INDEX IF NOT EXISTS "friend_requests_sender_receiver_idx" ON "friend_requests" ("sender_id","receiver_id")`;
    await client`CREATE INDEX IF NOT EXISTS "friend_requests_sender_idx" ON "friend_requests" ("sender_id")`;
    await client`CREATE INDEX IF NOT EXISTS "friend_requests_receiver_idx" ON "friend_requests" ("receiver_id")`;
    await client`CREATE INDEX IF NOT EXISTS "friend_requests_status_idx" ON "friend_requests" ("status")`;
    
    // Step 5: Create foreign key constraints
    console.log('Step 5: Adding foreign key constraints...');
    await client`
      DO $$ BEGIN
       ALTER TABLE "contacts" ADD CONSTRAINT "contacts_friend_request_id_friend_requests_id_fk" FOREIGN KEY ("friend_request_id") REFERENCES "friend_requests"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION
       WHEN duplicate_object THEN null;
      END $$;
    `;
    
    await client`
      DO $$ BEGIN
       ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION
       WHEN duplicate_object THEN null;
      END $$;
    `;
    
    await client`
      DO $$ BEGIN
       ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION
       WHEN duplicate_object THEN null;
      END $$;
    `;
    
    console.log('✅ Friend requests migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await client.end();
  }
}

runMigration();
