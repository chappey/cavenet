const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');

export const scoreThreadQuality = (title: string | null | undefined, content: string) => {
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

export const getReplyTargetFromQuality = (qualityScore: number, availableNpcCount: number) => {
	if (availableNpcCount <= 0) return 0;
	const tierTarget = qualityScore < 25 ? 1 : qualityScore < 45 ? 1 : qualityScore < 60 ? 2 : qualityScore < 75 ? 3 : qualityScore < 90 ? 4 : 5;
	return Math.min(availableNpcCount, Math.max(1, tierTarget), 5);
};

export const getReplyFireReward = (qualityScore: number, isOwnerReply: boolean) => {
	if (qualityScore < 25) return 0;
	if (qualityScore < 45) return isOwnerReply ? 1 : 1;
	if (qualityScore < 70) return isOwnerReply ? 2 : 2;
	if (qualityScore < 85) return isOwnerReply ? 3 : 3;
	return isOwnerReply ? 4 : 4;
};

export const getLikeFireCap = (qualityScore: number, availableUsers: number) => {
	if (qualityScore < 25) return 0;
	const cap = qualityScore < 45 ? 1 : qualityScore < 70 ? 3 : qualityScore < 85 ? 5 : 7;
	return Math.min(cap, Math.max(0, availableUsers - 1));
};

export const getOrganicLikeBudget = (qualityScore: number, availableNpcCount: number) => {
	if (availableNpcCount <= 0) return 0;
	const base = qualityScore < 25 ? 1 : qualityScore < 45 ? 1 : qualityScore < 70 ? 2 : qualityScore < 85 ? 4 : 6;
	return Math.min(Math.max(1, base), Math.max(0, availableNpcCount));
};

export const buildCharacterAbbreviation = (name: string) => {
	const compact = normalizeText(name)
		.split(/\s+/)
		.filter(Boolean)
		.map(word => word[0])
		.join('')
		.toUpperCase();

	return compact.slice(0, 4);
};
