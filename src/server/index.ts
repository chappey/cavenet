import { Elysia, t } from 'elysia';
import { db } from './db';
import { users, threads, replies, likes, tribes, userTribes, userThreadStats, userActivity, rewardEvents } from './db/schema';
import { eq, desc, sql, and, inArray } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { simulatedDaysBetween, TIME_SCALE } from './time';

// ── Constants ──

const POST_COST = {
  mixed: 1,
  text: 2,
  image: 2,
} as const;

const TRIBE_CREATION_COST = 3;
const THREAD_FIRE_CAP = 20;
const LIKE_FIRE_CAP = 5;
const FIRE_DECAY_PER_DAY = 1;

// ── Helpers ──

const toUtcDayStart = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const daysBetweenUtc = (older: Date, newer: Date) => {
  const ms = toUtcDayStart(newer) - toUtcDayStart(older);
  return Math.max(0, Math.floor(ms / 86_400_000));
};

const normalizeReply = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const contentHash = (value: string) => createHash('sha256').update(normalizeReply(value)).digest('hex');

const getThreadAllowance = async (tx: typeof db, userId: string, threadId: string) => {
  const row = await tx.query.userThreadStats.findFirst({
    where: and(eq(userThreadStats.userId, userId), eq(userThreadStats.threadId, threadId))
  });
  const current = row?.fireGenerated ?? 0;
  return Math.max(0, THREAD_FIRE_CAP - current);
};

const grantThreadFire = async (tx: typeof db, userId: string, threadId: string, requested: number) => {
  const allowance = await getThreadAllowance(tx, userId, threadId);
  const granted = Math.max(0, Math.min(requested, allowance));

  if (granted <= 0) return 0;

  await tx.update(users)
    .set({ fire: sql`${users.fire} + ${granted}` })
    .where(eq(users.id, userId));

  await tx.insert(userThreadStats)
    .values({ userId, threadId, fireGenerated: granted })
    .onConflictDoUpdate({
      target: [userThreadStats.userId, userThreadStats.threadId],
      set: { fireGenerated: sql`${userThreadStats.fireGenerated} + ${granted}` }
    });

  // Also update thread aggregate fire
  await tx.update(threads)
    .set({ fireGenerated: sql`${threads.fireGenerated} + ${granted}` })
    .where(eq(threads.id, threadId));

  return granted;
};

const markUserActive = async (tx: typeof db, userId: string) => {
  const now = new Date();
  await tx.update(users)
    .set({ lastActiveAt: now })
    .where(eq(users.id, userId));

  await tx.insert(userActivity)
    .values({ userId, lastActive: now, decayApplied: false })
    .onConflictDoUpdate({
      target: [userActivity.userId],
      set: { lastActive: now, decayApplied: false }
    });
};

const applyDailyDecayIfNeeded = async (tx: typeof db, userId: string) => {
  const user = await tx.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return;

  const now = new Date();
  const lastActive = user.lastActiveAt ?? now;
  // Use simulated time so decay is observable during testing
  const inactiveDays = simulatedDaysBetween(new Date(lastActive), now);

  if (inactiveDays <= 0) return;

  const decay = inactiveDays * FIRE_DECAY_PER_DAY;
  console.log(`[decay] ${user.username}: ${inactiveDays} sim-days inactive → -${decay} fire (scale=${TIME_SCALE}x)`);
  await tx.update(users)
    .set({
      fire: sql`MAX(${users.fire} - ${decay}, 0)`
    })
    .where(eq(users.id, userId));
};

