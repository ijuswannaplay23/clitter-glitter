import type { Entry, EventRules, QuizRound } from '../domain';
import { scoreFinalRound, scoreStandardRound } from './round';
import type { Flag } from './validate';

export interface StandingsInput {
  teamIds: string[];
  rounds: QuizRound[];
  entries: Entry[];
  rules: EventRules;
  /** Count only the first N rounds (for a mid-night scoreboard). Defaults to all. */
  roundsCounted?: number;
}

export interface TeamStanding {
  teamId: string;
  /** Points earned in each counted round, before any clamping. */
  roundPoints: number[];
  /** Running total after each counted round. */
  runningTotals: number[];
  total: number;
  /** Competition ranking: ties share a rank and the next rank is skipped (1, 1, 3). */
  rank: number;
  flags: Flag[];
}

function scoreTeam(input: StandingsInput, teamId: string): Omit<TeamStanding, 'rank'> {
  const mine = input.entries.filter((e) => e.teamId === teamId);
  const rounds = input.rounds.slice(0, input.roundsCounted ?? input.rounds.length);

  const roundPoints: number[] = [];
  const runningTotals: number[] = [];
  const flags: Flag[] = [];
  let total = 0;

  for (const round of rounds) {
    const result =
      round.kind === 'final'
        ? scoreFinalRound(mine, round.questionIds, round.rules, total)
        : scoreStandardRound(mine, round.questionIds, round.rules);
    total += result.points;
    if (!input.rules.allowNegativeTotal) total = Math.max(0, total);
    roundPoints.push(result.points);
    runningTotals.push(total);
    flags.push(...result.flags);
  }
  return { teamId, roundPoints, runningTotals, total, flags };
}

/** Derives every team's totals and rank from graded entries. Pure: nothing is stored. */
export function standings(input: StandingsInput): TeamStanding[] {
  const scored = input.teamIds.map((teamId) => scoreTeam(input, teamId));
  return scored
    .map((s) => ({ ...s, rank: 1 + scored.filter((o) => o.total > s.total).length }))
    .sort((a, b) => a.rank - b.rank);
}
