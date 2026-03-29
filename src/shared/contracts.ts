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
