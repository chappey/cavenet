import { GoogleGenAI } from '@google/genai';
import { createHash } from 'node:crypto';

export type ThreadDraft = {
	title: string;
	content: string;
	type: 'text' | 'image' | 'mixed';
	imagePrompt?: string;
};

export type AiReplyProfile = {
	username: string;
	bio: string;
};

export type AiReplyDraft = {
	username: string;
	content: string;
};

export type CharacterDraft = {
	username: string;
	bio: string;
};

export type ReplyMood = 'hyped' | 'skeptical' | 'wise' | 'jealous' | 'goofy';

const getQualityBand = (qualityScore: number) => {
	if (qualityScore < 25) return 'terrible';
	if (qualityScore < 45) return 'weak';
	if (qualityScore < 70) return 'solid';
	if (qualityScore < 85) return 'strong';
	return 'legendary';
};

const REPLY_MOODS: Record<ReplyMood, string> = {
	hyped: [
		'Be loud, excited, and supportive.',
		'Use quick bursts, exclamation marks, and caveman hype.',
	].join('\n'),
	skeptical: [
		'Be a little suspicious or doubtful, but still playful.',
		'Use shorter lines and a side-eye vibe.',
	].join('\n'),
	wise: [
		'Speak like an old cave elder with calm confidence.',
		'Give a grounded, thoughtful reaction.',
	].join('\n'),
	jealous: [
		'Be competitive, braggy, and a little envious.',
		'React like you want the same thing or want to one-up the post.',
	].join('\n'),
	goofy: [
		'Be weird, silly, and a little chaotic in a harmless way.',
		'Use funny cave nonsense and odd little observations.',
	].join('\n'),
};

const apiKey = Bun.env.GEMINI_API_KEY ?? Bun.env.GOOGLE_API_KEY;
const client = apiKey ? new GoogleGenAI({ apiKey }) : null;

const getAiConfig = () => {
	const preferredModel = Bun.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
	const aiDisabled = ['1', 'true', 'yes', 'on'].includes(String(Bun.env.CAVENET_DISABLE_AI ?? Bun.env.DISABLE_AI ?? '').toLowerCase());
	const fallbackModels = [preferredModel, 'gemini-2.5-flash', 'gemini-2.0-flash']
		.filter((value, index, self) => self.indexOf(value) === index);

	return { aiDisabled, fallbackModels };
};

const REMOTE_AI_MIN_INTERVAL_MS = 1_500;
const REMOTE_AI_CACHE_TTL_MS = 30_000;
const REMOTE_AI_BACKOFF_MS = 60_000;

let remoteAiChain: Promise<void> = Promise.resolve();
let remoteAiLastStartedAt = 0;
let remoteAiBackoffUntil = 0;

const remoteAiPending = new Map<string, Promise<unknown>>();
const remoteAiCache = new Map<string, { expiresAt: number; value: unknown }>();

const hashAiRequest = (kind: string, value: string) => createHash('sha256').update(`${kind}:${value}`).digest('hex');

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const enqueueRemoteAiTask = <T>(task: () => Promise<T>) => {
	const next = remoteAiChain.then(task, task);
	remoteAiChain = next.then(() => undefined, () => undefined);
	return next;
};

const isQuotaOrRateLimitError = (error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	return /(?:429|quota|rate limit|resource exhausted|too many requests)/i.test(message);
};

