import type { Entry, FinalRules, QuizRound, RoundRules } from '../domain';

const STAMP = '2026-01-01T00:00:00.000Z';

export const classic: RoundRules = { baseValue: 1, wager: { mode: 'none' }, onWrong: 'zero' };

export function poolRules(values: number[], onWrong: RoundRules['onWrong'] = 'loseWager') {
  const rules: RoundRules = { baseValue: 1, wager: { mode: 'pool', values }, onWrong };
  return rules;
}

export function rangeRules(min: number, max: number, onWrong: RoundRules['onWrong'] = 'loseWager') {
  const rules: RoundRules = { baseValue: 1, wager: { mode: 'range', min, max }, onWrong };
  return rules;
}

export function questionIds(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);
}

let seq = 0;
export function entry(
  teamId: string,
  questionId: string,
  state: Entry['state'],
  wager?: number,
): Entry {
  seq += 1;
  return {
    id: `entry-${seq}`,
    eventId: 'event-1',
    teamId,
    questionId,
    state,
    wager,
    gradedAt: STAMP,
    updatedAt: STAMP,
  };
}

export function standardRound(id: string, ids: string[], rules: RoundRules): QuizRound {
  return { kind: 'standard', id, title: id, rules, questionIds: ids };
}

export function finalRound(id: string, questionId: string, rules: FinalRules): QuizRound {
  return { kind: 'final', id, title: id, rules, questionIds: [questionId] };
}
