import type { GameEvent } from '../../domain';
import { describeRound } from '../event-runner/presets';

export type WagerInfo =
  | { kind: 'none' }
  | { kind: 'range'; min: number; max: number }
  | { kind: 'pool'; values: number[] }
  | { kind: 'final' };

export interface SheetRow {
  number: number;
  /** Only when the host chose to print question text. Answers are never printed. */
  text?: string | undefined;
}

/** What one round's page looks like, before it is stamped out for a team. */
export interface SheetTemplate {
  roundId: string;
  title: string;
  rules: string;
  wager: WagerInfo;
  rows: SheetRow[];
}

export interface SheetPage {
  key: string;
  template: SheetTemplate;
  /** Empty for a blank sheet the team fills in themselves. */
  teamName: string;
}

/** `packet`: all of one team's pages together (staple them). `round`: hand out one round at a time. */
export type Arrangement = 'packet' | 'round';

export function sheetTemplates(event: GameEvent, includeText: boolean): SheetTemplate[] {
  const text = new Map((event.questions ?? []).map((q) => [q.id, q.text]));
  return event.quizSnapshot.rounds.map((round) => ({
    roundId: round.id,
    title: round.title,
    rules: describeRound(round),
    wager:
      round.kind === 'final'
        ? { kind: 'final' }
        : round.rules.wager.mode === 'none'
          ? { kind: 'none' }
          : round.rules.wager.mode === 'range'
            ? { kind: 'range', min: round.rules.wager.min, max: round.rules.wager.max }
            : { kind: 'pool', values: round.rules.wager.values },
    rows: round.questionIds.map((id, i) => ({
      number: i + 1,
      text: includeText ? text.get(id) : undefined,
    })),
  }));
}

const CROWDED_ROWS = 10;
const LONG_QUESTION = 110;

/** Rounds with many rows and a long question may not fit their row when question text is printed. */
export function hasCrowdedText(templates: SheetTemplate[]): boolean {
  return templates.some(
    (t) =>
      t.rows.length > CROWDED_ROWS && t.rows.some((r) => (r.text?.length ?? 0) > LONG_QUESTION),
  );
}

export function arrangeSheets(
  templates: SheetTemplate[],
  teamNames: string[],
  arrangement: Arrangement,
): SheetPage[] {
  const page = (template: SheetTemplate, teamIndex: number): SheetPage => ({
    key: `${teamIndex}-${template.roundId}`,
    template,
    teamName: teamNames[teamIndex] ?? '',
  });
  const teams = teamNames.map((_, i) => i);
  return arrangement === 'packet'
    ? teams.flatMap((t) => templates.map((template) => page(template, t)))
    : templates.flatMap((template) => teams.map((t) => page(template, t)));
}