/** Enrich thread rows with creator username, reply count, unique poster count, recent replies */
const enrichThreads = async (threadRows: any[]) => {
  if (threadRows.length === 0) return [];

  const threadIds = threadRows.map(t => t.id);

  // Get creator usernames
  const creatorIds = [...new Set(threadRows.map(t => t.creatorId))];
  const creatorRows = await db.select({ id: users.id, username: users.username })
    .from(users)
    .where(inArray(users.id, creatorIds));
  const creatorMap = Object.fromEntries(creatorRows.map(u => [u.id, u.username]));

  // Get reply counts and unique poster counts per thread
  const statRows = await db.select({
    threadId: replies.threadId,
    replyCount: sql<number>`COUNT(*)`,
    uniquePosters: sql<number>`COUNT(DISTINCT ${replies.creatorId})`,
    lastReplyAt: sql<number>`MAX(${replies.createdAt})`,
  })
    .from(replies)
    .where(inArray(replies.threadId, threadIds))
    .groupBy(replies.threadId);

  const statMap = Object.fromEntries(statRows.map(s => [s.threadId, s]));

  // Get up to 3 most recent replies per thread (with creator usernames)
  const recentReplies = await db.select({
    id: replies.id,
    threadId: replies.threadId,
    creatorId: replies.creatorId,
    content: replies.content,
    replyIndex: replies.replyIndex,
    fireGenerated: replies.fireGenerated,
    likes: replies.likes,
    createdAt: replies.createdAt,
    creatorUsername: users.username,
  })
    .from(replies)
    .innerJoin(users, eq(replies.creatorId, users.id))
    .where(inArray(replies.threadId, threadIds))
    .orderBy(desc(replies.createdAt));

  // Group recent replies by thread, keep only last 3
  const replyMap: Record<string, any[]> = {};
  for (const r of recentReplies) {
    if (!replyMap[r.threadId]) replyMap[r.threadId] = [];
    if (replyMap[r.threadId].length < 3) {
      replyMap[r.threadId].push(r);
    }
  }

  // Get tribe info for threads that belong to a tribe
  const tribeIds = [...new Set(threadRows.filter(t => t.tribeId).map(t => t.tribeId))];
  let tribeMap: Record<string, { name: string; abbreviation: string }> = {};
  if (tribeIds.length > 0) {
    const tribeRows = await db.select({
      id: tribes.id,
      name: tribes.name,
      abbreviation: tribes.abbreviation,
    }).from(tribes).where(inArray(tribes.id, tribeIds));
    tribeMap = Object.fromEntries(tribeRows.map(t => [t.id, { name: t.name, abbreviation: t.abbreviation }]));
  }

  return threadRows.map(t => ({
    ...t,
    creatorUsername: creatorMap[t.creatorId] ?? 'Unknown',
    replyCount: statMap[t.id]?.replyCount ?? 0,
    uniquePosters: statMap[t.id]?.uniquePosters ?? 0,
    lastReplyAt: statMap[t.id]?.lastReplyAt ?? null,
    recentReplies: replyMap[t.id] ?? [],
    tribeName: t.tribeId ? tribeMap[t.tribeId]?.name ?? null : null,
    tribeAbbreviation: t.tribeId ? tribeMap[t.tribeId]?.abbreviation ?? null : null,
  }));
};

// ── App ──

