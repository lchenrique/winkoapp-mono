import { relations } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  pgEnum,
  integer,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// Enums
export const conversationTypeEnum = pgEnum('conversation_type', ['private', 'group']);
export const messageTypeEnum = pgEnum('message_type', ['text', 'image', 'video', 'audio', 'document']);
export const messageStatusEnum = pgEnum('message_status_enum', ['sent', 'delivered', 'read']);
export const friendRequestStatusEnum = pgEnum('friend_request_status', ['pending', 'accepted', 'rejected']);

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 30 }).unique().notNull(),
  email: varchar('email', { length: 255 }).unique(),
  phone: varchar('phone', { length: 20 }).unique(),
  password: varchar('password', { length: 255 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  avatar: text('avatar'),
  status: text('status').default('Available'),
  lastSeen: timestamp('last_seen').defaultNow(),
  isOnline: boolean('is_online').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  usernameIdx: uniqueIndex('users_username_idx').on(table.username),
  emailIdx: uniqueIndex('users_email_idx').on(table.email),
  phoneIdx: uniqueIndex('users_phone_idx').on(table.phone),
}));

// Friend Requests table
export const friendRequests = pgTable('friend_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  senderId: uuid('sender_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  receiverId: uuid('receiver_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  status: friendRequestStatusEnum('status').default('pending').notNull(),
  message: varchar('message', { length: 255 }), // Optional message with request
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  senderReceiverIdx: uniqueIndex('friend_requests_sender_receiver_idx').on(table.senderId, table.receiverId),
  senderIdx: index('friend_requests_sender_idx').on(table.senderId),
  receiverIdx: index('friend_requests_receiver_idx').on(table.receiverId),
  statusIdx: index('friend_requests_status_idx').on(table.status),
}));

// Contacts table (now only created after friend request is accepted)
export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  contactId: uuid('contact_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  nickname: varchar('nickname', { length: 100 }),
  friendRequestId: uuid('friend_request_id').references(() => friendRequests.id, { onDelete: 'cascade' }), // Reference to original request
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userContactIdx: uniqueIndex('contacts_user_contact_idx').on(table.userId, table.contactId),
}));

// Conversations table
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: conversationTypeEnum('type').notNull(),
  name: varchar('name', { length: 100 }), // For group conversations
  description: text('description'), // For group conversations
  avatar: text('avatar'), // For group conversations
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Conversation members table
export const conversationMembers = pgTable('conversation_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  isAdmin: boolean('is_admin').default(false),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  leftAt: timestamp('left_at'),
}, (table) => ({
  conversationUserIdx: uniqueIndex('conversation_members_conversation_user_idx').on(table.conversationId, table.userId),
  conversationIdx: index('conversation_members_conversation_idx').on(table.conversationId),
}));

// Messages table
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  senderId: uuid('sender_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: messageTypeEnum('type').notNull(),
  content: text('content'),
  fileUrl: text('file_url'),
  fileName: varchar('file_name', { length: 255 }),
  fileSize: integer('file_size'),
  fileMimeType: varchar('file_mime_type', { length: 100 }),
  replyToId: uuid('reply_to_id').references(() => messages.id),
  isEdited: boolean('is_edited').default(false),
  isDeleted: boolean('is_deleted').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  conversationIdx: index('messages_conversation_idx').on(table.conversationId),
  senderIdx: index('messages_sender_idx').on(table.senderId),
  createdAtIdx: index('messages_created_at_idx').on(table.createdAt),
}));

// Message status table (to track delivery and read status per user)
export const messageStatus = pgTable('msg_status', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').references(() => messages.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  status: messageStatusEnum('status').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => ({
  messageUserIdx: uniqueIndex('message_status_message_user_idx').on(table.messageId, table.userId),
  messageIdx: index('message_status_message_idx').on(table.messageId),
}));

// Message reactions table
export const messageReactions = pgTable('message_reactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').references(() => messages.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  emoji: varchar('emoji', { length: 10 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  messageUserEmojiIdx: uniqueIndex('message_reactions_message_user_emoji_idx').on(table.messageId, table.userId, table.emoji),
  messageIdx: index('message_reactions_message_idx').on(table.messageId),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  contacts: many(contacts, { relationName: 'userContacts' }),
  contactOf: many(contacts, { relationName: 'contactOf' }),
  sentFriendRequests: many(friendRequests, { relationName: 'sentRequests' }),
  receivedFriendRequests: many(friendRequests, { relationName: 'receivedRequests' }),
  conversationMembers: many(conversationMembers),
  messages: many(messages),
  messageStatus: many(messageStatus),
  messageReactions: many(messageReactions),
}));

export const friendRequestsRelations = relations(friendRequests, ({ one, many }) => ({
  sender: one(users, {
    fields: [friendRequests.senderId],
    references: [users.id],
    relationName: 'sentRequests',
  }),
  receiver: one(users, {
    fields: [friendRequests.receiverId],
    references: [users.id],
    relationName: 'receivedRequests',
  }),
  contacts: many(contacts),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  user: one(users, {
    fields: [contacts.userId],
    references: [users.id],
    relationName: 'userContacts',
  }),
  contact: one(users, {
    fields: [contacts.contactId],
    references: [users.id],
    relationName: 'contactOf',
  }),
  friendRequest: one(friendRequests, {
    fields: [contacts.friendRequestId],
    references: [friendRequests.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  creator: one(users, {
    fields: [conversations.createdBy],
    references: [users.id],
  }),
  members: many(conversationMembers),
  messages: many(messages),
}));

export const conversationMembersRelations = relations(conversationMembers, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationMembers.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [conversationMembers.userId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  replyTo: one(messages, {
    fields: [messages.replyToId],
    references: [messages.id],
  }),
  status: many(messageStatus),
  reactions: many(messageReactions),
}));

export const messageStatusRelations = relations(messageStatus, ({ one }) => ({
  message: one(messages, {
    fields: [messageStatus.messageId],
    references: [messages.id],
  }),
  user: one(users, {
    fields: [messageStatus.userId],
    references: [users.id],
  }),
}));

export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
  message: one(messages, {
    fields: [messageReactions.messageId],
    references: [messages.id],
  }),
  user: one(users, {
    fields: [messageReactions.userId],
    references: [users.id],
  }),
}));