const runRemoteAiRequest = async <T>({
	key,
	label,
	fallback,
	task,
}: {
	key: string;
	label: string;
	fallback: () => T;
	task: (fallbackModels: string[]) => Promise<T>;
}) => {
	const { aiDisabled, fallbackModels } = getAiConfig();
	if (!client || aiDisabled) {
		return fallback();
	}

	const cached = remoteAiCache.get(key);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.value as T;
	}

	const pending = remoteAiPending.get(key);
	if (pending) {
		return pending as Promise<T>;
	}

	const request = enqueueRemoteAiTask(async () => {
		const waitUntil = Math.max(remoteAiBackoffUntil, remoteAiLastStartedAt + REMOTE_AI_MIN_INTERVAL_MS);
		const waitMs = waitUntil - Date.now();
		if (waitMs > 0) {
			await sleep(waitMs);
		}

		remoteAiLastStartedAt = Date.now();
		try {
			const result = await task(fallbackModels);
			remoteAiCache.set(key, { expiresAt: Date.now() + REMOTE_AI_CACHE_TTL_MS, value: result });
			return result;
		} catch (error) {
			if (isQuotaOrRateLimitError(error)) {
				remoteAiBackoffUntil = Date.now() + REMOTE_AI_BACKOFF_MS;
				console.warn(`[ai] ${label} hit Gemini quota/rate limits; using local fallback for ${Math.ceil(REMOTE_AI_BACKOFF_MS / 1000)}s`);
				return fallback();
			}

			throw error;
		}
	});

	remoteAiPending.set(key, request);

	try {
		return await request;
	} finally {
		remoteAiPending.delete(key);
	}
};

const jsonBlock = /```(?:json)?\s*([\s\S]*?)```/i;

const caveNames = [
	'Grok',
	'Brakka',
	'Zog',
	'Koro',
	'Munka',
	'Daka',
	'Hruk',
	'Runa',
	'Voga',
	'Tuma',
];

const caveTitles = [
	'Fire Finder',
	'Berry Hunter',
	'Rock Painter',
	'Mammoth Whisperer',
	'Spear Dreamer',
	'Moon Watcher',
	'Bone Collector',
	'Camp Builder',
];

export const CAVEMAN_REPLY_PREAMBLE = [
	'You are writing replies for Cavenet, a caveman social feed.',
	'Stay in character as the listed cave people.',
	'Use short, punchy, playful caveman language.',
	'React to the original post directly and do not mention AI.',
	'Keep each reply to 1-2 sentences max.',
].join('\n');

export const pickReplyMood = (qualityScore: number): ReplyMood => {
	if (qualityScore < 25) {
		return Math.random() < 0.5 ? 'skeptical' : 'goofy';
	}

	if (qualityScore < 45) {
		return ['skeptical', 'goofy', 'wise'][Math.floor(Math.random() * 3)] as ReplyMood;
	}

	if (qualityScore < 70) {
		return ['wise', 'hyped', 'goofy'][Math.floor(Math.random() * 3)] as ReplyMood;
	}

	return ['hyped', 'jealous', 'goofy', 'wise'][Math.floor(Math.random() * 4)] as ReplyMood;
};

export const buildReplyPreamble = (mood: ReplyMood, qualityScore: number) => [
	CAVEMAN_REPLY_PREAMBLE,
	'',
	`Perceived post quality: ${qualityScore}/100 (${getQualityBand(qualityScore)})`,
	`Mood: ${mood}`,
	REPLY_MOODS[mood],
].join('\n');

const parseDraft = (text: string): ThreadDraft => {
	const fenced = text.match(jsonBlock)?.[1] ?? text;
	const start = fenced.indexOf('{');
	const end = fenced.lastIndexOf('}');
	const raw = start >= 0 && end >= 0 ? fenced.slice(start, end + 1) : fenced;
	const parsed = JSON.parse(raw) as Partial<ThreadDraft>;

	return {
		title: String(parsed.title ?? 'Untitled thread').trim().slice(0, 120),
		content: String(parsed.content ?? '').trim(),
		type: parsed.type === 'image' || parsed.type === 'mixed' ? parsed.type : 'text',
		imagePrompt: parsed.imagePrompt ? String(parsed.imagePrompt).trim() : undefined,
	};
};

const parseReplyDrafts = (text: string): AiReplyDraft[] => {
	const fenced = text.match(jsonBlock)?.[1] ?? text;
	const start = fenced.indexOf('[');
	const end = fenced.lastIndexOf(']');
	const raw = start >= 0 && end >= 0 ? fenced.slice(start, end + 1) : fenced;
	const parsed = JSON.parse(raw) as Array<Partial<AiReplyDraft>>;

	return parsed
		.filter((reply): reply is Partial<AiReplyDraft> => Boolean(reply && reply.username && reply.content))
		.map((reply) => ({
			username: String(reply.username ?? '').trim(),
			content: String(reply.content ?? '').trim(),
		}))
		.filter((reply) => reply.username.length > 0 && reply.content.length > 0);
};

