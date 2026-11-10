import { newId } from '../../data';
import type { FinalRules, Quiz, QuizRound, RoundRules } from '../../domain';

export type PresetId = 'classic' | 'escalating';

export const PRESET_LABELS: Record<PresetId, string> = {
  classic: 'Classic: 1 point per correct answer, no wagers',
  escalating: 'Escalating wagers: each round wagers a rising set of values, wrong loses the wager',
};

export interface QuizOptions {
  preset: PresetId;
  rounds: number;
  questionsPerRound: number;
  withFinal: boolean;
}

export const FINAL_RULES: FinalRules = {
  wagerCap: 'currentScore',
  allowOptOut: true,
  onWrong: 'loseWager',
};

export function standardRules(
  preset: PresetId,
  roundNumber: number,
  questions: number,
): RoundRules {
  if (preset === 'classic') {
    return { baseValue: 1, wager: { mode: 'none' }, onWrong: 'zero' };
  }
  return {
    baseValue: 1,
    // Round k offers the values k..k+questions-1, so stakes rise each round.
    wager: {
      mode: 'pool',
      values: Array.from({ length: questions }, (_, i) => roundNumber + i),
    },
    onWrong: 'loseWager',
  };
}

interface QuizParts {
  title: string;
  preset: PresetId;
  /** Question ids for each standard round, in order. */
  rounds: string[][];
  finalQuestionId?: string | undefined;
}

export function assembleQuiz(parts: QuizParts): Quiz {
  const rounds: QuizRound[] = parts.rounds.map((questionIds, i) => ({
    kind: 'standard',
    id: newId(),
    title: `Round ${i + 1}`,
    questionIds,
    rules: standardRules(parts.preset, i + 1, questionIds.length),
  }));
  if (parts.finalQuestionId !== undefined) {
    rounds.push({
      kind: 'final',
      id: newId(),
      title: 'Final question',
      questionIds: [parts.finalQuestionId],
      rules: FINAL_RULES,
    });
  }
  return { id: newId(), updatedAt: new Date().toISOString(), title: parts.title, rounds };
}

/** A runnable quiz with placeholder questions: the host reads the real ones from their own source. */
export function buildQuiz(options: QuizOptions): Quiz {
  return assembleQuiz({
    title: `${options.rounds}-round ${options.preset} quiz`,
    preset: options.preset,
    rounds: Array.from({ length: options.rounds }, () =>
      Array.from({ length: options.questionsPerRound }, newId),
    ),
    finalQuestionId: options.withFinal ? newId() : undefined,
  });
}

export function describeRound(round: QuizRound): string {
  if (round.kind === 'final') {
    const { wagerCap } = round.rules;
    const cap =
      wagerCap === 'currentScore' ? "up to the team's current score" : `up to ${wagerCap.fixed}`;
    return `Final: wager ${cap}. Correct wins the wager; wrong ${
      round.rules.onWrong === 'loseWager' ? 'loses it' : 'loses half of it'
    }.`;
  }
  const { wager, onWrong, baseValue } = round.rules;
  if (wager.mode === 'none') {
    return `${baseValue} point per correct answer.`;
  }
  const allowed =
    wager.mode === 'range'
      ? `Wager ${wager.min} to ${wager.max} per question.`
      : `Wager each of ${wager.values.join(', ')} at most once; skipping a value is fine.`;
  const loss =
    onWrong === 'loseWager'
      ? 'Wrong loses the wager.'
      : onWrong === 'loseHalfWager'
        ? 'Wrong loses half the wager.'
        : onWrong === 'zero'
          ? 'Wrong scores nothing.'
          : `Wrong loses ${onWrong.flatPenalty}.`;
  return `${allowed} ${loss}`;
}
