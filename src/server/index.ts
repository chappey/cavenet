import { Elysia, t } from 'elysia';
import { db } from './db';
import { users, threads, replies, likes, tribes, userThreadStats, userActivity, rewardEvents } from './db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { createHash } from 'node:crypto';

const POST_COST = {
  mixed: 1,
  text: 2,
  image: 2,
} as const;

const THREAD_FIRE_CAP = 20;
const LIKE_FIRE_CAP = 5;
const FIRE_DECAY_PER_DAY = 1;

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
  const inactiveDays = daysBetweenUtc(new Date(lastActive), now);

  if (inactiveDays <= 0) return;

  const decay = inactiveDays * FIRE_DECAY_PER_DAY;
  await tx.update(users)
    .set({
      fire: sql`MAX(${users.fire} - ${decay}, 0)`
    })
    .where(eq(users.id, userId));
};

const app = new Elysia()
  // Mock Auth Middleware: Automatically fetch/create a dummy user for the MVP
  .derive(async () => {
    let user = await db.query.users.findFirst();
    if (!user) {
      const [newUser] = await db.insert(users).values({
        username: 'Caveman_' + Math.floor(Math.random() * 1000)
      }).returning();
      user = newUser;
    }

    await db.transaction(async (tx) => {
      await applyDailyDecayIfNeeded(tx, user.id);
    });

    return { userId: user.id };
  })

  .group('/api', (app) => app
    // POST /api/threads (requires food)
    .post('/threads', async ({ body, userId }) => {
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

    // POST /api/threads/:id/replies
    .post('/threads/:id/replies', async ({ params, body, userId }) => {
      const threadId = params.id;
      const hash = contentHash(body.content);

      const result = await db.transaction(async (tx) => {
        const thread = await tx.query.threads.findFirst({ where: eq(threads.id, threadId) });
        if (!thread) throw new Error('Thread not found');

        // Compute next index inside transaction for stable ordering under concurrent writes.
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

    // POST /api/replies/:id/like
    .post('/replies/:id/like', async ({ params, userId }) => {
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

        const threadRow = await tx.query.threads.findFirst({ where: eq(threads.id, replyRow.threadId) });
        if (!threadRow) throw new Error('Thread not found');

        // Award fire to reply creator (capped per-reply)
        let awardedFire = 0;
        const likeCount = await tx.select({ count: sql<number>`COUNT(*)` })
          .from(likes)
          .where(eq(likes.replyId, replyId));

        if ((likeCount[0]?.count ?? 0) < LIKE_FIRE_CAP) {
          awardedFire = 1;
          await tx.update(users)
            .set({ fire: sql`${users.fire} + 1` })
            .where(eq(users.id, replyRow.creatorId));
        }

        // Like conversion: spend random(2..3) fire to gain +1 food.
        const roll = Math.random() < 0.5 ? 2 : 3;
        await tx.update(users)
          .set({
            fire: sql`MAX(${users.fire} - ${roll}, 0)`,
            food: sql`${users.food} + 1`
          })
          .where(eq(users.id, userId));

        await markUserActive(tx, userId);
        return { status: 'liked' as const };
      });

      return outcome;
    })

    .get('/feed', async () => {
      return await db.query.threads.findMany({
        orderBy: [desc(threads.createdAt)],
        limit: 50
      });
    })

    // GET /api/threads/:id (with replies)
    .get('/threads/:id', async ({ params }) => {
      const thread = await db.query.threads.findFirst({
        where: eq(threads.id, params.id)
      });
      if (!thread) throw new Error('Thread not found');

      const threadReplies = await db.query.replies.findMany({
        where: eq(replies.threadId, params.id),
        orderBy: [replies.replyIndex]
      });

      return { ...thread, replies: threadReplies };
    })

    // GET /api/users/:id
    .get('/users/:id', async ({ params }) => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, params.id)
      });
      if (!user) throw new Error('User not found');

      const userThreads = await db.query.threads.findMany({
        where: eq(threads.creatorId, params.id),
        orderBy: [desc(threads.createdAt)]
      });

      return { ...user, threads: userThreads };
    })

    // POST /api/recovery
    .post('/recovery', async ({ userId }) => {
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

    // GET /api/me
    .get('/me', async ({ userId }) => {
       const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
       return user;
    })
  )

  .listen(Number(process.env.API_PORT || 3001));

export type App = typeof app;
console.log(`🦊 Cavenet API running at ${app.server?.hostname}:${app.server?.port}`);