const buildLocalCharacterDraft = (): CharacterDraft => {
	const username = `${caveNames[Math.floor(Math.random() * caveNames.length)]}-${Math.floor(Math.random() * 98) + 1}`;
	const title = caveTitles[Math.floor(Math.random() * caveTitles.length)];
	const bioBits = [
		'Likes warm fire and loud gossip.',
		'Always first to the berry patch.',
		'Grunts big and thinks bigger.',
		'Has strong opinions about rocks.',
		'Collects shiny things and cave stories.',
	];

	return {
		username,
		bio: `${title}. ${bioBits[Math.floor(Math.random() * bioBits.length)]}`,
	};
};

const buildLocalThreadDraft = (prompt: string): ThreadDraft => {
	const cleanedPrompt = prompt.trim();
	const base = cleanedPrompt.length > 0 ? cleanedPrompt : 'cave life today';
	const title = base
		.replace(/\s+/g, ' ')
		.split(' ')
		.slice(0, 6)
		.join(' ')
		.slice(0, 60);

	return {
		title: title ? `Cave take: ${title}` : 'Cave take',
		content: `Me think: ${base}. Cave people, what say?`,
		type: 'text',
	};
};

const buildLocalReplyDrafts = ({
	profiles,
	qualityScore,
	threadTitle,
	mood,
}: {
	profiles: AiReplyProfile[];
	qualityScore: number;
	threadTitle: string | null;
	mood: ReplyMood;
}): AiReplyDraft[] => {
	const openers: Record<ReplyMood, string[]> = {
		hyped: ['OOG!', 'YES!', 'BIG YES!'],
		skeptical: ['Hmm.', 'Maybe.', 'Not sure.'],
		wise: ['Old cave know:', 'Me think:', 'Stone truth:'],
		jealous: ['Me want that.', 'Why not me?', 'Unfair!'],
		goofy: ['Hehe.', 'Me no know but like.', 'Mmmm cave brain.'],
	};

	const closers = ['That good.', 'Me like.', 'Rock on.'];
	const replyTarget = Math.min(profiles.length, qualityScore < 25 ? 1 : qualityScore < 45 ? 2 : qualityScore < 70 ? 3 : 4);

	return profiles.slice(0, replyTarget).map((profile, index) => {
		const opener = openers[mood][index % openers[mood].length];
		const closer = closers[(qualityScore + index) % closers.length];
		return {
			username: profile.username,
			content: `${opener} ${profile.username} say ${closer}${threadTitle ? ` About ${threadTitle}.` : ''}`.trim(),
		};
	});
};

const shouldUseRemoteAi = () => {
	const { aiDisabled } = getAiConfig();
	return !aiDisabled && client !== null;
};

export const isGoogleGenAIConfigured = () => shouldUseRemoteAi();

export const generateThreadDraft = async (prompt: string) => {
	return await runRemoteAiRequest({
		key: hashAiRequest('thread-draft', prompt),
		label: 'thread draft',
		fallback: () => buildLocalThreadDraft(prompt),
		task: async (fallbackModels) => {
			let lastError: unknown;
			for (const model of fallbackModels) {
				try {
					const response = await client!.models.generateContent({
						model,
						contents: [
							{
								role: 'user',
								parts: [
									{
										text: [
											'Write a short caveman social post draft for Cavenet.',
											'Keep the tone playful, simple, and in first person.',
											'Return only valid JSON with these keys: title, content, type, imagePrompt.',
											'Allowed type values are text, image, or mixed.',
											`Prompt: ${prompt}`,
										].join('\n'),
									},
								],
							},
						],
					});

					const text = response.text?.trim();
					if (!text) {
						throw new Error('Google GenAI returned an empty response.');
					}

					return parseDraft(text);
				} catch (error) {
					lastError = error;
					const message = error instanceof Error ? error.message : String(error);
					const isModelMismatch = /not found|not supported/i.test(message);
					if (!isModelMismatch || model === fallbackModels[fallbackModels.length - 1]) {
						throw error;
					}
				}
			}

			throw lastError instanceof Error ? lastError : new Error('Google GenAI request failed.');
		},
	});
};

