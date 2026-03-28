import { Elysia, t } from 'elysia';
import { db } from './db';
import { users, posts, replies, likes, threadFire, rewardEvents } from './db/schema';
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

const getThreadAllowance = async (tx: typeof db, userId: string, postId: string) => {
  const row = await tx.query.threadFire.findFirst({
    where: and(eq(threadFire.userId, userId), eq(threadFire.postId, postId))
  });
  const current = row?.fireAccumulated ?? 0;
  return Math.max(0, THREAD_FIRE_CAP - current);
};

const grantThreadFire = async (tx: typeof db, userId: string, postId: string, requested: number) => {
  const allowance = await getThreadAllowance(tx, userId, postId);
  const granted = Math.max(0, Math.min(requested, allowance));

  if (granted <= 0) return 0;

  await tx.update(users)
    .set({ fire: sql`${users.fire} + ${granted}` })
    .where(eq(users.id, userId));

  await tx.insert(threadFire)
    .values({ userId, postId, fireAccumulated: granted })
    .onConflictDoUpdate({
      target: [threadFire.userId, threadFire.postId],
      set: { fireAccumulated: sql`${threadFire.fireAccumulated} + ${granted}` }
    });

  return granted;
};

const markUserActive = async (tx: typeof db, userId: string) => {
  await tx.update(users)
    .set({ lastActiveAt: new Date() })
    .where(eq(users.id, userId));
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
    // POST /api/posts (requires food)
    .post('/posts', async ({ body, userId }) => {
      const cost = POST_COST[body.type as keyof typeof POST_COST] ?? POST_COST.text;

      const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
      if (!user) throw new Error('User not found');
      if (user.food < cost) throw new Error('Not enough food');

      const [post] = await db.transaction(async (tx) => {
        await tx.update(users)
          .set({ food: sql`${users.food} - ${cost}` })
          .where(eq(users.id, userId));

        return await tx.insert(posts).values({
          userId,
          type: body.type as any,
          content: body.content,
          imageUrl: body.imageUrl,
        }).returning();
      });

      await db.transaction(async (tx) => {
        await markUserActive(tx, userId);
      });

      return post;
    }, {
      body: t.Object({
        type: t.Union([t.Literal('text'), t.Literal('image'), t.Literal('mixed')]),
        content: t.String(),
        imageUrl: t.Optional(t.String())
      })
    })

    // POST /api/posts/:id/replies
    .post('/posts/:id/replies', async ({ params, body, userId }) => {
      const postId = params.id;
      const hash = contentHash(body.content);

      const result = await db.transaction(async (tx) => {
        const post = await tx.query.posts.findFirst({ where: eq(posts.id, postId) });
        if (!post) throw new Error('Post not found');

        // Compute next index inside transaction for stable ordering under concurrent writes.
        const indexRows = await tx.select({
          nextIndex: sql<number>`COALESCE(MAX(${replies.replyIndex}), 0) + 1`
        })
          .from(replies)
          .where(eq(replies.postId, postId));
        const replyIndex = indexRows[0]?.nextIndex ?? 1;

        const duplicateHashReply = await tx.query.replies.findFirst({
          where: and(eq(replies.postId, postId), eq(replies.contentHash, hash))
        });
        const isUnique = !duplicateHashReply;

        const [reply] = await tx.insert(replies).values({
          postId,
          userId,
          content: body.content,
          contentHash: hash,
          replyIndex,
          isUnique,
          fireAwarded: 0,
        }).returning();

        let fireAwardedToReplier = 0;
        let fireAwardedToOwner = 0;

        const isOwnerReply = post.userId === userId;
        if (isOwnerReply) {
          const ownerEvent = await tx.insert(rewardEvents)
            .values({ type: 'reply_op', refId: reply.id })
            .onConflictDoNothing()
            .returning();

          if (ownerEvent.length > 0) {
            fireAwardedToReplier = await grantThreadFire(tx, userId, postId, 1);
          }
        } else {
          const replierCountRows = await tx.select({
            count: sql<number>`COUNT(*)`
          })
            .from(replies)
            .where(and(eq(replies.postId, postId), eq(replies.userId, userId)));
          const replierCount = replierCountRows[0]?.count ?? 1;
          const baseReward = Math.max(3 - (replierCount - 1), 1);

          const replierEvent = await tx.insert(rewardEvents)
            .values({ type: 'reply_replier', refId: reply.id })
            .onConflictDoNothing()
            .returning();

          if (replierEvent.length > 0) {
            fireAwardedToReplier = await grantThreadFire(tx, userId, postId, baseReward);
          }

          if (isUnique) {
            const ownerEvent = await tx.insert(rewardEvents)
              .values({ type: 'reply_owner', refId: reply.id })
              .onConflictDoNothing()
              .returning();

            if (ownerEvent.length > 0) {
              fireAwardedToOwner = await grantThreadFire(tx, post.userId, postId, 2);
            }
          }
        }

        await tx.update(replies)
          .set({ fireAwarded: fireAwardedToReplier })
          .where(eq(replies.id, reply.id));

        await markUserActive(tx, userId);

        return {
          ...reply,
          fireAwarded: fireAwardedToReplier,
          ownerFireAwarded: fireAwardedToOwner,
        };
      });

      return result;
    }, {
      body: t.Object({
        content: t.String()
      })
    })

    // POST /api/posts/:id/like
    .post('/posts/:id/like', async ({ params, userId }) => {
      const postId = params.id;

      const outcome = await db.transaction(async (tx) => {
        const inserted = await tx.insert(likes)
          .values({ userId, postId })
          .onConflictDoNothing()
          .returning();

        if (inserted.length === 0) {
          return { status: 'already_liked' as const };
        }

        const postRow = await tx.query.posts.findFirst({ where: eq(posts.id, postId) });
        if (!postRow) throw new Error('Post not found');

        if (postRow.fireGenerated < LIKE_FIRE_CAP) {
          await tx.update(posts)
            .set({ fireGenerated: sql`${posts.fireGenerated} + 1` })
            .where(eq(posts.id, postId));

          await tx.update(users)
            .set({ fire: sql`${users.fire} + 1` })
            .where(eq(users.id, postRow.userId));
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
      return await db.query.posts.findMany({
        orderBy: [desc(posts.createdAt)],
        limit: 50
      });
    })

    // GET /api/posts/:id (with replies)
    .get('/posts/:id', async ({ params }) => {
      const post = await db.query.posts.findFirst({
        where: eq(posts.id, params.id)
      });
      if (!post) throw new Error('Post not found');

      const postReplies = await db.query.replies.findMany({
        where: eq(replies.postId, params.id),
        orderBy: [replies.replyIndex]
      });

      return { ...post, replies: postReplies };
    })

    // GET /api/users/:id
    .get('/users/:id', async ({ params }) => {
      const user = await db.query.users.findFirst({
        where: eq(users.id, params.id)
      });
      if (!user) throw new Error('User not found');

      const userPosts = await db.query.posts.findMany({
        where: eq(posts.userId, params.id),
        orderBy: [desc(posts.createdAt)]
      });

      return { ...user, posts: userPosts };
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
