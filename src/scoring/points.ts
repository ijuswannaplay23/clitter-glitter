import type { Entry, FinalRules, OnWrong, RoundRules } from '../domain';

// `0 - x` rather than `-x` so a zero loss is +0, not -0 (Object.is distinguishes them).
function lossOnWrong(onWrong: OnWrong | FinalRules['onWrong'], wager: number | null): number {
  if (typeof onWrong === 'object') return 0 - onWrong.flatPenalty;
  if (wager === null) return 0;
  switch (onWrong) {
    case 'zero':
      return 0;
    case 'loseWager':
      return 0 - wager;
    case 'loseHalfWager':
      return 0 - Math.floor(wager / 2);
  }
}

/** Points one entry earns in a standard round. Behavior: docs/SPEC.md §5. */
export function points(entry: Entry, rules: RoundRules, questionIndex: number): number {
  if (entry.state === 'blank') return 0;

  const wagered = rules.wager.mode !== 'none';
  const wager = wagered ? (entry.wager ?? 0) : null;
  const value = wager ?? rules.baseValue * (rules.questionWeights?.[questionIndex] ?? 1);

  return entry.state === 'correct' ? value : lossOnWrong(rules.onWrong, wager);
}

/** Points for the final question. The wager is taken as written; cap violations are flagged elsewhere. */
export function finalPoints(entry: Entry, rules: FinalRules): number {
  if (entry.state === 'blank') return 0;
  const wager = entry.wager ?? 0;
  return entry.state === 'correct' ? wager : lossOnWrong(rules.onWrong, wager);
}
