import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './db';

async function main() {
  console.log('🚀 Starting database migration...');
  
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    process.exit(1);
  }
}

main();