const app = new Elysia()
  // Read user from X-User-Id header (no auth — just user selection)
  .derive(async ({ request }) => {
    const userId = request.headers.get('x-user-id');
    if (userId) {
      try {
        await db.transaction(async (tx) => {
          await applyDailyDecayIfNeeded(tx, userId);
        });
      } catch (e) {
        // Don't let decay errors crash the request
        console.error('[derive] decay error:', e);
      }
    }
    return { userId: userId ?? null };
  })

  .group('/api', (app) => app

    // ── Users ──

    .get('/users', async () => {
      return await db.select({
        id: users.id,
        username: users.username,
        bio: users.bio,
        avatar: users.avatar,
        food: users.food,
        fire: users.fire,
        createdAt: users.createdAt,
      }).from(users).orderBy(users.username);
    })

    .get('/me', async ({ userId }) => {
      if (!userId) return null;
      const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
      return user ?? null;
    })

    .get('/users/:id', async ({ params }) => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, params.id)
      });
      if (!user) throw new Error('User not found');

      const userThreads = await db.query.threads.findMany({
        where: eq(threads.creatorId, params.id),
        orderBy: [desc(threads.createdAt)]
      });

      const enriched = await enrichThreads(userThreads);

      // Get tribes user belongs to
      const memberRows = await db.select({
        tribeId: userTribes.tribeId,
        tribeName: tribes.name,
        tribeAbbreviation: tribes.abbreviation,
        tribeAvatar: tribes.avatar,
        tribeDescription: tribes.description,
      })
        .from(userTribes)
        .innerJoin(tribes, eq(userTribes.tribeId, tribes.id))
        .where(eq(userTribes.userId, params.id));

      return { ...user, threads: enriched, tribes: memberRows };
    })

    // PATCH /api/users/:id/bio
    .patch('/users/:id/bio', async ({ params, body, userId }) => {
      if (!userId) throw new Error('No user selected');
      if (params.id !== userId) throw new Error('Can only edit your own bio');

      await db.update(users)
        .set({ bio: body.bio })
        .where(eq(users.id, userId));

      return { status: 'updated' };
    }, {
      body: t.Object({
        bio: t.String(),
      })
    })

    // ── Feed ──

    .get('/feed', async ({ query }) => {
      const sort = (query as any)?.sort ?? 'newest';
      const tribeId = (query as any)?.tribeId;
      const whereClause = tribeId ? eq(threads.tribeId, tribeId) : undefined;

      let rows;
      if (sort === 'hottest') {
        rows = await db.select().from(threads)
          .where(whereClause)
          .orderBy(desc(threads.fireGenerated))
          .limit(50);
      } else {
        // newest + active both start with createdAt desc
        rows = await db.select().from(threads)
          .where(whereClause)
          .orderBy(desc(threads.createdAt))
          .limit(50);
      }

      const enriched = await enrichThreads(rows);

      // For 'active' sort, re-sort by lastReplyAt on enriched data
      if (sort === 'active') {
        enriched.sort((a: any, b: any) => {
          const aTime = a.lastReplyAt ?? a.createdAt;
          const bTime = b.lastReplyAt ?? b.createdAt;
          const aMs = aTime instanceof Date ? aTime.getTime() : Number(aTime);
          const bMs = bTime instanceof Date ? bTime.getTime() : Number(bTime);
          return bMs - aMs;
        });
      }

      return enriched;
    })

    // ── Threads ──

    .post('/threads', async ({ body, userId }) => {
      if (!userId) throw new Error('No user selected');
      const cost = POST_COST[body.type as keyof typeof POST_COST] ?? POST_COST.text;

      const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
      if (!user) throw new Error('User not found');
      if (user.food < cost) throw new Error('Not enough food');

      const thread = await db.transaction(async (tx) => {
        await tx.update(users)
          .set({ food: sql`${users.food} - ${cost}` })
          .where(eq(users.id, userId));

        const [newThread] = await tx.insert(threads).values({
          creatorId: userId,
          title: body.title,
          type: body.type as any,
          content: body.content,
          imageUrl: body.imageUrl,
          tribeId: body.tribeId,
        }).returning();

        await markUserActive(tx, userId);
        return newThread;
      });

      return thread;
    }, {
      body: t.Object({
        title: t.Optional(t.String()),
        type: t.Union([t.Literal('text'), t.Literal('image'), t.Literal('mixed')]),
        content: t.String(),
        imageUrl: t.Optional(t.String()),
        tribeId: t.Optional(t.String())
      })
    })

    .get('/threads/:id', async ({ params }) => {
      const thread = await db.query.threads.findFirst({
        where: eq(threads.id, params.id)
      });
      if (!thread) throw new Error('Thread not found');

      // Get creator username
      const creator = await db.query.users.findFirst({ where: eq(users.id, thread.creatorId) });

      const threadReplies = await db.select({
        id: replies.id,
        threadId: replies.threadId,
        creatorId: replies.creatorId,
        content: replies.content,
        replyIndex: replies.replyIndex,
        fireGenerated: replies.fireGenerated,
        likes: replies.likes,
        isUnique: replies.isUnique,
        createdAt: replies.createdAt,
        creatorUsername: users.username,
      })
        .from(replies)
        .innerJoin(users, eq(replies.creatorId, users.id))
        .where(eq(replies.threadId, params.id))
        .orderBy(replies.replyIndex);

      // Get reply count and unique poster count
      const statRows = await db.select({
        replyCount: sql<number>`COUNT(*)`,
        uniquePosters: sql<number>`COUNT(DISTINCT ${replies.creatorId})`,
      })
        .from(replies)
        .where(eq(replies.threadId, params.id));

      return {
        ...thread,
        creatorUsername: creator?.username ?? 'Unknown',
        replyCount: statRows[0]?.replyCount ?? 0,
        uniquePosters: statRows[0]?.uniquePosters ?? 0,
        replies: threadReplies,
      };
    })

    // ── Replies ──

    .post('/threads/:id/replies', async ({ params, body, userId }) => {
      if (!userId) throw new Error('No user selected');
      const threadId = params.id;
      const hash = contentHash(body.content);

      const result = await db.transaction(async (tx) => {
        const thread = await tx.query.threads.findFirst({ where: eq(threads.id, threadId) });
        if (!thread) throw new Error('Thread not found');

        const indexRows = await tx.select({
          nextIndex: sql<number>`COALESCE(MAX(${replies.replyIndex}), 0) + 1`
        })
          .from(replies)
          .where(eq(replies.threadId, threadId));
        const replyIndex = indexRows[0]?.nextIndex ?? 1;

        const duplicateHashReply = await tx.query.replies.findFirst({
          where: and(eq(replies.threadId, threadId), eq(replies.contentHash, hash))
        });
        const isUnique = !duplicateHashReply;

        const [reply] = await tx.insert(replies).values({
          threadId,
          creatorId: userId,
          content: body.content,
          contentHash: hash,
          replyIndex,
          isUnique,
          fireGenerated: 0,
        }).returning();

        let fireAwardedToReplier = 0;
        let fireAwardedToOwner = 0;

        const isOwnerReply = thread.creatorId === userId;
        if (isOwnerReply) {
          const ownerEvent = await tx.insert(rewardEvents)
            .values({ type: 'reply_op', refId: reply.id })
            .onConflictDoNothing()
            .returning();

          if (ownerEvent.length > 0) {
            fireAwardedToReplier = await grantThreadFire(tx, userId, threadId, 1);
          }
        } else {
          const replierCountRows = await tx.select({
            count: sql<number>`COUNT(*)`
          })
            .from(replies)
            .where(and(eq(replies.threadId, threadId), eq(replies.creatorId, userId)));
          const replierCount = replierCountRows[0]?.count ?? 1;
          const baseReward = Math.max(3 - (replierCount - 1), 1);

          const replierEvent = await tx.insert(rewardEvents)
            .values({ type: 'reply_replier', refId: reply.id })
            .onConflictDoNothing()
            .returning();

          if (replierEvent.length > 0) {
            fireAwardedToReplier = await grantThreadFire(tx, userId, threadId, baseReward);
          }

          if (isUnique) {
            const ownerEvent = await tx.insert(rewardEvents)
              .values({ type: 'reply_owner', refId: reply.id })
              .onConflictDoNothing()
              .returning();

            if (ownerEvent.length > 0) {
              fireAwardedToOwner = await grantThreadFire(tx, thread.creatorId, threadId, 2);
            }
          }
        }

        await tx.update(replies)
          .set({ fireGenerated: fireAwardedToReplier })
          .where(eq(replies.id, reply.id));

        await markUserActive(tx, userId);

        return {
          ...reply,
          fireGenerated: fireAwardedToReplier,
          ownerFireAwarded: fireAwardedToOwner,
        };
      });

      return result;
    }, {
      body: t.Object({
        content: t.String()
      })
    })

    // ── Likes ──

    .post('/replies/:id/like', async ({ params, userId }) => {
      if (!userId) throw new Error('No user selected');
      const replyId = params.id;

      const outcome = await db.transaction(async (tx) => {
        const inserted = await tx.insert(likes)
          .values({ userId, replyId, fireGenerated: 0 })
          .onConflictDoNothing()
          .returning();

        if (inserted.length === 0) {
          return { status: 'already_liked' as const };
        }

        const replyRow = await tx.query.replies.findFirst({ where: eq(replies.id, replyId) });
        if (!replyRow) throw new Error('Reply not found');

        // Update like count on reply
        await tx.update(replies)
          .set({ likes: sql`${replies.likes} + 1` })
          .where(eq(replies.id, replyId));

        // Award fire to reply creator (capped per-reply at LIKE_FIRE_CAP)
        let awardedFire = 0;
        const currentLikes = replyRow.likes ?? 0;
        if (currentLikes < LIKE_FIRE_CAP) {
          awardedFire = 1;
          await tx.update(users)
            .set({ fire: sql`${users.fire} + 1` })
            .where(eq(users.id, replyRow.creatorId));
        }

        // Like conversion: spend random(2..3) fire to gain +1 food
        const liker = await tx.query.users.findFirst({ where: eq(users.id, userId) });
        if (liker && liker.fire >= 2) {
          const roll = Math.random() < 0.5 ? 2 : 3;
          const cost = Math.min(roll, liker.fire);
          await tx.update(users)
            .set({
              fire: sql`MAX(${users.fire} - ${cost}, 0)`,
              food: sql`${users.food} + 1`
            })
            .where(eq(users.id, userId));
        }

        await markUserActive(tx, userId);
        return { status: 'liked' as const };
      });

      return outcome;
    })

    // ── Tribes ──

    .get('/tribes', async () => {
      const allTribes = await db.query.tribes.findMany({
        orderBy: [tribes.name]
      });

      // Get member counts
      const countRows = await db.select({
        tribeId: userTribes.tribeId,
        memberCount: sql<number>`COUNT(*)`,
      })
        .from(userTribes)
        .groupBy(userTribes.tribeId);

      const countMap = Object.fromEntries(countRows.map(c => [c.tribeId, c.memberCount]));

      return allTribes.map(t => ({
        ...t,
        memberCount: countMap[t.id] ?? 0,
      }));
    })

    .get('/tribes/:id', async ({ params }) => {
      const tribe = await db.query.tribes.findFirst({
        where: eq(tribes.id, params.id)
      });
      if (!tribe) throw new Error('Tribe not found');

      // Get members
      const memberRows = await db.select({
        id: users.id,
        username: users.username,
        avatar: users.avatar,
        fire: users.fire,
        food: users.food,
      })
        .from(userTribes)
        .innerJoin(users, eq(userTribes.userId, users.id))
        .where(eq(userTribes.tribeId, params.id));

      // Get tribe threads
      const tribeThreads = await db.query.threads.findMany({
        where: eq(threads.tribeId, params.id),
        orderBy: [desc(threads.createdAt)],
        limit: 50
      });

      const enriched = await enrichThreads(tribeThreads);

      return {
        ...tribe,
        members: memberRows,
        memberCount: memberRows.length,
        threads: enriched,
      };
    })

    .post('/tribes', async ({ body, userId }) => {
      if (!userId) throw new Error('No user selected');

      const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
      if (!user) throw new Error('User not found');
      if (user.food < TRIBE_CREATION_COST) throw new Error('Not enough food to create tribe');

      // Auto-generate abbreviation from name if not provided
      const abbr = body.abbreviation
        || body.name.split(/\s+/).map((w: string) => w[0]).join('').toUpperCase().slice(0, 4);

      const tribe = await db.transaction(async (tx) => {
        await tx.update(users)
          .set({ food: sql`${users.food} - ${TRIBE_CREATION_COST}` })
          .where(eq(users.id, userId));

        const [newTribe] = await tx.insert(tribes).values({
          name: body.name,
          abbreviation: abbr,
          description: body.description,
          creatorId: userId,
        }).returning();

        // Auto-join the creator
        await tx.insert(userTribes).values({
          userId,
          tribeId: newTribe.id,
        });

        await markUserActive(tx, userId);
        return newTribe;
      });

      return tribe;
    }, {
      body: t.Object({
        name: t.String(),
        abbreviation: t.Optional(t.String()),
        description: t.Optional(t.String()),
      })
    })

    .post('/tribes/:id/join', async ({ params, userId }) => {
      if (!userId) throw new Error('No user selected');

      const tribe = await db.query.tribes.findFirst({ where: eq(tribes.id, params.id) });
      if (!tribe) throw new Error('Tribe not found');

      await db.insert(userTribes)
        .values({ userId, tribeId: params.id })
        .onConflictDoNothing();

      return { status: 'joined' };
    })

    .post('/tribes/:id/leave', async ({ params, userId }) => {
      if (!userId) throw new Error('No user selected');

      await db.delete(userTribes)
        .where(and(eq(userTribes.userId, userId), eq(userTribes.tribeId, params.id)));

      return { status: 'left' };
    })

    // ── Recovery ──

    .post('/recovery', async ({ userId }) => {
      if (!userId) throw new Error('No user selected');

      const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
      if (!user) throw new Error('User not found');

      if (user.food > 0 || user.fire > 0) {
        throw new Error('Not eligible for recovery');
      }

      const reward = Math.random() < 0.5 ? 2 : 3;
      await db.transaction(async (tx) => {
        await tx.update(users)
          .set({ food: sql`${users.food} + ${reward}` })
          .where(eq(users.id, userId));
        await markUserActive(tx, userId);
      });

      return { reward };
    })
  )

  .listen(Number(process.env.API_PORT || 3001));

export type App = typeof app;
console.log(`🦊 Cavenet API running at ${app.server?.hostname}:${app.server?.port}`);
