import { Elysia, t } from 'elysia';
import { db } from './db';
import { users, posts, replies, likes, threadFire, rewardEvents } from './db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';

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
    return { userId: user.id };
  })

  .group('/api', (app) => app
    // POST /api/posts (requires food)
    .post('/posts', async ({ body, userId }) => {
      const costMap: Record<string, number> = {
        mixed: 1, text: 2, image: 2, recovery: 0
      };
      const cost = costMap[body.type] ?? 2;

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

      return post;
    }, {
      body: t.Object({
        type: t.String(),
        content: t.String(),
        imageUrl: t.Optional(t.String())
      })
    })

    // POST /api/posts/:id/replies
    .post('/posts/:id/replies', async ({ params, body, userId }) => {
      const postId = params.id;

      // Get current thread size
      const existingReplies = await db.query.replies.findMany({
        where: eq(replies.postId, postId)
      });
      const replyIndex = existingReplies.length + 1;

      // Insert reply
      const [reply] = await db.insert(replies).values({
        postId,
        userId,
        content: body.content,
        replyIndex,
        isUnique: true // Dummy implementation for MVP
      }).returning();

      // Idempotent reward calc
      const alreadyRewarded = await db.query.rewardEvents.findFirst({
        where: and(eq(rewardEvents.type, 'reply'), eq(rewardEvents.refId, reply.id))
      });

      if (!alreadyRewarded) {
        const baseReward = Math.max(3 - (replyIndex - 1), 1);
        
        const currentFireRow = await db.query.threadFire.findFirst({
          where: and(eq(threadFire.userId, userId), eq(threadFire.postId, postId))
        });
        const currentFire = currentFireRow?.fireAccumulated ?? 0;
        
        const allowed = Math.max(0, 20 - currentFire);
        const reward = Math.min(baseReward, allowed);

        if (reward > 0) {
          await db.transaction(async (tx) => {
            await tx.update(users)
              .set({ fire: sql`${users.fire} + ${reward}` })
              .where(eq(users.id, userId));

            await tx.insert(threadFire).values({
               userId, postId, fireAccumulated: reward
            })
            .onConflictDoUpdate({
               target: [threadFire.userId, threadFire.postId],
               set: { fireAccumulated: sql`${threadFire.fireAccumulated} + ${reward}` }
            });

            await tx.insert(rewardEvents).values({
              type: 'reply',
              refId: reply.id
            });
          });
        }
      }

      return reply;
    }, {
      body: t.Object({
        content: t.String()
      })
    })

    // POST /api/posts/:id/like
    .post('/posts/:id/like', async ({ params, userId }) => {
      const postId = params.id;
      
      // Check if already liked
      const existingLike = await db.query.likes.findFirst({
        where: and(eq(likes.userId, userId), eq(likes.postId, postId))
      });

      if (existingLike) {
        return { status: 'already_liked' };
      }

      await db.transaction(async (tx) => {
        await tx.insert(likes).values({ userId, postId }).onConflictDoNothing();

        // Give post owner fire (capped at 5)
        const postRow = await tx.query.posts.findFirst({ where: eq(posts.id, postId) });
        if (postRow && postRow.fireGenerated < 5) {
           await tx.update(posts)
             .set({ fireGenerated: sql`${posts.fireGenerated} + 1` })
             .where(eq(posts.id, postId));
           
           await tx.update(users)
             .set({ fire: sql`${users.fire} + 1` })
             .where(eq(users.id, postRow.userId));
        }

        // Roll conversion for liker (spend fire to get food)
        const roll = Math.random() < 0.5 ? 2 : 3;
        await tx.update(users)
          .set({
             fire: sql`MAX(${users.fire} - ${roll}, 0)`,
             food: sql`${users.food} + 1`
          })
          .where(eq(users.id, userId));
      });

      return { status: 'liked' };
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
      await db.update(users)
        .set({ food: sql`${users.food} + ${reward}` })
        .where(eq(users.id, userId));

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
