import { sqliteTable, text, integer, primaryKey, unique, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text('username').notNull().unique(),
  bio: text('bio').default(''),
  avatar: text('avatar').default(''),
  isPlayerCharacter: integer('is_player_character', { mode: 'boolean' }).notNull().default(false),
  food: integer('food').notNull().default(10),
  fire: integer('fire').notNull().default(0),
  huntCooldownUntil: integer('hunt_cooldown_until', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date(0)),
  lastActiveAt: integer('last_active_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  usernameIdx: index('users_username_idx').on(t.username),
  activeIdx: index('users_last_active_at_idx').on(t.lastActiveAt),
}));

export const tribes = sqliteTable('tribes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  abbreviation: text('abbreviation').notNull().default(''),
  description: text('description').default(''),
  avatar: text('avatar').default(''),
  creatorId: text('creator_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  nameIdx: index('tribes_name_idx').on(t.name),
  creatorIdx: index('tribes_creator_id_idx').on(t.creatorId),
}));

export const userTribes = sqliteTable('user_tribes', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tribeId: text('tribe_id').notNull().references(() => tribes.id, { onDelete: 'cascade' }),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.tribeId] }),
  userIdx: index('user_tribes_user_id_idx').on(t.userId),
  tribeIdx: index('user_tribes_tribe_id_idx').on(t.tribeId),
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
}, (t) => ({
  creatorIdx: index('threads_creator_id_idx').on(t.creatorId),
  tribeIdx: index('threads_tribe_id_idx').on(t.tribeId),
  createdIdx: index('threads_created_at_idx').on(t.createdAt),
}));

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
}, (t) => ({
  threadIdx: index('replies_thread_id_idx').on(t.threadId),
  creatorIdx: index('replies_creator_id_idx').on(t.creatorId),
  createdIdx: index('replies_created_at_idx').on(t.createdAt),
}));

export const likes = sqliteTable('likes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  replyId: text('reply_id').notNull().references(() => replies.id, { onDelete: 'cascade' }),
  fireGenerated: integer('fire_generated').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  unq: unique().on(t.userId, t.replyId),
  userIdx: index('likes_user_id_idx').on(t.userId),
  replyIdx: index('likes_reply_id_idx').on(t.replyId),
}));

export const userThreadStats = sqliteTable('user_thread_stats', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  threadId: text('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  fireGenerated: integer('fire_generated').notNull().default(0),
  lastReplyIndex: integer('last_reply_index').notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.threadId] }),
  threadIdx: index('user_thread_stats_thread_id_idx').on(t.threadId),
}));

export const userActivity = sqliteTable('user_activity', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  lastActive: integer('last_active', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  decayApplied: integer('decay_applied', { mode: 'boolean' }).notNull().default(false),
}, (t) => ({
  lastActiveIdx: index('user_activity_last_active_idx').on(t.lastActive),
}));

export const rewardEvents = sqliteTable('reward_events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text('type').notNull(),
  refId: text('ref_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  unq: unique().on(t.type, t.refId),
  typeIdx: index('reward_events_type_idx').on(t.type),
  refIdx: index('reward_events_ref_id_idx').on(t.refId),
}));
