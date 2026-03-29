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
      hunt_cooldown_until INTEGER NOT NULL DEFAULT 0,
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
    { id: makeId(), username: 'Grog',   bio: 'Fire keeper. Make camp glow all night.', food: 18, fire: 1, isPlayerCharacter: false },
    { id: makeId(), username: 'Brakka', bio: 'Tool maker. Flint go click click and cut good.', food: 16, fire: 0, isPlayerCharacter: false },
    { id: makeId(), username: 'Unga',   bio: 'Hunter. Track mammoth, deer, and snack.', food: 18, fire: 2, isPlayerCharacter: false },
    { id: makeId(), username: 'Thokk',  bio: 'Cave artist. Paint big story on wall.', food: 15, fire: 3, isPlayerCharacter: false },
    { id: makeId(), username: 'Kira',   bio: 'Berry forager. Know safe plant and tasty root.', food: 20, fire: 1, isPlayerCharacter: false },
    { id: makeId(), username: 'Drog',   bio: 'Rock hauler. Build shelter and stack stone.', food: 14, fire: 0, isPlayerCharacter: false },
  ];

  const insertUser = sqlite.query(
    'INSERT INTO users (id, username, bio, avatar, is_player_character, food, fire, hunt_cooldown_until, last_active_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const u of users) {
    insertUser.run(u.id, u.username, u.bio, '', u.isPlayerCharacter ? 1 : 0, u.food, u.fire, 0, nowMs, ago(24 * users.indexOf(u)));
  }

  const insertActivity = sqlite.query(
    'INSERT INTO user_activity (user_id, last_active, decay_applied) VALUES (?, ?, ?)'
  );
  for (const u of users) {
    insertActivity.run(u.id, nowMs, 0);
  }

  // ── Tribes ──
  const tribes = [
    { id: makeId(), name: 'Hunter Hollow',    abbr: 'HUNT', description: 'Track big game, share trail maps, and show spear wins.', creatorId: users[2].id },
    { id: makeId(), name: 'Flint Forge',      abbr: 'FLNT', description: 'Tool talk for stone chips, spear tips, and smart builds.', creatorId: users[1].id },
    { id: makeId(), name: 'Painted Cave',     abbr: 'PAIN', description: 'Wall art, ochre recipes, and story marks for the clan.', creatorId: users[3].id },
    { id: makeId(), name: 'Fire Circle',      abbr: 'FIRE', description: 'Keep flame alive, swap ember tricks, and celebrate warmth.', creatorId: users[0].id },
    { id: makeId(), name: 'Berry Patch',      abbr: 'BERR', description: 'Safe berries, sweet roots, and foraging gossip.', creatorId: users[4].id },
  ];

  const insertTribe = sqlite.query(
    'INSERT INTO tribes (id, name, abbreviation, description, avatar, creator_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const t of tribes) {
    insertTribe.run(t.id, t.name, t.abbr, t.description, '', t.creatorId, nowMs);
  }

  // ── Tribe Memberships ──
  const memberships = [
    // Hunter Hollow: Unga (creator), Grog, Drog
    { userId: users[2].id, tribeId: tribes[0].id },
    { userId: users[0].id, tribeId: tribes[0].id },
    { userId: users[5].id, tribeId: tribes[0].id },
    // Flint Forge: Brakka (creator), Grog, Drog
    { userId: users[1].id, tribeId: tribes[1].id },
    { userId: users[0].id, tribeId: tribes[1].id },
    { userId: users[5].id, tribeId: tribes[1].id },
    // Painted Cave: Thokk (creator), Grog, Kira
    { userId: users[3].id, tribeId: tribes[2].id },
    { userId: users[0].id, tribeId: tribes[2].id },
    { userId: users[4].id, tribeId: tribes[2].id },
    // Fire Circle: Grog (creator), Brakka, Thokk
    { userId: users[0].id, tribeId: tribes[3].id },
    { userId: users[1].id, tribeId: tribes[3].id },
    { userId: users[3].id, tribeId: tribes[3].id },
    // Berry Patch: Kira (creator), Unga, Thokk
    { userId: users[4].id, tribeId: tribes[4].id },
    { userId: users[2].id, tribeId: tribes[4].id },
    { userId: users[3].id, tribeId: tribes[4].id },
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
      id: makeId(), creatorId: users[2].id, tribeId: tribes[0].id, type: 'text',
      title: 'Best Mammoth Trail',
      content: 'Me spot fresh mammoth track by north ridge. Trail go to open grass. Good hunt spot if we move quiet and early.',
      fireGenerated: 10,
    },
    {
      id: makeId(), creatorId: users[1].id, tribeId: tribes[1].id, type: 'mixed',
      title: 'Flint Knife Test',
      content: 'Me chip flint into tiny knife. Cuts hide clean and easy. Need tell if edge stay sharp after many uses.',
      fireGenerated: 7,
    },
    {
      id: makeId(), creatorId: users[3].id, tribeId: tribes[2].id, type: 'text',
      title: 'New Ochre Mix',
      content: 'Me mix red dirt, berry juice, and fat. Color stay bright on wall and not drip much. Good for big story scene.',
      fireGenerated: 15,
    },
    {
      id: makeId(), creatorId: users[0].id, tribeId: tribes[3].id, type: 'text',
      title: 'Fire Pit Upgrade',
      content: 'Stack stone around fire pit. Flame stay warm longer and wind not steal heat. Might be best camp fire yet.',
      fireGenerated: 13,
    },
    {
      id: makeId(), creatorId: users[4].id, tribeId: tribes[4].id, type: 'text',
      title: 'Safe Berry Map',
      content: 'Found three berry bushes east of creek. Two safe, one bad. I draw little rock map so nobody eat wrong thing.',
      fireGenerated: 9,
    },
    {
      id: makeId(), creatorId: users[5].id, tribeId: null, type: 'text',
      title: 'Shelter Rock Stack',
      content: 'Build wall with flat stone and mud. Keeps rain out and makes sleeping spot less cold. Maybe add bone hook for gear.',
      fireGenerated: 5,
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
    // Thread 0 (Best Mammoth Trail) replies
    { id: makeId(), threadId: threadData[0].id, creatorId: users[0].id, content: 'Hunter Hollow like this. Me bring fire and rope. Mammoth not escape us.', index: 1, fire: 3 },
    { id: makeId(), threadId: threadData[0].id, creatorId: users[1].id, content: 'Need better hook on spear before hunt. Me make small fix tonight.', index: 2, fire: 2 },
    { id: makeId(), threadId: threadData[0].id, creatorId: users[5].id, content: 'I make stone marker on trail so nobody get lost in grass.', index: 3, fire: 1 },
    // Thread 2 (New Ochre Mix) replies
    { id: makeId(), threadId: threadData[2].id, creatorId: users[0].id, content: 'Color strong. Me want use on fire stories. Show more wall.', index: 1, fire: 3 },
    { id: makeId(), threadId: threadData[2].id, creatorId: users[4].id, content: 'Berry juice maybe make it smell sweet too. Good for art and snack.', index: 2, fire: 2 },
    { id: makeId(), threadId: threadData[2].id, creatorId: users[1].id, content: 'Need tiny stone cup for mix. I can carve one.', index: 3, fire: 1 },
    { id: makeId(), threadId: threadData[2].id, creatorId: users[2].id, content: 'Paint my hunt on wall next. Big beast go here.', index: 4, fire: 1 },
    { id: makeId(), threadId: threadData[2].id, creatorId: users[0].id, content: 'Good mix, Thokk. Maybe add ash for darker line.', index: 5, fire: 1 },
    // Thread 3 (Fire Pit Upgrade) replies
    { id: makeId(), threadId: threadData[3].id, creatorId: users[1].id, content: 'Stone circle smart. Toolmaker say yes. Safer for big fire.', index: 1, fire: 3 },
    { id: makeId(), threadId: threadData[3].id, creatorId: users[3].id, content: 'I paint flames on new wall. Fire circle need art too.', index: 2, fire: 2 },
    { id: makeId(), threadId: threadData[3].id, creatorId: users[5].id, content: 'Put drying rack near heat. Rock shelf best for meat.', index: 3, fire: 1 },
    { id: makeId(), threadId: threadData[3].id, creatorId: users[2].id, content: 'Fire help hunter too. Warm spear hand before dawn.', index: 4, fire: 1 },
    // Thread 4 (Safe Berry Map) replies
    { id: makeId(), threadId: threadData[4].id, creatorId: users[2].id, content: 'Good map. Hunter can follow creek to safe berries after chase.', index: 1, fire: 3 },
    { id: makeId(), threadId: threadData[4].id, creatorId: users[3].id, content: 'I draw bad berry with big red skull on wall now.', index: 2, fire: 2 },
    // Thread 1 (Flint Knife Test) replies
    { id: makeId(), threadId: threadData[1].id, creatorId: users[0].id, content: 'Knife looks sharp. Me use to cut rope and skin.', index: 1, fire: 3 },
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
  insertThreadStats.run(users[0].id, threadData[0].id, 3, 1);
  insertThreadStats.run(users[1].id, threadData[0].id, 2, 2);
  insertThreadStats.run(users[5].id, threadData[0].id, 1, 3);
  insertThreadStats.run(users[0].id, threadData[2].id, 4, 5);
  insertThreadStats.run(users[1].id, threadData[2].id, 2, 3);
  insertThreadStats.run(users[2].id, threadData[2].id, 1, 4);
  insertThreadStats.run(users[4].id, threadData[2].id, 2, 2);
  insertThreadStats.run(users[1].id, threadData[3].id, 3, 1);
  insertThreadStats.run(users[3].id, threadData[3].id, 2, 2);
  insertThreadStats.run(users[5].id, threadData[3].id, 1, 3);
  insertThreadStats.run(users[2].id, threadData[3].id, 1, 4);
  insertThreadStats.run(users[2].id, threadData[4].id, 3, 1);
  insertThreadStats.run(users[3].id, threadData[4].id, 2, 2);
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
