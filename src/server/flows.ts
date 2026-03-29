import type { CreateCharacterInput, CreateReplyInput, CreateThreadInput, CreateTribeInput } from 'src/shared/contracts';
import { buildCharacterAbbreviation, normalizeText } from './logic';

export const getThreadPostCost = (type: CreateThreadInput['type']) => {
  switch (type) {
    case 'mixed':
      return 1;
    case 'text':
    case 'image':
    default:
      return 2;
  }
};

export const normalizeCreateCharacterInput = (input: CreateCharacterInput) => ({
  username: normalizeText(input.username),
  bio: normalizeText(input.bio ?? ''),
  avatar: (input.avatar ?? '').trim(),
  isPlayerCharacter: true as const,
});

export const normalizeCreateThreadInput = (input: CreateThreadInput) => ({
  title: input.title?.trim() || undefined,
  type: input.type,
  content: normalizeText(input.content),
  imageUrl: input.imageUrl?.trim() || undefined,
  tribeId: input.tribeId?.trim() || undefined,
});

export const normalizeCreateReplyInput = (input: CreateReplyInput) => ({
  content: normalizeText(input.content),
});

export const normalizeCreateTribeInput = (input: CreateTribeInput) => ({
  name: normalizeText(input.name),
  abbreviation: input.abbreviation?.trim() || undefined,
  description: normalizeText(input.description ?? ''),
});

export const getHuntClaimReward = (score: number) => {
  const clampedScore = Math.max(0, Math.floor(score));
  return clampedScore <= 0 ? 0 : Math.min(12, Math.max(1, clampedScore));
};

export const buildTribeAbbreviation = (name: string, provided?: string) => {
  return provided?.trim() || buildCharacterAbbreviation(name);
};
