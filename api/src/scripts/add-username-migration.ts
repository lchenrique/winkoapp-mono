import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/whatsapp_chat';

const client = postgres(connectionString);
const db = drizzle(client);

async function runMigration() {
  try {
    console.log('🚀 Starting username migration...');
    
    // Read the custom migration file
    const migrationPath = path.join(__dirname, '../../drizzle/0001_gorgeous_ma_gnuci_fixed.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split by statement breakpoint and execute each statement
    const statements = migrationSQL
      .split('-->statement-breakpoint')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      await client.unsafe(statement);
    }
    
    console.log('✅ Username migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await client.end();
  }
}

runMigration();
