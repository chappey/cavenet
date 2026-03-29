import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { Database } from 'bun:sqlite';

const dbPath = resolve(process.cwd(), 'src/server/sqlite.db');
const shouldReset = process.argv.includes('--reset');

if (shouldReset && existsSync(dbPath)) {
  rmSync(dbPath);
}

const sqlite = new Database(dbPath, { create: true });
sqlite.exec('PRAGMA foreign_keys = ON;');

const nowMs = Date.now();
const ago = (hours: number) => nowMs - hours * 3600_000;
const makeId = () => crypto.randomUUID();

const createSchema = () => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      username TEXT NOT NULL UNIQUE,
      bio TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      is_player_character INTEGER NOT NULL DEFAULT 0,
      food INTEGER NOT NULL DEFAULT 10,
      fire INTEGER NOT NULL DEFAULT 0,
      last_active_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tribes (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      abbreviation TEXT NOT NULL DEFAULT '',
      description TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      creator_id TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS user_tribes (
      user_id TEXT NOT NULL,
      tribe_id TEXT NOT NULL,
      joined_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, tribe_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (tribe_id) REFERENCES tribes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY NOT NULL,
      creator_id TEXT NOT NULL,
      tribe_id TEXT,
      title TEXT,
      content TEXT,
      type TEXT NOT NULL CHECK(type IN ('text', 'image', 'mixed')),
      image_url TEXT,
      fire_generated INTEGER NOT NULL DEFAULT 0,
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
      likes INTEGER NOT NULL DEFAULT 0,
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
    DROP TABLE IF EXISTS reward_events;
    DROP TABLE IF EXISTS user_activity;
    DROP TABLE IF EXISTS user_thread_stats;
    DROP TABLE IF EXISTS likes;
    DROP TABLE IF EXISTS replies;
    DROP TABLE IF EXISTS threads;
    DROP TABLE IF EXISTS user_tribes;
    DROP TABLE IF EXISTS tribes;
    DROP TABLE IF EXISTS users;
  `);
};

const seedData = () => {
  // ── Users ──
  const users = [
    { id: makeId(), username: 'Grog',   bio: 'Fire master. Me make best flame.', food: 10, fire: 5, isPlayerCharacter: false },
    { id: makeId(), username: 'Brakka', bio: 'Spear maker. Sharp thing good.', food: 8, fire: 3, isPlayerCharacter: false },
    { id: makeId(), username: 'Unga',   bio: 'Hunter of big beast.', food: 6, fire: 7, isPlayerCharacter: false },
    { id: makeId(), username: 'Thokk',  bio: 'Rock painter. Me draw mammoth.', food: 4, fire: 12, isPlayerCharacter: false },
    { id: makeId(), username: 'Kira',   bio: 'Berry finder. Know all plant.', food: 12, fire: 2, isPlayerCharacter: false },
    { id: makeId(), username: 'Drog',   bio: 'Strong. Carry big rock.', food: 3, fire: 0, isPlayerCharacter: false },
  ];

  const insertUser = sqlite.query(
    'INSERT INTO users (id, username, bio, avatar, is_player_character, food, fire, last_active_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const u of users) {
    insertUser.run(u.id, u.username, u.bio, '', u.isPlayerCharacter ? 1 : 0, u.food, u.fire, nowMs, ago(24 * users.indexOf(u)));
  }

  const insertActivity = sqlite.query(
    'INSERT INTO user_activity (user_id, last_active, decay_applied) VALUES (?, ?, ?)'
  );
  for (const u of users) {
    insertActivity.run(u.id, nowMs, 0);
  }

  // ── Tribes ──
  const tribes = [
    { id: makeId(), name: 'Mountain Clan',  abbr: 'MTN', description: 'Strong cave people of the high rocks. We hunt mammoth.', creatorId: users[0].id },
    { id: makeId(), name: 'River Tribe',    abbr: 'RVR', description: 'Fish catchers and reed weavers by the big water.', creatorId: users[2].id },
    { id: makeId(), name: 'Shadow Painters', abbr: 'SHPN', description: 'We paint story on cave wall. Art is life.', creatorId: users[3].id },
  ];

  const insertTribe = sqlite.query(
    'INSERT INTO tribes (id, name, abbreviation, description, avatar, creator_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const t of tribes) {
    insertTribe.run(t.id, t.name, t.abbr, t.description, '', t.creatorId, nowMs);
  }

  // ── Tribe Memberships ──
  const memberships = [
    // Mountain Clan: Grog (creator), Brakka, Drog
    { userId: users[0].id, tribeId: tribes[0].id },
    { userId: users[1].id, tribeId: tribes[0].id },
    { userId: users[5].id, tribeId: tribes[0].id },
    // River Tribe: Unga (creator), Kira, Brakka
    { userId: users[2].id, tribeId: tribes[1].id },
    { userId: users[4].id, tribeId: tribes[1].id },
    { userId: users[1].id, tribeId: tribes[1].id },
    // Shadow Painters: Thokk (creator), Grog, Kira
    { userId: users[3].id, tribeId: tribes[2].id },
    { userId: users[0].id, tribeId: tribes[2].id },
    { userId: users[4].id, tribeId: tribes[2].id },
  ];

  const insertMembership = sqlite.query(
    'INSERT INTO user_tribes (user_id, tribe_id, joined_at) VALUES (?, ?, ?)'
  );
  for (const m of memberships) {
    insertMembership.run(m.userId, m.tribeId, nowMs);
  }

  // ── Threads ──
  const threadData = [
    {
      id: makeId(), creatorId: users[0].id, tribeId: tribes[0].id, type: 'text',
      title: 'Berry Bush Discovery',
      content: 'Me find big berry bush near river. Good food. Many berry, enough for whole clan. We go at sun-up.',
      fireGenerated: 8,
    },
    {
      id: makeId(), creatorId: users[1].id, tribeId: null, type: 'mixed',
      title: 'New Spear Design',
      content: 'Made new spear with sharp rock and long stick. Pointy end go through mammoth hide. Works very good for hunting.',
      fireGenerated: 4,
    },
    {
      id: makeId(), creatorId: users[2].id, tribeId: tribes[1].id, type: 'text',
      title: 'Warning: Mammoth Tracks',
      content: 'Mammoth tracks by stone hill. Big ones. Maybe whole herd moving through valley. Be careful when gathering.',
      fireGenerated: 12,
    },
    {
      id: makeId(), creatorId: users[3].id, tribeId: tribes[2].id, type: 'text',
      title: 'New Cave Painting Technique',
      content: 'Me mix berry juice with mud. Make purple color never seen before! Come see on east wall of big cave.',
      fireGenerated: 15,
    },
    {
      id: makeId(), creatorId: users[4].id, tribeId: tribes[1].id, type: 'text',
      title: 'Which Berry Safe?',
      content: 'Found new berry. Red with white spots. Smell sweet but me not sure if safe. Anyone know this berry?',
      fireGenerated: 6,
    },
    {
      id: makeId(), creatorId: users[0].id, tribeId: null, type: 'text',
      title: 'Fire Making Contest',
      content: 'Me challenge any cave person to fire making contest. First one to make big flame win extra food from tribe.',
      fireGenerated: 3,
    },
  ];

  const insertThread = sqlite.query(
    'INSERT INTO threads (id, creator_id, tribe_id, title, content, type, image_url, fire_generated, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (let i = 0; i < threadData.length; i++) {
    const t = threadData[i];
    insertThread.run(t.id, t.creatorId, t.tribeId, t.title, t.content, t.type, null, t.fireGenerated, ago(48 - i * 6));
  }

  // ── Replies ──
  const replyData = [
    // Thread 0 (Berry Bush) replies
    { id: makeId(), threadId: threadData[0].id, creatorId: users[1].id, content: 'I go too. We carry basket. Me bring big one made from reed.', index: 1, fire: 3 },
    { id: makeId(), threadId: threadData[0].id, creatorId: users[2].id, content: 'I watch for wolf while gather. Bring spear just in case.', index: 2, fire: 2 },
    { id: makeId(), threadId: threadData[0].id, creatorId: users[4].id, content: 'Me know that bush! Berry very sweet. But watch for thorns on left side.', index: 3, fire: 1 },
    // Thread 2 (Mammoth Warning) replies
    { id: makeId(), threadId: threadData[2].id, creatorId: users[0].id, content: 'We should set fire ring around camp tonight. Mammoth afraid of fire.', index: 1, fire: 3 },
    { id: makeId(), threadId: threadData[2].id, creatorId: users[1].id, content: 'Me make extra spears. Everyone should carry one when going out.', index: 2, fire: 2 },
    { id: makeId(), threadId: threadData[2].id, creatorId: users[3].id, content: 'Me paint warning sign on rocks near trail. Red hand mean danger.', index: 3, fire: 1 },
    { id: makeId(), threadId: threadData[2].id, creatorId: users[4].id, content: 'Hide food stores underground. Mammoth can smell food from far.', index: 4, fire: 1 },
    { id: makeId(), threadId: threadData[2].id, creatorId: users[0].id, content: 'Good idea with paint, Thokk. Me add fire marks too.', index: 5, fire: 1 },
    // Thread 3 (Cave Painting) replies
    { id: makeId(), threadId: threadData[3].id, creatorId: users[0].id, content: 'Purple?! Me must see this. Coming to big cave after hunt.', index: 1, fire: 3 },
    { id: makeId(), threadId: threadData[3].id, creatorId: users[4].id, content: 'Which berry you use? Me have many type. Can bring more for painting.', index: 2, fire: 2 },
    { id: makeId(), threadId: threadData[3].id, creatorId: users[2].id, content: 'Can you paint my hunting story? Me bring food as trade.', index: 3, fire: 1 },
    { id: makeId(), threadId: threadData[3].id, creatorId: users[1].id, content: 'Art is magic. Me want learn. Can Thokk teach?', index: 4, fire: 1 },
    // Thread 4 (Berry question) replies
    { id: makeId(), threadId: threadData[4].id, creatorId: users[0].id, content: 'NO EAT! Red with white spot is BAD berry. Make belly hurt for many sun.', index: 1, fire: 3 },
    { id: makeId(), threadId: threadData[4].id, creatorId: users[3].id, content: 'Me paint picture of bad berry on warning wall. All should know.', index: 2, fire: 2 },
    // Thread 1 (New Spear) replies
    { id: makeId(), threadId: threadData[1].id, creatorId: users[0].id, content: 'Good spear. Make one for me. Me trade fire-starting rocks.', index: 1, fire: 3 },
  ];

  const insertReply = sqlite.query(
    'INSERT INTO replies (id, thread_id, creator_id, content, content_hash, reply_index, is_unique, fire_generated, likes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (let i = 0; i < replyData.length; i++) {
    const r = replyData[i];
    insertReply.run(r.id, r.threadId, r.creatorId, r.content, `seed-hash-${i}`, r.index, 1, r.fire, 0, ago(40 - i * 2));
  }

  // ── Likes ──
  const insertLike = sqlite.query(
    'INSERT INTO likes (id, user_id, reply_id, fire_generated, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  // Some likes on popular replies
  insertLike.run(makeId(), users[2].id, replyData[0].id, 1, nowMs);
  insertLike.run(makeId(), users[3].id, replyData[0].id, 1, nowMs);
  insertLike.run(makeId(), users[0].id, replyData[3].id, 1, nowMs);
  insertLike.run(makeId(), users[1].id, replyData[8].id, 1, nowMs);
  insertLike.run(makeId(), users[4].id, replyData[3].id, 1, nowMs);

  // Update reply like counts
  sqlite.exec(`UPDATE replies SET likes = (SELECT COUNT(*) FROM likes WHERE likes.reply_id = replies.id)`);

  // ── Thread Stats ──
  const insertThreadStats = sqlite.query(
    'INSERT INTO user_thread_stats (user_id, thread_id, fire_generated, last_reply_index) VALUES (?, ?, ?, ?)'
  );
  insertThreadStats.run(users[1].id, threadData[0].id, 3, 1);
  insertThreadStats.run(users[2].id, threadData[0].id, 2, 2);
  insertThreadStats.run(users[4].id, threadData[0].id, 1, 3);
  insertThreadStats.run(users[0].id, threadData[2].id, 4, 5);
  insertThreadStats.run(users[1].id, threadData[2].id, 2, 2);
  insertThreadStats.run(users[3].id, threadData[2].id, 1, 3);
  insertThreadStats.run(users[4].id, threadData[2].id, 1, 4);
  insertThreadStats.run(users[0].id, threadData[1].id, 3, 1);

  // ── Reward Events ──
  const insertRewardEvent = sqlite.query(
    'INSERT INTO reward_events (id, type, ref_id, created_at) VALUES (?, ?, ?, ?)'
  );
  for (const r of replyData) {
    insertRewardEvent.run(makeId(), 'reply_replier', r.id, nowMs);
  }

  console.log('Seeded users:', users.length);
  console.log('Seeded tribes:', tribes.length);
  console.log('Seeded memberships:', memberships.length);
  console.log('Seeded threads:', threadData.length);
  console.log('Seeded replies:', replyData.length);
  console.log('Seeded likes:', 5);
};

try {
  clearData();
  createSchema();
  seedData();
  console.log(`Database ready at ${dbPath}`);
} finally {
  sqlite.close();
}
