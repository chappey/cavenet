import { GoogleGenAI } from '@google/genai';

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
const preferredModel = Bun.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const client = apiKey ? new GoogleGenAI({ apiKey }) : null;
const fallbackModels = [preferredModel, 'gemini-2.5-flash', 'gemini-2.0-flash']
	.filter((value, index, self) => self.indexOf(value) === index);

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

export const isGoogleGenAIConfigured = () => client !== null;

export const generateThreadDraft = async (prompt: string) => {
	if (!client) {
		throw new Error('Missing Gemini API key. Set GEMINI_API_KEY or GOOGLE_API_KEY.');
	}

	let lastError: unknown;
	for (const model of fallbackModels) {
		try {
			const response = await client.models.generateContent({
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
};

export const generateCharacterDraft = async () => {
	if (!client) {
		return buildLocalCharacterDraft();
	}

	let lastError: unknown;
	for (const model of fallbackModels) {
		try {
			const response = await client.models.generateContent({
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

	return buildLocalCharacterDraft();
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
	if (!client) {
		throw new Error('Missing Gemini API key. Set GEMINI_API_KEY or GOOGLE_API_KEY.');
	}

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

	let lastError: unknown;
	for (const model of fallbackModels) {
		try {
			const response = await client.models.generateContent({
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
};