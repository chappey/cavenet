import { describe, expect, test } from 'bun:test';
import {
  buildTribeAbbreviation,
  getHuntClaimReward,
  getThreadPostCost,
  normalizeCreateReplyInput,
  normalizeCreateThreadInput,
  normalizeCreateTribeInput,
} from './flows';

describe('route/service flow helpers', () => {
  test('posting flow keeps expected costs and normalized payloads', () => {
    expect(getThreadPostCost('mixed')).toBe(1);
    expect(getThreadPostCost('text')).toBe(2);
    expect(getThreadPostCost('image')).toBe(2);

    const thread = normalizeCreateThreadInput({
      type: 'text',
      title: '  Fire hunt  ',
      content: '  Mammoth tracks   near cave mouth.  ',
      tribeId: ' tribe-1 ',
    });

    expect(thread.title).toBe('Fire hunt');
    expect(thread.content).toBe('Mammoth tracks near cave mouth.');
    expect(thread.tribeId).toBe('tribe-1');
  });

  test('replies and tribe forms are normalized', () => {
    const reply = normalizeCreateReplyInput({ content: '  yes   big fire  ' });
    const tribe = normalizeCreateTribeInput({ name: '  Fire Clan ', description: '  best hunters  ' });

    expect(reply.content).toBe('yes big fire');
    expect(tribe.name).toBe('Fire Clan');
    expect(tribe.description).toBe('best hunters');
  });

  test('tribe and hunt flows produce stable reward helpers', () => {
    expect(buildTribeAbbreviation('Fire Cave Hunters')).toBe('FCH');
    expect(buildTribeAbbreviation('Fire Cave Hunters', 'clan')).toBe('clan');
    expect(getHuntClaimReward(-2)).toBe(0);
    expect(getHuntClaimReward(0)).toBe(0);
    expect(getHuntClaimReward(5)).toBe(5);
    expect(getHuntClaimReward(50)).toBe(12);
  });
});
