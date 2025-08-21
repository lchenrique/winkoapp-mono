import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { onlineUsersDebug } from './online-users';
import { contactsPresenceDebug } from './contacts-presence';
import { contactsStatus } from './contacts-status'; // NEW: Single source of truth
import { statusCleanup } from './status-cleanup'; // NEW: StatusService cleanup
import { statusDebug } from './status-debug'; // NEW: Real-time status debugging
import { presenceDebug } from './presence-debug';
import { presenceFix } from './presence-fix';
import { forcePresenceUpdate } from './force-presence-update';
import { cleanupPresence } from './cleanup-presence';
import { emergencyCleanup } from './emergency-cleanup';
import { findUserByEmailDebug } from './find-user-by-email';
import { listAllUsersDebug } from './list-all-users';
import { syncDatabaseStatus } from './sync-database-status';
import { userStatusDetail } from './user-status-detail';

export const debugRoutes: FastifyPluginAsyncZod = async (app) => {
  // NEW StatusService routes (single source of truth)
  await app.register(contactsStatus);        // POST /debug/contacts-status (NEW)
  await app.register(statusCleanup);         // POST /debug/status-cleanup (NEW)
  await app.register(statusDebug);           // GET /debug/status-debug (NEW)
  
  // Legacy routes (may be deprecated)
  await app.register(onlineUsersDebug);      // GET /debug/online-users
  await app.register(contactsPresenceDebug); // POST /debug/contacts-presence
  await app.register(presenceDebug);         // POST /debug/presence-debug
  await app.register(presenceFix);           // POST /debug/presence-fix
  await app.register(forcePresenceUpdate);   // POST /debug/force-presence-update
  await app.register(cleanupPresence);       // POST /debug/cleanup-presence
  await app.register(emergencyCleanup);      // POST /debug/emergency-cleanup
  await app.register(findUserByEmailDebug);  // GET /debug/find-user-by-email/:email
  await app.register(listAllUsersDebug);     // GET /debug/list-all-users
  await app.register(syncDatabaseStatus);    // POST /debug/sync-database-status
  await app.register(userStatusDetail);      // GET /debug/user-status-detail/:userId
};
