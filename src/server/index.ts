import { Elysia, t } from 'elysia';
import { db } from './db';
import { users, threads, replies, likes, tribes, userTribes, userThreadStats, userActivity, rewardEvents } from './db/schema';
import { eq, desc, sql, and, inArray } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { simulatedDaysBetween, TIME_SCALE } from './time';
import { generateCharacterDraft, generateThreadDraft, generateThreadReplies, isGoogleGenAIConfigured, pickReplyMood } from './ai';

// ── Constants ──

const POST_COST = {
  mixed: 1,
  text: 2,
  image: 2,
} as const;

const TRIBE_CREATION_COST = 3;
const THREAD_FIRE_CAP = 20;
const FIRE_DECAY_PER_DAY = 1;

// ── Helpers ──

const toUtcDayStart = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const daysBetweenUtc = (older: Date, newer: Date) => {
  const ms = toUtcDayStart(newer) - toUtcDayStart(older);
  return Math.max(0, Math.floor(ms / 86_400_000));
};

const normalizeReply = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const contentHash = (value: string) => createHash('sha256').update(normalizeReply(value)).digest('hex');

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const toDayKey = (value: Date | string | number) => new Date(value).toISOString().slice(0, 10);

const formatDayLabel = (dayKey: string) => {
  const date = new Date(`${dayKey}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
};

const scoreThreadQuality = (title: string | null | undefined, content: string) => {
  const text = `${title ?? ''} ${content}`.trim();
  if (!text) return 0;

  const words = text.split(/\s+/).filter(Boolean);
  const uniqueWords = new Set(words.map(word => word.toLowerCase().replace(/[^a-z0-9']/g, '')));
  const sentences = content.split(/[.!?]+/).filter(sentence => sentence.trim()).length;
  const hasQuestion = /\?/.test(content);
  const hasExclaim = /!/.test(content);
  const hasSpecificDetail = /\b(shiny|berry|fire|mammoth|spear|hunt|rock|paint|cave|moon|blood|bone)\b/i.test(text);
  const hasTitle = Boolean(title?.trim());

  let score = 0;
  score += clamp(Math.round(words.length * 1.2), 0, 30);
  score += clamp(Math.round(uniqueWords.size * 1.1), 0, 18);
  score += hasTitle ? 6 : 0;
  score += hasQuestion ? 8 : 0;
  score += hasExclaim ? 6 : 0;
  score += sentences >= 2 ? 10 : 0;
  score += hasSpecificDetail ? 8 : 0;
  score += content.length >= 80 ? 6 : 0;
  score += content.length >= 140 ? 6 : 0;
  score += content.length < 20 ? -30 : 0;
  score += content.length < 8 ? -20 : 0;

  return clamp(score, 0, 100);
};

const getReplyTargetFromQuality = (qualityScore: number, availableNpcCount: number) => {
  if (qualityScore < 25) return 0;
  const tierTarget = qualityScore < 45 ? 1 : qualityScore < 60 ? 2 : qualityScore < 75 ? 3 : qualityScore < 90 ? 4 : 5;
  return Math.min(availableNpcCount, tierTarget, 5);
};

const getReplyFireReward = (qualityScore: number, isOwnerReply: boolean) => {
  if (qualityScore < 25) return 0;
  if (qualityScore < 45) return isOwnerReply ? 1 : 1;
  if (qualityScore < 70) return isOwnerReply ? 2 : 2;
  if (qualityScore < 85) return isOwnerReply ? 3 : 3;
  return isOwnerReply ? 4 : 4;
};

const getLikeFireCap = (qualityScore: number, availableUsers: number) => {
  if (qualityScore < 25) return 0;
  const cap = qualityScore < 45 ? 1 : qualityScore < 70 ? 3 : qualityScore < 85 ? 5 : 7;
  return Math.min(cap, Math.max(0, availableUsers - 1));
};

const getOrganicLikeBudget = (qualityScore: number, availableNpcCount: number) => {
  if (qualityScore < 25) return 0;
  const base = qualityScore < 45 ? 1 : qualityScore < 70 ? 2 : qualityScore < 85 ? 4 : 6;
  return Math.min(base, Math.max(0, availableNpcCount));
};

type EngagementStatus = 'idle' | 'queued' | 'active' | 'complete' | 'inactive';

type EngagementSnapshot = {
  status: EngagementStatus;
  plannedReplies: number;
  completedReplies: number;
  plannedLikes: number;
  completedLikes: number;
  updatedAt: number;
};

const makeInactiveEngagementSnapshot = (): EngagementSnapshot => ({
  status: 'inactive',
  plannedReplies: 0,
  completedReplies: 0,
  plannedLikes: 0,
  completedLikes: 0,
  updatedAt: Date.now(),
});

const threadEngagementState = new Map<string, EngagementSnapshot>();

const threadTimers = new Map<string, Set<ReturnType<typeof setTimeout>>>();

const getThreadEngagementSnapshot = (threadId: string) => threadEngagementState.get(threadId) ?? makeInactiveEngagementSnapshot();

const setThreadEngagementSnapshot = (threadId: string, patch: Partial<EngagementSnapshot>) => {
  const next = {
    ...getThreadEngagementSnapshot(threadId),
    ...patch,
    updatedAt: Date.now(),
  } satisfies EngagementSnapshot;
  threadEngagementState.set(threadId, next);
  return next;
};

const trackThreadTimer = (threadId: string, delay: number, task: () => Promise<void>) => {
  const timer = setTimeout(() => {
    const timerSet = threadTimers.get(threadId);
    timerSet?.delete(timer);
    void task();
  }, delay);

  const timerSet = threadTimers.get(threadId) ?? new Set<ReturnType<typeof setTimeout>>();
  timerSet.add(timer);
  threadTimers.set(threadId, timerSet);
};

const maybeFinalizeThreadEngagement = (threadId: string) => {
  const snapshot = getThreadEngagementSnapshot(threadId);
  const doneReplies = snapshot.completedReplies >= snapshot.plannedReplies;
  const doneLikes = snapshot.completedLikes >= snapshot.plannedLikes;

  if (snapshot.plannedReplies === 0 && snapshot.plannedLikes === 0) {
    setThreadEngagementSnapshot(threadId, { status: 'inactive' });
    return;
  }

  if (doneReplies && doneLikes) {
    setThreadEngagementSnapshot(threadId, { status: 'complete' });
  }
};

const buildFallbackReplies = (
  thread: typeof threads.$inferSelect,
  profiles: Array<{ username: string; bio: string }>,
  qualityScore: number,
) => {
  const replyTarget = getReplyTargetFromQuality(qualityScore, profiles.length);
  if (replyTarget <= 0) return [] as Array<{ username: string; content: string }>;

  const openers = [
    'OOG this hit hard.',
    'Fire brain like this.',
    'Cave people agree.',
    'Rock solid post.',
    'Much noise. Much good.',
  ];
  const reactions = [
    'Me want more of this.',
    'Big spear energy.',
    'This make cave warm.',
    'Strong think, good think.',
    'Mammoth-sized yes.',
  ];

  return profiles.slice(0, replyTarget).map((profile, index) => ({
    username: profile.username,
    content: `${openers[index % openers.length]} ${reactions[index % reactions.length]}${thread.title ? ` About ${thread.title.toLowerCase()}.` : '.'}`,
  }));
};

const applyAutomatedLike = async (
  tx: typeof db,
  { replyId, userId, awardLikerBonus }: { replyId: string; userId: string; awardLikerBonus: boolean }
) => {
  const inserted = await tx.insert(likes)
    .values({ userId, replyId, fireGenerated: 0 })
    .onConflictDoNothing()
    .returning();

  if (inserted.length === 0) {
    return { status: 'already_liked' as const, awardedFire: 0 };
  }

  const replyRow = await tx.query.replies.findFirst({ where: eq(replies.id, replyId) });
  if (!replyRow) throw new Error('Reply not found');
  const threadRow = await tx.query.threads.findFirst({ where: eq(threads.id, replyRow.threadId) });
  const qualityScore = scoreThreadQuality(threadRow?.title ?? null, threadRow?.content ?? '');
  const userCountRows = await tx.select({ count: sql<number>`COUNT(*)` }).from(users);
  const userCount = userCountRows[0]?.count ?? 0;

  await tx.update(replies)
    .set({ likes: sql`${replies.likes} + 1` })
    .where(eq(replies.id, replyId));

  let awardedFire = 0;
  const currentLikes = replyRow.likes ?? 0;
  const likeFireCap = getLikeFireCap(qualityScore, userCount);
  if (currentLikes < likeFireCap) {
    awardedFire = 1;
    await tx.update(users)
      .set({ fire: sql`${users.fire} + 1` })
      .where(eq(users.id, replyRow.creatorId));
  }

  if (awardLikerBonus) {
    const liker = await tx.query.users.findFirst({ where: eq(users.id, userId) });
    if (liker && liker.fire > 0) {
      const roll = Math.random() < 0.5 ? 2 : 3;
      const cost = Math.min(roll, liker.fire);
      await tx.update(users)
        .set({
          fire: sql`MAX(${users.fire} - ${cost}, 0)`,
          food: sql`${users.food} + 1`,
        })
        .where(eq(users.id, userId));
    }
  }

  return { status: 'liked' as const, awardedFire };
};

const queueThreadEngagement = async (thread: typeof threads.$inferSelect, creatorUsername: string, qualityScore: number) => {
  const npcProfiles = (await db.select({
    id: users.id,
    username: users.username,
    bio: users.bio,
    isPlayerCharacter: users.isPlayerCharacter,
  })
    .from(users)
    .orderBy(users.username))
    .filter((user) => user.id !== thread.creatorId && !user.isPlayerCharacter)
    .slice(0, 5)
    .map((user) => ({ id: user.id, username: user.username, bio: user.bio ?? '' }));

  const plannedReplies = getReplyTargetFromQuality(qualityScore, npcProfiles.length);
  const plannedLikes = getOrganicLikeBudget(qualityScore, npcProfiles.length * 2);

  if (plannedReplies <= 0 && plannedLikes <= 0) {
    setThreadEngagementSnapshot(thread.id, { status: 'inactive' });
    return;
  }

  setThreadEngagementSnapshot(thread.id, {
    status: 'queued',
    plannedReplies,
    completedReplies: 0,
    plannedLikes,
    completedLikes: 0,
  });

  const queuedReplies = await (async () => {
    try {
      const batch = await generateThreadAiReplies(thread, creatorUsername, qualityScore);
      if (batch?.generatedReplies?.length) {
        return { replies: batch.generatedReplies, profiles: batch.profiles ?? npcProfiles };
      }
    } catch (error) {
      console.error('[ai-thread-replies] generation failed, using fallback:', error);
    }

    return { replies: buildFallbackReplies(thread, npcProfiles, qualityScore), profiles: npcProfiles };
  })();

  const repliesToSchedule = queuedReplies.replies.slice(0, plannedReplies);
  if (repliesToSchedule.length === 0) {
    setThreadEngagementSnapshot(thread.id, { status: 'inactive' });
    return;
  }

  let pendingLikeBudget = plannedLikes;

  repliesToSchedule.forEach((aiReply, index) => {
    const replyDelay = 900 + (index * 1400) + Math.floor(Math.random() * 1300);
    trackThreadTimer(thread.id, replyDelay, async () => {
      setThreadEngagementSnapshot(thread.id, { status: 'active' });

      try {
        await db.transaction(async (tx) => {
          const profile = await tx.query.users.findFirst({ where: eq(users.username, aiReply.username) });
          if (!profile) return;

          const reply = await insertThreadReply(tx, {
            threadId: thread.id,
            creatorId: profile.id,
            content: aiReply.content,
            isUniqueOverride: true,
          });

          const rewards = await applyReplyRewards(tx, {
            reply,
            thread: { id: thread.id, creatorId: thread.creatorId },
            qualityScore,
          });

          await tx.update(replies)
            .set({ fireGenerated: rewards.fireAwardedToReplier })
            .where(eq(replies.id, reply.id));

          const likesForThisReply = Math.max(0, Math.min(pendingLikeBudget, Math.random() < 0.35 ? 2 : Math.random() < 0.7 ? 1 : 0));
          pendingLikeBudget -= likesForThisReply;

          const likers = pickLikeLikers(queuedReplies.profiles, likesForThisReply, [profile.username]);
          likers.forEach((liker, likeIndex) => {
            const likeDelay = 2500 + (likeIndex * 1100) + Math.floor(Math.random() * 2000);
            trackThreadTimer(thread.id, likeDelay, async () => {
              await db.transaction(async (likeTx) => {
                await applyAutomatedLike(likeTx, {
                  replyId: reply.id,
                  userId: liker.id,
                  awardLikerBonus: false,
                });
              });

              const snapshot = getThreadEngagementSnapshot(thread.id);
              setThreadEngagementSnapshot(thread.id, { completedLikes: snapshot.completedLikes + 1, status: 'active' });
              maybeFinalizeThreadEngagement(thread.id);
            });
          });
        });

        const snapshot = getThreadEngagementSnapshot(thread.id);
        setThreadEngagementSnapshot(thread.id, { completedReplies: snapshot.completedReplies + 1, status: 'active' });
        maybeFinalizeThreadEngagement(thread.id);
      } catch (error) {
        console.error('[thread-engagement] reply job failed:', error);
      }
    });
  });
};

const pickLikeLikers = (profiles: Array<{ id: string; username: string }>, likeCount: number, skipUsernames: string[] = []) => {
  if (likeCount <= 0 || profiles.length === 0) return [] as Array<{ id: string; username: string }>;

  const pool = shuffle(profiles.filter(profile => !skipUsernames.includes(profile.username)));
  return pool.slice(0, Math.min(likeCount, pool.length));
};

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const insertThreadReply = async (tx: typeof db, {
  threadId,
  creatorId,
  content,
  isUniqueOverride,
}: {
  threadId: string;
  creatorId: string;
  content: string;
  isUniqueOverride?: boolean;
}) => {
  const hash = contentHash(content);
  const indexRows = await tx.select({
    nextIndex: sql<number>`COALESCE(MAX(${replies.replyIndex}), 0) + 1`
  })
    .from(replies)
    .where(eq(replies.threadId, threadId));
  const replyIndex = indexRows[0]?.nextIndex ?? 1;

  const duplicateHashReply = await tx.query.replies.findFirst({
    where: and(eq(replies.threadId, threadId), eq(replies.contentHash, hash))
  });
  const isUnique = isUniqueOverride ?? !duplicateHashReply;

  const [reply] = await tx.insert(replies).values({
    threadId,
    creatorId,
    content,
    contentHash: hash,
    replyIndex,
    isUnique,
    fireGenerated: 0,
  }).returning();

  return reply;
};

const applyReplyRewards = async (
  tx: typeof db,
  { reply, thread, qualityScore }: {
    reply: { id: string; creatorId: string; isUnique: boolean };
    thread: { id: string; creatorId: string };
    qualityScore: number;
  }
) => {
  let fireAwardedToOwner = 0;
  let fireAwardedToReplier = 0;

  const isOwnerReply = thread.creatorId === reply.creatorId;
  if (isOwnerReply) {
    const ownerEvent = await tx.insert(rewardEvents)
      .values({ type: 'reply_op', refId: reply.id })
      .onConflictDoNothing()
      .returning();

    if (ownerEvent.length > 0) {
			fireAwardedToReplier = await grantThreadFire(tx, reply.creatorId, thread.id, getReplyFireReward(qualityScore, true));
    }
  } else {
    const replierEvent = await tx.insert(rewardEvents)
      .values({ type: 'reply_replier', refId: reply.id })
      .onConflictDoNothing()
      .returning();

    if (replierEvent.length > 0) {
			fireAwardedToReplier = await grantThreadFire(tx, reply.creatorId, thread.id, getReplyFireReward(qualityScore, false));
    }

    if (reply.isUnique) {
      const ownerEvent = await tx.insert(rewardEvents)
        .values({ type: 'reply_owner', refId: reply.id })
        .onConflictDoNothing()
        .returning();

      if (ownerEvent.length > 0) {
				fireAwardedToOwner = await grantThreadFire(tx, thread.creatorId, thread.id, getReplyFireReward(qualityScore, true));
      }
    }
  }

  return { fireAwardedToOwner, fireAwardedToReplier };
};

const generateThreadAiReplies = async (thread: typeof threads.$inferSelect, creatorUsername: string, qualityScore: number) => {
  if (!isGoogleGenAIConfigured()) return null;

  const npcProfiles = (await db.select({
    id: users.id,
    username: users.username,
    bio: users.bio,
    isPlayerCharacter: users.isPlayerCharacter,
  })
    .from(users)
    .orderBy(users.username))
    .filter((user) => user.id !== thread.creatorId && !user.isPlayerCharacter)
    .slice(0, 5)
    .map((user) => ({ id: user.id, username: user.username, bio: user.bio ?? '' }));

  const replyTarget = getReplyTargetFromQuality(qualityScore, npcProfiles.length);
  if (replyTarget <= 0) return null;

  const aiProfiles = shuffle(npcProfiles).slice(0, replyTarget);

	const mood = pickReplyMood(qualityScore);

  const generatedReplies = await generateThreadReplies({
    threadTitle: thread.title,
    threadContent: thread.content,
    threadType: thread.type,
    creatorUsername,
    profiles: aiProfiles.map(({ username, bio }) => ({ username, bio })),
		mood,
		qualityScore,
  });

  return { generatedReplies, mood, qualityScore, profiles: aiProfiles };
};

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
    engagement: getThreadEngagementSnapshot(t.id),
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
        isPlayerCharacter: users.isPlayerCharacter,
        food: users.food,
        fire: users.fire,
        createdAt: users.createdAt,
      }).from(users).orderBy(users.username);
    })

    .post('/users', async ({ body }) => {
      const username = body.username.trim();
      if (!username) throw new Error('Character name is required');

      const [created] = await db.insert(users).values({
        username,
        bio: body.bio ?? '',
        avatar: body.avatar ?? '',
        isPlayerCharacter: true,
      }).returning();

      return created;
    }, {
      body: t.Object({
        username: t.String(),
        bio: t.Optional(t.String()),
        avatar: t.Optional(t.String()),
      })
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

    .delete('/users/:id', async ({ params }) => {
      const target = await db.query.users.findFirst({ where: eq(users.id, params.id) });
      if (!target) throw new Error('Character not found');
      if (!target.isPlayerCharacter) throw new Error('Only player-created characters can be removed');

      await db.delete(users).where(eq(users.id, params.id));
      return { status: 'deleted' as const };
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

    .get('/stats', async () => {
      const [userRows, tribeRows, threadRows, replyRows, likeRows] = await Promise.all([
        db.select({
          id: users.id,
          username: users.username,
          fire: users.fire,
          food: users.food,
          isPlayerCharacter: users.isPlayerCharacter,
        }).from(users),
        db.select({ id: tribes.id }).from(tribes),
        db.select({
          id: threads.id,
          creatorId: threads.creatorId,
          createdAt: threads.createdAt,
        }).from(threads),
        db.select({
          id: replies.id,
          creatorId: replies.creatorId,
          likes: replies.likes,
          createdAt: replies.createdAt,
        }).from(replies),
        db.select({
          id: likes.id,
          createdAt: likes.createdAt,
        }).from(likes),
      ]);

      const summary = {
        fire: userRows.reduce((total, user) => total + (user.fire ?? 0), 0),
        food: userRows.reduce((total, user) => total + (user.food ?? 0), 0),
        users: userRows.length,
        playerCharacters: userRows.filter(user => user.isPlayerCharacter).length,
        npcCharacters: userRows.filter(user => !user.isPlayerCharacter).length,
        posts: threadRows.length,
        replies: replyRows.length,
        likes: likeRows.length,
        tribes: tribeRows.length,
      };

      const activityBreakdown = [
        { metric: 'Fire', value: summary.fire },
        { metric: 'Food', value: summary.food },
        { metric: 'Users', value: summary.users },
        { metric: 'Player characters', value: summary.playerCharacters },
        { metric: 'NPC characters', value: summary.npcCharacters },
        { metric: 'Posts', value: summary.posts },
        { metric: 'Replies', value: summary.replies },
        { metric: 'Likes', value: summary.likes },
        { metric: 'Tribes', value: summary.tribes },
      ];

      const today = new Date();
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 6));
      const dayKeys = Array.from({ length: 7 }, (_, index) => toDayKey(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + index)));
      const timelineBase = Object.fromEntries(dayKeys.map(day => [day, { day: formatDayLabel(day), posts: 0, replies: 0, likes: 0 }]));

      for (const thread of threadRows) {
        const day = toDayKey(thread.createdAt);
        if (timelineBase[day]) timelineBase[day].posts += 1;
      }

      for (const reply of replyRows) {
        const day = toDayKey(reply.createdAt);
        if (timelineBase[day]) timelineBase[day].replies += 1;
      }

      for (const like of likeRows) {
        const day = toDayKey(like.createdAt);
        if (timelineBase[day]) timelineBase[day].likes += 1;
      }

      const activityTimeline = dayKeys.map(day => timelineBase[day]);

      const topUsers = [...userRows]
        .sort((a, b) => {
          if (b.fire !== a.fire) return b.fire - a.fire;
          const aPosts = threadRows.filter(thread => thread.creatorId === a.id).length;
          const bPosts = threadRows.filter(thread => thread.creatorId === b.id).length;
          if (bPosts !== aPosts) return bPosts - aPosts;
          const aReplies = replyRows.filter(reply => reply.creatorId === a.id).length;
          const bReplies = replyRows.filter(reply => reply.creatorId === b.id).length;
          if (bReplies !== aReplies) return bReplies - aReplies;
          return a.username.localeCompare(b.username);
        })
        .slice(0, 10)
        .map((user) => ({
          id: user.id,
          username: user.username,
          isPlayerCharacter: user.isPlayerCharacter,
          fire: user.fire,
          food: user.food,
          posts: threadRows.filter(thread => thread.creatorId === user.id).length,
          replies: replyRows.filter(reply => reply.creatorId === user.id).length,
          likesReceived: replyRows.filter(reply => reply.creatorId === user.id).reduce((total, reply) => total + (reply.likes ?? 0), 0),
        }));

      return {
        summary,
        activityBreakdown,
        activityTimeline,
        topUsers,
      };
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

      const creator = await db.query.users.findFirst({ where: eq(users.id, userId) });
      const creatorUsername = creator?.username ?? 'Unknown';
      const qualityScore = scoreThreadQuality(thread.title ?? null, thread.content ?? '');
      void queueThreadEngagement(thread, creatorUsername, qualityScore);

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
        engagement: getThreadEngagementSnapshot(thread.id),
      };
    })

    // ── Replies ──

    .post('/threads/:id/replies', async ({ params, body, userId }) => {
      if (!userId) throw new Error('No user selected');
      const threadId = params.id;

      const result = await db.transaction(async (tx) => {
        const thread = await tx.query.threads.findFirst({ where: eq(threads.id, threadId) });
        if (!thread) throw new Error('Thread not found');

		const reply = await insertThreadReply(tx, {
			threadId,
			creatorId: userId,
			content: body.content,
		});
		const qualityScore = scoreThreadQuality(thread.title ?? null, thread.content ?? '');

        const rewards = await applyReplyRewards(tx, {
          reply,
          thread: { id: thread.id, creatorId: thread.creatorId },
          qualityScore,
        });

        await tx.update(replies)
          .set({ fireGenerated: rewards.fireAwardedToReplier })
          .where(eq(replies.id, reply.id));

        await markUserActive(tx, userId);

        return {
          ...reply,
          fireGenerated: rewards.fireAwardedToReplier,
          ownerFireAwarded: rewards.fireAwardedToOwner,
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
        const outcome = await applyAutomatedLike(tx, { replyId, userId, awardLikerBonus: true });
        await markUserActive(tx, userId);
        return outcome;
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

    // ── AI ──

    .post('/ai/thread-draft', async ({ body }) => {
      if (!isGoogleGenAIConfigured()) {
        throw new Error('Missing Gemini API key');
      }

      return await generateThreadDraft(body.prompt);
    }, {
      body: t.Object({
        prompt: t.String(),
      }),
    })

    .post('/ai/character-draft', async () => {
      return await generateCharacterDraft();
    })
  )

  .listen(Number(process.env.API_PORT || 3001));

export type App = typeof app;
console.log(`🦊 Cavenet API running at ${app.server?.hostname}:${app.server?.port}`);
