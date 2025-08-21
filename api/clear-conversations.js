const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { eq } = require('drizzle-orm');

// Import schema
const { conversations, messages, conversationMembers, messageStatus } = require('./dist/lib/db');

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/winkoapp';
const sql = postgres(connectionString);
const db = drizzle(sql);

async function clearConversations() {
  try {
    console.log('🧹 Starting database cleanup...');
    
    // Delete in correct order to maintain foreign key constraints
    console.log('🗑️  Deleting message statuses...');
    const deletedStatuses = await db.delete(messageStatus);
    console.log(`✅ Deleted ${deletedStatuses.rowCount || 0} message statuses`);
    
    console.log('🗑️  Deleting messages...');
    const deletedMessages = await db.delete(messages);
    console.log(`✅ Deleted ${deletedMessages.rowCount || 0} messages`);
    
    console.log('🗑️  Deleting conversation members...');
    const deletedMembers = await db.delete(conversationMembers);
    console.log(`✅ Deleted ${deletedMembers.rowCount || 0} conversation members`);
    
    console.log('🗑️  Deleting conversations...');
    const deletedConversations = await db.delete(conversations);
    console.log(`✅ Deleted ${deletedConversations.rowCount || 0} conversations`);
    
    console.log('✅ Database cleanup completed successfully!');
  } catch (error) {
    console.error('❌ Error cleaning database:', error);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

clearConversations();
