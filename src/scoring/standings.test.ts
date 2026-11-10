import { describe, expect, it } from 'vitest';
import type { FinalRules } from '../domain';
import { classic, entry, finalRound, poolRules, questionIds, standardRound } from './fixtures';
import { standings } from './standings';

const allowNegative = { allowNegativeTotal: true };
const clamped = { allowNegativeTotal: false };

describe('running totals', () => {
  it('allowNegativeTotal false: total 3 then a round of -6 => 0, and later rounds build from 0', () => {
    const rounds = [
      standardRound('r1', ['a1', 'a2', 'a3'], classic),
      standardRound('r2', ['b1', 'b2'], poolRules([2, 4])),
      standardRound('r3', ['c1', 'c2'], classic),
    ];
    const entries = [
      entry('t', 'a1', 'correct'),
      entry('t', 'a2', 'correct'),
      entry('t', 'a3', 'correct'),
      entry('t', 'b1', 'wrong', 2),
      entry('t', 'b2', 'wrong', 4),
      entry('t', 'c1', 'correct'),
      entry('t', 'c2', 'correct'),
    ];
    const [result] = standings({ teamIds: ['t'], rounds, entries, rules: clamped });
    expect(result?.roundPoints).toEqual([3, -6, 2]);
    expect(result?.runningTotals).toEqual([3, 0, 2]);
  });

  it('allowNegativeTotal true lets the total go below 0', () => {
    const rounds = [standardRound('r1', ['q1'], poolRules([5]))];
    const [result] = standings({
      teamIds: ['t'],
      rounds,
      entries: [entry('t', 'q1', 'wrong', 5)],
      rules: allowNegative,
    });
    expect(result?.total).toBe(-5);
  });

  it('editing a past entry recomputes every later total', () => {
    const rounds = [standardRound('r1', ['a1'], classic), standardRound('r2', ['b1'], classic)];
    const before = [entry('t', 'a1', 'wrong'), entry('t', 'b1', 'correct')];
    const after = [entry('t', 'a1', 'correct'), entry('t', 'b1', 'correct')];
    const run = (entries: typeof before) =>
      standings({ teamIds: ['t'], rounds, entries, rules: allowNegative })[0]?.runningTotals;
    expect(run(before)).toEqual([0, 1]);
    expect(run(after)).toEqual([1, 2]);
  });

  it('roundsCounted limits standings to the first N rounds', () => {
    const rounds = [standardRound('r1', ['a1'], classic), standardRound('r2', ['b1'], classic)];
    const entries = [entry('t', 'a1', 'correct'), entry('t', 'b1', 'correct')];
    const [result] = standings({
      teamIds: ['t'],
      rounds,
      entries,
      rules: allowNegative,
      roundsCounted: 1,
    });
    expect(result?.total).toBe(1);
    expect(result?.runningTotals).toEqual([1]);
  });

  it('a team with no entries in a round scores 0 for it', () => {
    const rounds = [standardRound('r1', ['q1'], classic)];
    const [result] = standings({ teamIds: ['t'], rounds, entries: [], rules: allowNegative });
    expect(result?.total).toBe(0);
  });
});

describe('ranking', () => {
  it('sorts by total descending and gives ties the same rank', () => {
    const rounds = [standardRound('r1', questionIds('q', 3), classic)];
    const entries = [
      entry('a', 'q1', 'correct'),
      entry('b', 'q1', 'correct'),
      entry('b', 'q2', 'correct'),
      entry('c', 'q1', 'correct'),
      entry('c', 'q2', 'correct'),
    ];
    const result = standings({
      teamIds: ['a', 'b', 'c'],
      rounds,
      entries,
      rules: allowNegative,
    });
    expect(result.map((r) => [r.teamId, r.total, r.rank])).toEqual([
      ['b', 2, 1],
      ['c', 2, 1],
      ['a', 1, 3],
    ]);
  });
});

describe('final round in standings', () => {
  const finalRules: FinalRules = {
    wagerCap: 'currentScore',
    allowOptOut: true,
    onWrong: 'loseWager',
  };

  it('currentScore cap: team on 7 wagers 7 and is correct => 14', () => {
    const rounds = [
      standardRound('r1', questionIds('q', 8), classic),
      finalRound('final', 'f', finalRules),
    ];
    const entries = [
      ...questionIds('q', 8).map((id, i) => entry('t', id, i < 7 ? 'correct' : 'wrong')),
      entry('t', 'f', 'correct', 7),
    ];
    const [result] = standings({ teamIds: ['t'], rounds, entries, rules: allowNegative });
    expect(result?.total).toBe(14);
    expect(result?.flags).toEqual([]);
  });

  it('flags a final wager above the cap for a team on a negative score', () => {
    const rounds = [
      standardRound('r1', ['q1'], poolRules([2])),
      finalRound('final', 'f', finalRules),
    ];
    const entries = [entry('t', 'q1', 'wrong', 2), entry('t', 'f', 'correct', 3)];
    const [result] = standings({ teamIds: ['t'], rounds, entries, rules: allowNegative });
    expect(result?.flags.map((f) => f.kind)).toEqual(['wager-exceeds-cap']);
  });

  it('collects flags from every round under the owning team', () => {
    const rounds = [standardRound('r1', ['q1', 'q2'], poolRules([1, 2]))];
    const entries = [entry('a', 'q1', 'correct', 2), entry('a', 'q2', 'correct', 2)];
    const result = standings({ teamIds: ['a', 'b'], rounds, entries, rules: allowNegative });
    const byTeam = Object.fromEntries(result.map((r) => [r.teamId, r.flags.length]));
    expect(byTeam).toEqual({ a: 1, b: 0 });
  });
});
