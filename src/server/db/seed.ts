import { existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Database } from 'bun:sqlite';

const dbPath = resolve(process.cwd(), 'src/server/sqlite.db');
const shouldReset = process.argv.includes('--reset');

if (shouldReset && existsSync(dbPath)) {
  rmSync(dbPath);
}

const sqlite = new Database(dbPath, { create: true });
sqlite.exec('PRAGMA foreign_keys = ON;');

const nowMs = Date.now();
const makeId = () => crypto.randomUUID();

const createSchema = () => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      username TEXT NOT NULL UNIQUE,
      bio TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      food INTEGER NOT NULL DEFAULT 10,
      fire INTEGER NOT NULL DEFAULT 0,
      last_active_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tribes (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY NOT NULL,
      creator_id TEXT NOT NULL,
      tribe_id TEXT,
      title TEXT,
      content TEXT,
      type TEXT NOT NULL CHECK(type IN ('text', 'image', 'mixed')),
      image_url TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (tribe_id) REFERENCES tribes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS replies (
      id TEXT PRIMARY KEY NOT NULL,
      thread_id TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL DEFAULT '',
      reply_index INTEGER NOT NULL,
      is_unique INTEGER NOT NULL,
      fire_generated INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS likes (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      reply_id TEXT NOT NULL,
      fire_generated INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE(user_id, reply_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reply_id) REFERENCES replies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_thread_stats (
      user_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      fire_generated INTEGER NOT NULL DEFAULT 0,
      last_reply_index INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, thread_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_activity (
      user_id TEXT PRIMARY KEY NOT NULL,
      last_active INTEGER NOT NULL,
      decay_applied INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reward_events (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      ref_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(type, ref_id)
    );
  `);
};

const clearData = () => {
  sqlite.exec(`
    DELETE FROM reward_events;
    DELETE FROM user_activity;
    DELETE FROM user_thread_stats;
    DELETE FROM likes;
    DELETE FROM replies;
    DELETE FROM threads;
    DELETE FROM tribes;
    DELETE FROM users;
  `);
};

const seedData = () => {
  const users = [
    { id: makeId(), username: 'Grog', bio: 'Fire master', food: 10, fire: 2 },
    { id: makeId(), username: 'Brakka', bio: 'Spear maker', food: 8, fire: 3 },
    { id: makeId(), username: 'Unga', bio: 'Hunter', food: 6, fire: 5 },
  ];

  const insertUser = sqlite.query(
    'INSERT INTO users (id, username, bio, avatar, food, fire, last_active_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  for (const user of users) {
    insertUser.run(user.id, user.username, user.bio, '', user.food, user.fire, nowMs, nowMs);
  }

  const insertActivity = sqlite.query(
    'INSERT INTO user_activity (user_id, last_active, decay_applied) VALUES (?, ?, ?)'
  );

  for (const user of users) {
    insertActivity.run(user.id, nowMs, 0);
  }

  const tribes = [
    { id: makeId(), name: 'Mountain Clan', description: 'Lives in the mountains' },
    { id: makeId(), name: 'River Tribe', description: 'Masters of the rivers' },
  ];

  const insertTribe = sqlite.query(
    'INSERT INTO tribes (id, name, description, avatar, created_at) VALUES (?, ?, ?, ?, ?)'
  );

  for (const tribe of tribes) {
    insertTribe.run(tribe.id, tribe.name, tribe.description, '', nowMs);
  }

  const threads = [
    {
      id: makeId(),
      creatorId: users[0].id,
      tribeId: tribes[0].id,
      type: 'text',
      title: 'Berry Bush Discovery',
      content: 'Me find big berry bush near river. Good food.',
    },
    {
      id: makeId(),
      creatorId: users[1].id,
      tribeId: null,
      type: 'mixed',
      title: 'New Spear',
      content: 'Made new spear. Pointy. Works very good.',
    },
    {
      id: makeId(),
      creatorId: users[2].id,
      tribeId: tribes[1].id,
      type: 'text',
      title: 'Warning',
      content: 'Mammoth tracks by stone hill. Be careful.',
    },
  ];

  const insertThread = sqlite.query(
    'INSERT INTO threads (id, creator_id, tribe_id, title, content, type, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  for (const thread of threads) {
    insertThread.run(thread.id, thread.creatorId, thread.tribeId, thread.title, thread.content, thread.type, null, nowMs);
  }

  const insertReply = sqlite.query(
    'INSERT INTO replies (id, thread_id, creator_id, content, content_hash, reply_index, is_unique, fire_generated, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const replyRows = [
    {
      id: makeId(),
      threadId: threads[0].id,
      creatorId: users[1].id,
      content: 'I go too. We carry basket.',
      hash: 'seed-reply-1',
      index: 1,
      unique: 1,
      fireGenerated: 3,
    },
    {
      id: makeId(),
      threadId: threads[0].id,
      creatorId: users[2].id,
      content: 'I watch for wolf while gather.',
      hash: 'seed-reply-2',
      index: 2,
      unique: 1,
      fireGenerated: 2,
    },
    {
      id: makeId(),
      threadId: threads[1].id,
      creatorId: users[0].id,
      content: 'Good spear. Make one for me.',
      hash: 'seed-reply-3',
      index: 1,
      unique: 1,
      fireGenerated: 3,
    },
  ];

  for (const row of replyRows) {
    insertReply.run(
      row.id,
      row.threadId,
      row.creatorId,
      row.content,
      row.hash,
      row.index,
      row.unique,
      row.fireGenerated,
      nowMs
    );
  }

  const insertLike = sqlite.query(
    'INSERT INTO likes (id, user_id, reply_id, fire_generated, created_at) VALUES (?, ?, ?, ?, ?)'
  );

  insertLike.run(makeId(), users[1].id, replyRows[0].id, 1, nowMs);
  insertLike.run(makeId(), users[2].id, replyRows[0].id, 1, nowMs);
  insertLike.run(makeId(), users[0].id, replyRows[2].id, 1, nowMs);

  const insertThreadStats = sqlite.query(
    'INSERT INTO user_thread_stats (user_id, thread_id, fire_generated, last_reply_index) VALUES (?, ?, ?, ?)'
  );

  insertThreadStats.run(users[1].id, threads[0].id, 3, 1);
  insertThreadStats.run(users[2].id, threads[0].id, 2, 2);
  insertThreadStats.run(users[0].id, threads[1].id, 3, 1);

  const insertRewardEvent = sqlite.query(
    'INSERT INTO reward_events (id, type, ref_id, created_at) VALUES (?, ?, ?, ?)'
  );

  for (const row of replyRows) {
    insertRewardEvent.run(makeId(), 'reply_replier', row.id, nowMs);
  }

  console.log('Seeded users:', users.length);
  console.log('Seeded tribes:', tribes.length);
  console.log('Seeded threads:', threads.length);
  console.log('Seeded replies:', replyRows.length);
  console.log('Seeded likes:', 3);
};

try {
  createSchema();
  clearData();
  seedData();
  console.log(`Database ready at ${dbPath}`);
} finally {
  sqlite.close();
}
