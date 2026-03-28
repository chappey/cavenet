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
      food INTEGER NOT NULL DEFAULT 10,
      fire INTEGER NOT NULL DEFAULT 0,
      last_active_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('text', 'image', 'mixed', 'recovery')),
      content TEXT,
      image_url TEXT,
      fire_generated INTEGER NOT NULL DEFAULT 0,
      is_recovery INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS replies (
      id TEXT PRIMARY KEY NOT NULL,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL DEFAULT '',
      reply_index INTEGER NOT NULL,
      is_unique INTEGER NOT NULL,
      fire_awarded INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS likes (
      user_id TEXT NOT NULL,
      post_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, post_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS thread_fire (
      user_id TEXT NOT NULL,
      post_id TEXT NOT NULL,
      fire_accumulated INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, post_id)
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
    DELETE FROM thread_fire;
    DELETE FROM likes;
    DELETE FROM replies;
    DELETE FROM posts;
    DELETE FROM users;
  `);
};

const seedData = () => {
  const users = [
    { id: makeId(), username: 'Grog', food: 10, fire: 2 },
    { id: makeId(), username: 'Brakka', food: 8, fire: 3 },
    { id: makeId(), username: 'Unga', food: 6, fire: 5 },
  ];

  const insertUser = sqlite.query(
    'INSERT INTO users (id, username, food, fire, last_active_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );

  for (const user of users) {
    insertUser.run(user.id, user.username, user.food, user.fire, nowMs, nowMs);
  }

  const posts = [
    {
      id: makeId(),
      userId: users[0].id,
      type: 'text',
      content: 'Me find big berry bush near river. Good food.',
      fireGenerated: 2,
    },
    {
      id: makeId(),
      userId: users[1].id,
      type: 'mixed',
      content: 'Made new spear. Pointy. Works very good.',
      fireGenerated: 1,
    },
    {
      id: makeId(),
      userId: users[2].id,
      type: 'image',
      content: 'Mammoth tracks by stone hill. Be careful.',
      fireGenerated: 0,
    },
  ];

  const insertPost = sqlite.query(
    'INSERT INTO posts (id, user_id, type, content, image_url, fire_generated, is_recovery, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  for (const post of posts) {
    insertPost.run(post.id, post.userId, post.type, post.content, null, post.fireGenerated, 0, nowMs);
  }

  const insertReply = sqlite.query(
    'INSERT INTO replies (id, post_id, user_id, content, content_hash, reply_index, is_unique, fire_awarded, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const replyRows = [
    {
      id: makeId(),
      postId: posts[0].id,
      userId: users[1].id,
      content: 'I go too. We carry basket.',
      hash: 'seed-reply-1',
      index: 1,
      unique: 1,
      fireAwarded: 3,
    },
    {
      id: makeId(),
      postId: posts[0].id,
      userId: users[2].id,
      content: 'I watch for wolf while gather.',
      hash: 'seed-reply-2',
      index: 2,
      unique: 1,
      fireAwarded: 3,
    },
    {
      id: makeId(),
      postId: posts[1].id,
      userId: users[0].id,
      content: 'Good spear. Make one for me.',
      hash: 'seed-reply-3',
      index: 1,
      unique: 1,
      fireAwarded: 3,
    },
  ];

  for (const row of replyRows) {
    insertReply.run(
      row.id,
      row.postId,
      row.userId,
      row.content,
      row.hash,
      row.index,
      row.unique,
      row.fireAwarded,
      nowMs
    );
  }

  const insertLike = sqlite.query(
    'INSERT INTO likes (user_id, post_id, created_at) VALUES (?, ?, ?)'
  );

  insertLike.run(users[1].id, posts[0].id, nowMs);
  insertLike.run(users[2].id, posts[0].id, nowMs);
  insertLike.run(users[0].id, posts[1].id, nowMs);

  const insertThreadFire = sqlite.query(
    'INSERT INTO thread_fire (user_id, post_id, fire_accumulated) VALUES (?, ?, ?)'
  );

  insertThreadFire.run(users[1].id, posts[0].id, 3);
  insertThreadFire.run(users[2].id, posts[0].id, 3);
  insertThreadFire.run(users[0].id, posts[1].id, 3);

  const insertRewardEvent = sqlite.query(
    'INSERT INTO reward_events (id, type, ref_id, created_at) VALUES (?, ?, ?, ?)'
  );

  for (const row of replyRows) {
    insertRewardEvent.run(makeId(), 'reply_replier', row.id, nowMs);
  }

  console.log('Seeded users:', users.length);
  console.log('Seeded posts:', posts.length);
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
