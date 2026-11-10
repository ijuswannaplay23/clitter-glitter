import type { Question } from '../../domain';

export type Curve = 'rising' | 'ramp';

export const CURVE_LABELS: Record<Curve, string> = {
  rising: 'Rising: the whole night gets harder, round by round',
  ramp: 'Ramp: every round climbs from easy to hard',
};

export interface DraftOptions {
  /** Empty means every theme. */
  themeIds: string[];
  rounds: number;
  questionsPerRound: number;
  withFinal: boolean;
  curve: Curve;
  random?: (() => number) | undefined;
}

export interface Draft {
  rounds: string[][];
  finalQuestionId?: string | undefined;
}

export type DraftResult =
  { ok: true; draft: Draft } | { ok: false; needed: number; available: number };

/** Approved questions in any of the chosen themes (all themes when none are chosen). */
export function eligibleQuestions(bank: Question[], themeIds: string[]): Question[] {
  const wanted = new Set(themeIds);
  return bank.filter(
    (q) =>
      q.status === 'approved' && (wanted.size === 0 || q.themeIds.some((id) => wanted.has(id))),
  );
}

/** Of the questions nearest the target difficulty, one picked at random. */
function closest(pool: Question[], target: number, random: () => number): Question | undefined {
  let best: Question[] = [];
  let bestDistance = Infinity;
  for (const q of pool) {
    const distance = Math.abs(q.authorRating - target);
    if (distance < bestDistance) {
      best = [q];
      bestDistance = distance;
    } else if (distance === bestDistance) {
      best.push(q);
    }
  }
  return best[Math.floor(random() * best.length)];
}

// Spreads `count` slots evenly over difficulty 1..5; a lone slot aims at the middle.
const targetFor = (index: number, count: number) =>
  count <= 1 ? 3 : 1 + (4 * index) / (count - 1);

/**
 * Fills each slot with the unused question nearest its target difficulty. The final question is
 * chosen first, as the hardest available, so earlier slots cannot use it up.
 */
export function draftQuiz(bank: Question[], options: DraftOptions): DraftResult {
  const pool = eligibleQuestions(bank, options.themeIds);
  const slots = options.rounds * options.questionsPerRound;
  const needed = slots + (options.withFinal ? 1 : 0);
  if (pool.length < needed) return { ok: false, needed, available: pool.length };

  const random = options.random ?? Math.random;
  const remaining = [...pool];
  const take = (target: number): string => {
    const q = closest(remaining, target, random);
    if (!q) throw new Error('No question left to draft; the pool was checked to be large enough.');
    remaining.splice(remaining.indexOf(q), 1);
    return q.id;
  };

  const finalQuestionId = options.withFinal ? take(5) : undefined;
  const rounds = Array.from({ length: options.rounds }, (_, r) =>
    Array.from({ length: options.questionsPerRound }, (_, k) =>
      take(
        options.curve === 'ramp'
          ? targetFor(k, options.questionsPerRound)
          : targetFor(r * options.questionsPerRound + k, slots),
      ),
    ),
  );
  return { ok: true, draft: { rounds, finalQuestionId } };
}

/** A different unused question of the nearest difficulty, or undefined when none is left. */
export function swapCandidate(
  bank: Question[],
  themeIds: string[],
  current: Question,
  usedIds: ReadonlySet<string>,
  random: () => number = Math.random,
): Question | undefined {
  const unused = eligibleQuestions(bank, themeIds).filter((q) => !usedIds.has(q.id));
  return closest(unused, current.authorRating, random);
}
