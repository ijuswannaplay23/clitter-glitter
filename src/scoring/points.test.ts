import { describe, expect, it } from 'vitest';
import { classic, entry, poolRules, questionIds } from './fixtures';
import { points } from './points';
import { scoreStandardRound } from './round';

describe('points', () => {
  it('awards baseValue for a correct answer with no wager', () => {
    expect(points(entry('t', 'q1', 'correct'), { ...classic, baseValue: 2 }, 0)).toBe(2);
  });

  it('applies the per-question weight for the question position', () => {
    const rules = { ...classic, questionWeights: [1, 1, 3] };
    expect(points(entry('t', 'q3', 'correct'), rules, 2)).toBe(3);
    expect(points(entry('t', 'q1', 'correct'), rules, 0)).toBe(1);
  });

  it('uses the wager instead of baseValue on a wagered question', () => {
    expect(points(entry('t', 'q1', 'correct', 4), poolRules([1, 2, 3, 4, 5]), 0)).toBe(4);
  });

  it('loseWager: a wrong answer costs the full wager', () => {
    expect(points(entry('t', 'q1', 'wrong', 4), poolRules([4]), 0)).toBe(-4);
  });

  it('loseHalfWager: a wrong answer costs half the wager, rounded down', () => {
    const rules = poolRules([1, 4, 5], 'loseHalfWager');
    expect(points(entry('t', 'q1', 'wrong', 5), rules, 0)).toBe(-2);
    expect(points(entry('t', 'q2', 'wrong', 4), rules, 1)).toBe(-2);
    expect(points(entry('t', 'q3', 'wrong', 1), rules, 2)).toBe(0);
  });

  it('zero: a wrong answer costs nothing even when a wager was made', () => {
    expect(points(entry('t', 'q1', 'wrong', 5), poolRules([5], 'zero'), 0)).toBe(0);
  });

  it('flatPenalty: a wrong answer costs the flat amount, a correct one is unaffected', () => {
    const rules = { ...classic, onWrong: { flatPenalty: 2 } };
    expect(points(entry('t', 'q1', 'wrong'), rules, 0)).toBe(-2);
    expect(points(entry('t', 'q2', 'correct'), rules, 1)).toBe(1);
  });

  it('loseWager with no wager mode costs nothing', () => {
    expect(points(entry('t', 'q1', 'wrong'), { ...classic, onWrong: 'loseWager' }, 0)).toBe(0);
  });

  it('a blank answer scores 0 even with a wager written down', () => {
    expect(points(entry('t', 'q1', 'blank', 5), poolRules([5]), 0)).toBe(0);
  });

  it('treats a missing wager as 0 on a wagered question', () => {
    expect(points(entry('t', 'q1', 'correct'), poolRules([1, 2]), 0)).toBe(0);
  });
});

describe('scoreStandardRound', () => {
  it('classic: 5 of 8 correct => 5', () => {
    const ids = questionIds('q', 8);
    const entries = ids.map((id, i) => entry('t', id, i < 5 ? 'correct' : 'wrong'));
    expect(scoreStandardRound(entries, ids, classic).points).toBe(5);
  });

  it('pool [1..5]: 3 correct with wagers 5, 3, 1 => +9', () => {
    const entries = [
      entry('t', 'q1', 'correct', 5),
      entry('t', 'q2', 'correct', 3),
      entry('t', 'q3', 'correct', 1),
    ];
    const result = scoreStandardRound(entries, ['q1', 'q2', 'q3'], poolRules([1, 2, 3, 4, 5]));
    expect(result.points).toBe(9);
    expect(result.flags).toEqual([]);
  });

  it('pool [1..5]: 2 wrong with wagers 4, 2 and loseWager => -6', () => {
    const entries = [entry('t', 'q1', 'wrong', 4), entry('t', 'q2', 'wrong', 2)];
    expect(scoreStandardRound(entries, ['q1', 'q2'], poolRules([1, 2, 3, 4, 5])).points).toBe(-6);
  });

  it('ignores entries for questions outside the round', () => {
    const entries = [entry('t', 'q1', 'correct'), entry('t', 'other', 'correct')];
    expect(scoreStandardRound(entries, ['q1'], classic).points).toBe(1);
  });

  it('ignores soft-deleted entries', () => {
    const deleted = { ...entry('t', 'q1', 'correct'), deletedAt: '2026-01-02T00:00:00.000Z' };
    expect(scoreStandardRound([deleted], ['q1'], classic).points).toBe(0);
  });

  it('duplicate entries for one question: the most recently updated wins and it is flagged', () => {
    const older = entry('t', 'q1', 'wrong');
    const newer = { ...entry('t', 'q1', 'correct'), updatedAt: '2026-02-01T00:00:00.000Z' };
    const result = scoreStandardRound([newer, older], ['q1'], classic);
    expect(result.points).toBe(1);
    expect(result.flags.map((f) => f.kind)).toEqual(['duplicate-entry']);
  });
});
