import { describe, expect, it } from 'vitest';
import type { Question } from '../../domain';
import { draftQuiz, eligibleQuestions, swapCandidate, type DraftOptions } from './draft';

/** Small deterministic generator so drafts are repeatable. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let counter = 0;
const q = (
  rating: number,
  themeIds: string[] = [],
  status: Question['status'] = 'approved',
): Question => ({
  id: `q${++counter}`,
  updatedAt: '2026-01-01T00:00:00.000Z',
  text: `Question ${counter}`,
  answer: 'A',
  authorRating: rating,
  themeIds,
  status,
});

/** `perLevel` questions at each difficulty from 1 to 5. */
const bank = (perLevel: number, themeIds: string[] = []) =>
  [1, 2, 3, 4, 5].flatMap((rating) => Array.from({ length: perLevel }, () => q(rating, themeIds)));

const options = (over: Partial<DraftOptions> = {}): DraftOptions => ({
  themeIds: [],
  rounds: 5,
  questionsPerRound: 4,
  withFinal: true,
  curve: 'rising',
  random: seeded(1),
  ...over,
});

function ok(result: ReturnType<typeof draftQuiz>) {
  if (!result.ok) throw new Error('expected a draft');
  return result.draft;
}

const ratingsOf = (ids: string[], questions: Question[]) =>
  ids.map((id) => questions.find((x) => x.id === id)?.authorRating ?? 0);
const average = (n: number[]) => n.reduce((a, b) => a + b, 0) / n.length;

describe('draftQuiz', () => {
  it('fills every round and the final with distinct questions', () => {
    const questions = bank(8);
    const draft = ok(draftQuiz(questions, options()));
    const ids = [...draft.rounds.flat(), draft.finalQuestionId];
    expect(draft.rounds.map((r) => r.length)).toEqual([4, 4, 4, 4, 4]);
    expect(ids).toHaveLength(21);
    expect(new Set(ids).size).toBe(21);
  });

  it('rising: each round is harder on average than the one before, and the final is hardest', () => {
    const questions = bank(8);
    const draft = ok(draftQuiz(questions, options()));
    const averages = draft.rounds.map((r) => average(ratingsOf(r, questions)));
    for (let i = 1; i < averages.length; i++) {
      expect(averages[i]).toBeGreaterThan(averages[i - 1] ?? 0);
    }
    expect(ratingsOf([draft.finalQuestionId ?? ''], questions)).toEqual([5]);
  });

  it('ramp: every round climbs from easy to hard', () => {
    const questions = bank(8);
    const draft = ok(draftQuiz(questions, options({ curve: 'ramp' })));
    for (const round of draft.rounds) {
      const ratings = ratingsOf(round, questions);
      expect([...ratings].sort((a, b) => a - b)).toEqual(ratings);
      expect(ratings[0]).toBe(1);
      expect(ratings.at(-1)).toBe(5);
    }
  });

  it('keeps the final the hardest even when the other slots want the same questions', () => {
    const questions = [q(5), q(1), q(2), q(3), q(4)];
    const draft = ok(
      draftQuiz(questions, options({ rounds: 2, questionsPerRound: 2, withFinal: true })),
    );
    expect(draft.finalQuestionId).toBe(questions[0]?.id);
  });

  it('omits the final when not wanted', () => {
    const draft = ok(draftQuiz(bank(8), options({ withFinal: false })));
    expect(draft.finalQuestionId).toBeUndefined();
  });

  it('draws only from the chosen themes and ignores pending questions', () => {
    const movies = bank(5, ['movies']);
    const music = bank(5, ['music']);
    const pending = [q(3, ['movies'], 'pending')];
    const draft = ok(
      draftQuiz([...movies, ...music, ...pending], options({ themeIds: ['movies'], rounds: 2 })),
    );
    const used = new Set([...draft.rounds.flat(), draft.finalQuestionId]);
    for (const question of [...music, ...pending]) expect(used.has(question.id)).toBe(false);
  });

  it('reports how many are needed and available when the bank is too small', () => {
    const result = draftQuiz(bank(1), options());
    expect(result).toEqual({ ok: false, needed: 21, available: 5 });
  });

  it('is repeatable for the same seed and varies between seeds', () => {
    const questions = bank(8);
    const run = (seed: number) => ok(draftQuiz(questions, options({ random: seeded(seed) })));
    expect(run(7)).toEqual(run(7));
    expect(run(7)).not.toEqual(run(8));
  });
});

describe('eligibleQuestions', () => {
  it('treats an empty theme list as every theme', () => {
    const questions = [q(1, ['a']), q(2, ['b']), q(3)];
    expect(eligibleQuestions(questions, [])).toHaveLength(3);
    expect(eligibleQuestions(questions, ['a', 'b'])).toHaveLength(2);
  });
});

describe('swapCandidate', () => {
  it('offers an unused question of the nearest difficulty', () => {
    const current = q(3);
    const near = q(3);
    const far = q(1);
    const result = swapCandidate([current, near, far], [], current, new Set([current.id]));
    expect(result?.id).toBe(near.id);
  });

  it('falls back to the next-nearest difficulty and never offers a used question', () => {
    const current = q(3);
    const used = q(3);
    const next = q(4);
    const result = swapCandidate(
      [current, used, next],
      [],
      current,
      new Set([current.id, used.id]),
    );
    expect(result?.id).toBe(next.id);
  });

  it('returns undefined when nothing else is available', () => {
    const only = q(3);
    expect(swapCandidate([only], [], only, new Set([only.id]))).toBeUndefined();
  });
});
