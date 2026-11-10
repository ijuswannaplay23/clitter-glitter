import { describe, expect, it } from 'vitest';
import type { FinalRules } from '../domain';
import { entry, poolRules, rangeRules } from './fixtures';
import { scoreFinalRound, scoreStandardRound } from './round';

const kinds = (flags: { kind: string }[]) => flags.map((f) => f.kind);

describe('wager validation (standard rounds)', () => {
  it('a pool with a skipped value is valid and not flagged', () => {
    const entries = [
      entry('t', 'q1', 'correct', 1),
      entry('t', 'q2', 'correct', 2),
      entry('t', 'q3', 'wrong', 4),
    ];
    const result = scoreStandardRound(entries, ['q1', 'q2', 'q3'], poolRules([1, 2, 3, 4, 5]));
    expect(result.flags).toEqual([]);
  });

  it('a pool value used twice is flagged but still scored', () => {
    const entries = [entry('t', 'q1', 'correct', 5), entry('t', 'q2', 'correct', 5)];
    const result = scoreStandardRound(entries, ['q1', 'q2'], poolRules([1, 2, 3, 4, 5]));
    expect(kinds(result.flags)).toEqual(['wager-reused']);
    expect(result.flags[0]?.entryIds).toHaveLength(2);
    expect(result.points).toBe(10);
  });

  it('a wager not in the pool is flagged but still scored', () => {
    const result = scoreStandardRound(
      [entry('t', 'q1', 'correct', 9)],
      ['q1'],
      poolRules([1, 2, 3, 4, 5]),
    );
    expect(kinds(result.flags)).toEqual(['wager-not-in-pool']);
    expect(result.points).toBe(9);
  });

  it('a wager outside the range is flagged but still scored', () => {
    const result = scoreStandardRound([entry('t', 'q1', 'wrong', 7)], ['q1'], rangeRules(1, 5));
    expect(kinds(result.flags)).toEqual(['wager-out-of-range']);
    expect(result.points).toBe(-7);
  });

  it('range mode allows the same wager more than once', () => {
    const entries = [entry('t', 'q1', 'correct', 3), entry('t', 'q2', 'correct', 3)];
    expect(scoreStandardRound(entries, ['q1', 'q2'], rangeRules(1, 5)).flags).toEqual([]);
  });

  it('flags an answered question with no wager written', () => {
    const result = scoreStandardRound([entry('t', 'q1', 'correct')], ['q1'], rangeRules(1, 5));
    expect(kinds(result.flags)).toEqual(['missing-wager']);
  });

  it('does not validate wagers on blank answers', () => {
    const entries = [entry('t', 'q1', 'blank', 99), entry('t', 'q2', 'blank')];
    expect(scoreStandardRound(entries, ['q1', 'q2'], rangeRules(1, 5)).flags).toEqual([]);
  });
});

describe('final round', () => {
  const current: FinalRules = {
    wagerCap: 'currentScore',
    allowOptOut: true,
    onWrong: 'loseWager',
  };

  it('currentScore cap: team on 7 wagers 7 and is correct => +7', () => {
    const result = scoreFinalRound([entry('t', 'f', 'correct', 7)], ['f'], current, 7);
    expect(result.points).toBe(7);
    expect(result.flags).toEqual([]);
  });

  it('currentScore cap: a team on -2 wagering above 0 is flagged invalid', () => {
    const result = scoreFinalRound([entry('t', 'f', 'correct', 3)], ['f'], current, -2);
    expect(kinds(result.flags)).toEqual(['wager-exceeds-cap']);
  });

  it('fixed cap is enforced regardless of score', () => {
    const rules: FinalRules = { ...current, wagerCap: { fixed: 5 } };
    expect(kinds(scoreFinalRound([entry('t', 'f', 'wrong', 6)], ['f'], rules, 100).flags)).toEqual([
      'wager-exceeds-cap',
    ]);
    expect(scoreFinalRound([entry('t', 'f', 'wrong', 5)], ['f'], rules, 0).points).toBe(-5);
  });

  it('loseHalfWager halves the loss, rounding down', () => {
    const rules: FinalRules = { ...current, onWrong: 'loseHalfWager' };
    expect(scoreFinalRound([entry('t', 'f', 'wrong', 7)], ['f'], rules, 10).points).toBe(-3);
  });

  it('a wager of 0 is flagged when opting out is not allowed', () => {
    const rules: FinalRules = { ...current, allowOptOut: false };
    const result = scoreFinalRound([entry('t', 'f', 'wrong', 0)], ['f'], rules, 10);
    expect(kinds(result.flags)).toEqual(['opt-out-not-allowed']);
  });

  it('a blank final scores 0', () => {
    expect(scoreFinalRound([entry('t', 'f', 'blank', 5)], ['f'], current, 10).points).toBe(0);
  });
});
