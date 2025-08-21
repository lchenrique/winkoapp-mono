import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/whatsapp_chat';

const client = postgres(connectionString);

async function runMigration() {
  try {
    console.log('🚀 Starting username migration step by step...');
    
    // Step 1: Add column as nullable
    console.log('Step 1: Adding username column as nullable...');
    await client`ALTER TABLE "users" ADD COLUMN "username" varchar(30)`;
    
    // Step 2: Update existing users with generated usernames
    console.log('Step 2: Generating usernames for existing users...');
    await client`
      UPDATE "users" SET "username" = 
        CASE 
          WHEN "email" IS NOT NULL THEN 
            LOWER(REPLACE(REPLACE(SPLIT_PART("email", '@', 1), '.', ''), '+', '')) || '_' || SUBSTRING("id"::text, 1, 4)
          ELSE 
            LOWER(REPLACE(REPLACE("name", ' ', ''), '.', '')) || '_' || SUBSTRING("id"::text, 1, 4)
        END
      WHERE "username" IS NULL
    `;
    
    // Step 3: Make column NOT NULL
    console.log('Step 3: Making username column NOT NULL...');
    await client`ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL`;
    
    // Step 4: Add unique constraint
    console.log('Step 4: Adding unique constraint...');
    await client`ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username")`;
    
    // Step 5: Create unique index
    console.log('Step 5: Creating unique index...');
    await client`CREATE UNIQUE INDEX IF NOT EXISTS "users_username_idx" ON "users" ("username")`;
    
    console.log('✅ Username migration completed successfully!');
    
    // Show some users with their new usernames
    console.log('\n📋 Sample users with usernames:');
    const users = await client`SELECT id, name, email, username FROM "users" LIMIT 5`;
    console.table(users);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await client.end();
  }
}

runMigration();
