import { describe, expect, it } from 'vitest';
import { buildQuiz, describeRound } from './presets';

describe('buildQuiz', () => {
  it('classic: N rounds of Q unique placeholder questions with no wagers', () => {
    const quiz = buildQuiz({
      preset: 'classic',
      rounds: 3,
      questionsPerRound: 4,
      withFinal: false,
    });
    expect(quiz.rounds).toHaveLength(3);
    const ids = quiz.rounds.flatMap((r) => r.questionIds);
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
    for (const round of quiz.rounds) {
      expect(round.kind).toBe('standard');
      if (round.kind === 'standard') expect(round.rules.wager).toEqual({ mode: 'none' });
    }
  });

  it('escalating: round k offers the values k..k+Q-1 and loses the wager on a miss', () => {
    const quiz = buildQuiz({
      preset: 'escalating',
      rounds: 2,
      questionsPerRound: 3,
      withFinal: false,
    });
    const pools = quiz.rounds.map((r) =>
      r.kind === 'standard' && r.rules.wager.mode === 'pool' ? r.rules.wager.values : null,
    );
    expect(pools).toEqual([
      [1, 2, 3],
      [2, 3, 4],
    ]);
    expect(quiz.rounds[0]?.kind === 'standard' && quiz.rounds[0].rules.onWrong).toBe('loseWager');
  });

  it('withFinal appends a single-question final capped at the current score', () => {
    const quiz = buildQuiz({ preset: 'classic', rounds: 1, questionsPerRound: 2, withFinal: true });
    const last = quiz.rounds.at(-1);
    expect(last?.kind).toBe('final');
    expect(last?.questionIds).toHaveLength(1);
    expect(last?.kind === 'final' && last.rules.wagerCap).toBe('currentScore');
  });
});

describe('describeRound', () => {
  it('summarizes each round type in plain words', () => {
    const quiz = buildQuiz({
      preset: 'escalating',
      rounds: 1,
      questionsPerRound: 2,
      withFinal: true,
    });
    const [standard, final] = quiz.rounds;
    expect(standard && describeRound(standard)).toBe(
      'Wager each of 1, 2 at most once; skipping a value is fine. Wrong loses the wager.',
    );
    expect(final && describeRound(final)).toContain('current score');
  });
});
