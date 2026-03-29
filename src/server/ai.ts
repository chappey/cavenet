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

const apiKey = Bun.env.GEMINI_API_KEY ?? Bun.env.GOOGLE_API_KEY;
const preferredModel = Bun.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const client = apiKey ? new GoogleGenAI({ apiKey }) : null;
const fallbackModels = [preferredModel, 'gemini-2.5-flash', 'gemini-2.0-flash']
	.filter((value, index, self) => self.indexOf(value) === index);

const jsonBlock = /```(?:json)?\s*([\s\S]*?)```/i;

export const CAVEMAN_REPLY_PREAMBLE = [
	'You are writing replies for Cavenet, a caveman social feed.',
	'Stay in character as the listed cave people.',
	'Use short, punchy, playful caveman language.',
	'React to the original post directly and do not mention AI.',
	'Keep each reply to 1-2 sentences max.',
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

export const generateThreadReplies = async ({
	threadTitle,
	threadContent,
	threadType,
	creatorUsername,
	profiles,
	maxReplies = profiles.length,
}: {
	threadTitle: string | null;
	threadContent: string | null;
	threadType: string;
	creatorUsername: string;
	profiles: AiReplyProfile[];
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
		CAVEMAN_REPLY_PREAMBLE,
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