export const generateCharacterDraft = async () => {
	return await runRemoteAiRequest({
		key: 'character-draft',
		label: 'character draft',
		fallback: () => buildLocalCharacterDraft(),
		task: async (fallbackModels) => {
			let lastError: unknown;
			for (const model of fallbackModels) {
				try {
					const response = await client!.models.generateContent({
						model,
						contents: [
							{
								role: 'user',
								parts: [
									{
										text: [
											'Create one original caveman character for Cavenet.',
											'Return only valid JSON with keys: username, bio.',
											'Keep the username short and playful.',
											'Keep the bio to one sentence.',
										].join('\n'),
									},
								],
							},
						],
					});

					const text = response.text?.trim();
					if (!text) {
						throw new Error('Google GenAI returned an empty response.');
					}

					const fenced = text.match(jsonBlock)?.[1] ?? text;
					const start = fenced.indexOf('{');
					const end = fenced.lastIndexOf('}');
					const raw = start >= 0 && end >= 0 ? fenced.slice(start, end + 1) : fenced;
					const parsed = JSON.parse(raw) as Partial<CharacterDraft>;

					const username = String(parsed.username ?? '').trim().slice(0, 24);
					const bio = String(parsed.bio ?? '').trim().slice(0, 180);

					if (!username || !bio) {
						throw new Error('Google GenAI returned an invalid character draft.');
					}

					return { username, bio };
				} catch (error) {
					lastError = error;
					const message = error instanceof Error ? error.message : String(error);
					const isModelMismatch = /not found|not supported/i.test(message);
					if (!isModelMismatch || model === fallbackModels[fallbackModels.length - 1]) {
						break;
					}
				}
			}

			throw lastError instanceof Error ? lastError : new Error('Google GenAI request failed.');
		},
	});
};

export const generateThreadReplies = async ({
	threadTitle,
	threadContent,
	threadType,
	creatorUsername,
	profiles,
	mood,
	qualityScore,
	maxReplies = profiles.length,
}: {
	threadTitle: string | null;
	threadContent: string | null;
	threadType: string;
	creatorUsername: string;
	profiles: AiReplyProfile[];
	mood: ReplyMood;
	qualityScore: number;
	maxReplies?: number;
}) => {
	if (profiles.length === 0 || maxReplies <= 0) {
		return [] as AiReplyDraft[];
	}

	const replyProfiles = profiles.slice(0, maxReplies);
	const profilePrompt = replyProfiles
		.map((profile, index) => `${index + 1}. ${profile.username}: ${profile.bio}`)
		.join('\n');

	const prompt = [
		buildReplyPreamble(mood, qualityScore),
		'',
		'Generate one reply per listed profile.',
		'Use the exact usernames provided.',
		'Return only valid JSON as an array of objects with keys: username, content.',
		'Do not include markdown or extra commentary.',
		'',
		`Original poster: ${creatorUsername}`,
		`Original post title: ${threadTitle ?? '(no title)'}`,
		`Original post type: ${threadType}`,
		`Original post content: ${threadContent ?? ''}`,
		`Perceived post quality score: ${qualityScore}/100`,
		'',
		'Replying profiles:',
		profilePrompt,
	].join('\n');

	return await runRemoteAiRequest({
		key: hashAiRequest('thread-replies', prompt),
		label: 'thread replies',
		fallback: () => buildLocalReplyDrafts({ profiles, qualityScore, threadTitle, mood }),
		task: async (fallbackModels) => {
			let lastError: unknown;
			for (const model of fallbackModels) {
				try {
					const response = await client!.models.generateContent({
						model,
						contents: prompt,
					});

					const text = response.text?.trim();
					if (!text) {
						throw new Error('Google GenAI returned an empty response.');
					}

					return parseReplyDrafts(text);
				} catch (error) {
					lastError = error;
					const message = error instanceof Error ? error.message : String(error);
					const isModelMismatch = /not found|not supported/i.test(message);
					if (!isModelMismatch || model === fallbackModels[fallbackModels.length - 1]) {
						throw error;
					}
				}
			}

			throw lastError instanceof Error ? lastError : new Error('Google GenAI request failed.');
		},
	});
};