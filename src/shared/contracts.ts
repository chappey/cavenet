export type CharacterDraftInput = {
	prompt: string;
};

export type CreateCharacterInput = {
	username: string;
	bio?: string;
	avatar?: string;
};

export type CreateThreadInput = {
	title?: string;
	type: 'text' | 'image' | 'mixed';
	content: string;
	imageUrl?: string;
	tribeId?: string;
};

export type CreateReplyInput = {
	content: string;
};

export type CreateTribeInput = {
	name: string;
	abbreviation?: string;
	description?: string;
};

export type UpdateBioInput = {
	bio: string;
};

export type HuntClaimInput = {
	runId: string;
	score: number;
};

export type ApiErrorPayload = {
	message: string;
	status?: number;
	code?: string;
};

export type ISODateString = string;

export type UserSummary = {
	id: string;
	username: string;
	bio?: string | null;
	avatar?: string | null;
	isPlayerCharacter?: boolean;
	food: number;
	fire: number;
	createdAt?: ISODateString | Date;
};

export type UserProfile = UserSummary & {
	threads?: ThreadSummary[];
	tribes?: TribeMembership[];
};

export type ReplySummary = {
	id: string;
	threadId: string;
	creatorId: string;
	content: string;
	replyIndex: number;
	isUnique?: boolean;
	fireGenerated: number;
	likes: number;
	createdAt: ISODateString | Date;
	creatorUsername?: string;
};

export type EngagementSnapshot = {
	status: 'idle' | 'queued' | 'active' | 'complete' | 'inactive';
	plannedReplies: number;
	completedReplies: number;
	plannedLikes: number;
	completedLikes: number;
	updatedAt: number;
};

export type ThreadSummary = {
	id: string;
	creatorId: string;
	tribeId?: string | null;
	title?: string | null;
	content: string;
	type: 'text' | 'image' | 'mixed';
	imageUrl?: string | null;
	fireGenerated: number;
	createdAt: ISODateString | Date;
	creatorUsername?: string;
	replyCount?: number;
	uniquePosters?: number;
	lastReplyAt?: ISODateString | Date | null;
	recentReplies?: ReplySummary[];
	tribeName?: string | null;
	tribeAbbreviation?: string | null;
	engagement?: EngagementSnapshot;
};

export type ThreadDetailResponse = ThreadSummary & {
	replies: ReplySummary[];
};

export type TribeSummary = {
	id: string;
	name: string;
	abbreviation?: string | null;
	description?: string | null;
	avatar?: string | null;
	creatorId?: string | null;
	createdAt?: ISODateString | Date;
	memberCount?: number;
};

export type TribeDetailResponse = TribeSummary & {
	members: UserSummary[];
	threads: ThreadSummary[];
};

export type TribeMembership = {
	tribeId: string;
	tribeName: string;
	tribeAbbreviation?: string | null;
	tribeAvatar?: string | null;
	tribeDescription?: string | null;
};

export type FeedSort = 'newest' | 'active' | 'hottest';

export type FeedResponse = ThreadSummary[];

export type StatsResponse = {
	summary: {
		fire: number;
		food: number;
		users: number;
		playerCharacters: number;
		npcCharacters: number;
		posts: number;
		replies: number;
		likes: number;
		tribes: number;
	};
	activityBreakdown: Array<{ metric: string; value: number }>;
	activityTimeline: Array<{ day: string; posts: number; replies: number; likes: number }>;
	topUsers: Array<{
		id: string;
		username: string;
		isPlayerCharacter: boolean;
		fire: number;
		food: number;
		posts: number;
		replies: number;
		likesReceived: number;
	}>;
};

export type HuntClaimResponse = {
	status: 'claimed' | 'already_claimed';
	fireReward: number;
	cooldownUntil: number;
	remainingSimSeconds: number;
};

export type HuntStatusResponse = {
	canPlay: boolean;
	cooldownUntil: number;
	remainingSimSeconds: number;
	remainingRealMs: number;
	timeScale: number;
};

export type CharacterDraftResponse = {
	username?: string;
	bio?: string;
};
