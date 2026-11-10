import type { QuestionSnapshot, QuizRound } from '../../domain';
import { difficultyLabel } from '../question-bank/difficulty';

/** The host's cue card: this round's questions with their answers. The answer never reaches the projector. */
export function RoundQuestions({
  round,
  questions,
  projectedId,
  onProject,
}: {
  round: QuizRound;
  questions: QuestionSnapshot[] | undefined;
  projectedId: string | undefined;
  onProject: (questionId: string | undefined) => void;
}) {
  if (!questions) return null;
  const byId = new Map(questions.map((q) => [q.id, q]));

  return (
    <details className="cue-card" open>
      <summary>Questions and answers (host only)</summary>
      <ol>
        {round.questionIds.map((id, i) => {
          const q = byId.get(id);
          const projected = projectedId === id;
          return (
            <li key={id}>
              {q ? (
                <>
                  <span>{q.text}</span> <strong>{q.answer}</strong>{' '}
                  <span className="chip">{difficultyLabel(q.difficulty)}</span>{' '}
                  <button
                    type="button"
                    aria-pressed={projected}
                    aria-label={`${projected ? 'Stop showing' : 'Show'} question ${i + 1} on projector`}
                    onClick={() => onProject(projected ? undefined : id)}
                  >
                    {projected ? 'Showing — back to scores' : 'Show on projector'}
                  </button>
                </>
              ) : (
                <span className="hint">(question text was not saved with this night)</span>
              )}
            </li>
          );
        })}
      </ol>
    </details>
  );
}
