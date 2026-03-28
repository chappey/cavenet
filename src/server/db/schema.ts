import { sqliteTable, text, integer, primaryKey, unique } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text('username').notNull().unique(),
  food: integer('food').notNull().default(10),
  fire: integer('fire').notNull().default(0),
  lastActiveAt: integer('last_active_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['text', 'image', 'mixed', 'recovery'] }).notNull(),
  content: text('content'),
  imageUrl: text('image_url'),
  fireGenerated: integer('fire_generated').notNull().default(0),
  isRecovery: integer('is_recovery', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const replies = sqliteTable('replies', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  postId: text('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  contentHash: text('content_hash').notNull().default(''),
  replyIndex: integer('reply_index').notNull(),
  isUnique: integer('is_unique', { mode: 'boolean' }).notNull(),
  fireAwarded: integer('fire_awarded').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const likes = sqliteTable('likes', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  postId: text('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.postId] }),
}));

export const threadFire = sqliteTable('thread_fire', {
  userId: text('user_id').notNull(),
  postId: text('post_id').notNull(),
  fireAccumulated: integer('fire_accumulated').notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.postId] }),
}));

export const rewardEvents = sqliteTable('reward_events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text('type').notNull(),
  refId: text('ref_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => ({
  unq: unique().on(t.type, t.refId),
}));
