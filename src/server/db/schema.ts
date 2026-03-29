import { sqliteTable, text, integer, primaryKey, unique } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text('username').notNull().unique(),
  bio: text('bio').default(''),
  avatar: text('avatar').default(''),
  food: integer('food').notNull().default(10),
  fire: integer('fire').notNull().default(0),
  lastActiveAt: integer('last_active_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const tribes = sqliteTable('tribes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  abbreviation: text('abbreviation').notNull().default(''),
  description: text('description').default(''),
  avatar: text('avatar').default(''),
  creatorId: text('creator_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const userTribes = sqliteTable('user_tribes', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tribeId: text('tribe_id').notNull().references(() => tribes.id, { onDelete: 'cascade' }),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.tribeId] }),
}));

export const threads = sqliteTable('threads', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  creatorId: text('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tribeId: text('tribe_id').references(() => tribes.id, { onDelete: 'cascade' }),
  title: text('title'),
  content: text('content'),
  type: text('type', { enum: ['text', 'image', 'mixed'] }).notNull(),
  imageUrl: text('image_url'),
  fireGenerated: integer('fire_generated').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const replies = sqliteTable('replies', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  threadId: text('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  creatorId: text('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  contentHash: text('content_hash').notNull().default(''),
  replyIndex: integer('reply_index').notNull(),
  isUnique: integer('is_unique', { mode: 'boolean' }).notNull(),
  fireGenerated: integer('fire_generated').notNull().default(0),
  likes: integer('likes').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const likes = sqliteTable('likes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  replyId: text('reply_id').notNull().references(() => replies.id, { onDelete: 'cascade' }),
  fireGenerated: integer('fire_generated').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  unq: unique().on(t.userId, t.replyId),
}));

export const userThreadStats = sqliteTable('user_thread_stats', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  threadId: text('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  fireGenerated: integer('fire_generated').notNull().default(0),
  lastReplyIndex: integer('last_reply_index').notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.threadId] }),
}));

export const userActivity = sqliteTable('user_activity', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  lastActive: integer('last_active', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  decayApplied: integer('decay_applied', { mode: 'boolean' }).notNull().default(false),
});

export const rewardEvents = sqliteTable('reward_events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text('type').notNull(),
  refId: text('ref_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  unq: unique().on(t.type, t.refId),
}));
