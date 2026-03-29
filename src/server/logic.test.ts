import { describe, expect, test } from 'bun:test';
import {
	buildCharacterAbbreviation,
	getLikeFireCap,
	getOrganicLikeBudget,
	getReplyFireReward,
	getReplyTargetFromQuality,
	scoreThreadQuality,
} from './logic';

describe('server logic helpers', () => {
	test('scores higher-quality threads more highly', () => {
		expect(scoreThreadQuality('Fire hunt today', 'We found mammoth tracks near the cave mouth. Should we follow them?')).toBeGreaterThan(30);
		expect(scoreThreadQuality('', 'ok')).toBeLessThan(10);
	});

	test('scales reply targets and rewards by quality', () => {
		expect(getReplyTargetFromQuality(10, 5)).toBe(1);
		expect(getReplyTargetFromQuality(80, 2)).toBe(2);
		expect(getReplyFireReward(10, false)).toBe(0);
		expect(getReplyFireReward(80, true)).toBe(3);
	});

	test('caps likes and organic engagement by audience size', () => {
		expect(getLikeFireCap(90, 3)).toBe(2);
		expect(getOrganicLikeBudget(10, 4)).toBe(1);
		expect(getOrganicLikeBudget(90, 2)).toBe(2);
	});

	test('builds short abbreviations from names', () => {
		expect(buildCharacterAbbreviation('Fire Cave Hunter')).toBe('FCH');
		expect(buildCharacterAbbreviation('  big   rock  ')).toBe('BR');
	});
});
