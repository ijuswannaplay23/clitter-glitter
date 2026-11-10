import type { GameEvent } from '../../domain';

/** Number of rounds the projector should count. */
export function roundsShown(event: GameEvent): number {
  const total = event.quizSnapshot.rounds.length;
  return Math.min(event.scoreboardRounds ?? total, total);
}

export function scoreboardTitle(event: GameEvent): string {
  if (event.scoreboardRounds === undefined) return 'Live standings';
  const last = event.quizSnapshot.rounds[roundsShown(event) - 1];
  return last ? `Standings after ${last.title}` : '';
}

export interface ProjectedQuestion {
  roundTitle: string;
  number: number;
  of: number;
  text: string;
  choices?: string[] | undefined;
}

/** What the room should read, or undefined to show the scoreboard. Carries no answer by design. */
export function projectedQuestion(event: GameEvent): ProjectedQuestion | undefined {
  const id = event.projectorQuestionId;
  if (id === undefined) return undefined;
  const question = event.questions?.find((q) => q.id === id);
  const round = event.quizSnapshot.rounds.find((r) => r.questionIds.includes(id));
  if (!question || !round) return undefined;
  return {
    roundTitle: round.title,
    number: round.questionIds.indexOf(id) + 1,
    of: round.questionIds.length,
    text: question.text,
    choices: question.choices,
  };
}
