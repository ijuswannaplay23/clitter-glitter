import type { Entry, FinalRules, RoundRules } from '../domain';
import { finalPoints, points } from './points';
import { type Flag, validateFinalWager, validateRoundWagers } from './validate';

export interface RoundResult {
  points: number;
  flags: Flag[];
}

/**
 * One team's live entries for a round: drops other questions and soft-deleted rows, and keeps the
 * most recently updated row when a question has been graded twice.
 */
function liveEntries(entries: Entry[], questionIds: string[]): { entries: Entry[]; flags: Flag[] } {
  const byQuestion = new Map<string, Entry[]>();
  for (const e of entries) {
    if (e.deletedAt !== undefined || !questionIds.includes(e.questionId)) continue;
    byQuestion.set(e.questionId, [...(byQuestion.get(e.questionId) ?? []), e]);
  }

  const kept: Entry[] = [];
  const flags: Flag[] = [];
  for (const group of byQuestion.values()) {
    const sorted = [...group].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const [latest] = sorted;
    if (!latest) continue;
    kept.push(latest);
    if (group.length > 1) {
      flags.push({
        kind: 'duplicate-entry',
        teamId: latest.teamId,
        entryIds: group.map((e) => e.id),
        message: 'Question was graded more than once; the latest entry is used.',
      });
    }
  }
  return { entries: kept, flags };
}

/** `entries` must all belong to one team. */
export function scoreStandardRound(
  entries: Entry[],
  questionIds: string[],
  rules: RoundRules,
): RoundResult {
  const live = liveEntries(entries, questionIds);
  const total = live.entries.reduce(
    (sum, e) => sum + points(e, rules, questionIds.indexOf(e.questionId)),
    0,
  );
  return { points: total, flags: [...live.flags, ...validateRoundWagers(live.entries, rules)] };
}

/** `entries` must all belong to one team; `scoreBefore` is the team's running total before the final. */
export function scoreFinalRound(
  entries: Entry[],
  questionIds: string[],
  rules: FinalRules,
  scoreBefore: number,
): RoundResult {
  const live = liveEntries(entries, questionIds);
  const total = live.entries.reduce((sum, e) => sum + finalPoints(e, rules), 0);
  return {
    points: total,
    flags: [...live.flags, ...validateFinalWager(live.entries, rules, scoreBefore)],
  };
}
