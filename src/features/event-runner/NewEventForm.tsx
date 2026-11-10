import { useCallback, useState, type FormEvent } from 'react';
import { newId } from '../../data';
import type { QuestionSnapshot, Quiz } from '../../domain';
import { errorMessage, useObserve, useRepository } from '../repository';
import { buildQuiz, PRESET_LABELS, type PresetId } from './presets';

const QUICK = 'quick';

export function NewEventForm({ onCreated }: { onCreated: (eventId: string) => void }) {
  const repo = useRepository();
  const saved = useObserve(useCallback((r) => r.quizzes.list(), []));
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [quizChoice, setQuizChoice] = useState(QUICK);
  const [preset, setPreset] = useState<PresetId>('classic');
  const [rounds, setRounds] = useState(5);
  const [questionsPerRound, setQuestionsPerRound] = useState(5);
  const [withFinal, setWithFinal] = useState(true);
  const [allowNegativeTotal, setAllowNegativeTotal] = useState(true);
  const [error, setError] = useState<string>();

  const savedQuizzes = saved.status === 'ready' ? saved.value : [];

  /** Quick nights use placeholder questions; saved quizzes bring their real text along. */
  async function chooseQuiz(): Promise<{ quiz: Quiz; questions?: QuestionSnapshot[] }> {
    if (quizChoice === QUICK) {
      return { quiz: buildQuiz({ preset, rounds, questionsPerRound, withFinal }) };
    }
    const quiz = await repo.quizzes.get(quizChoice);
    if (!quiz) throw new Error('That saved quiz no longer exists.');

    const bank = new Map((await repo.questions.list()).map((q) => [q.id, q]));
    const ids = quiz.rounds.flatMap((r) => r.questionIds);
    const missing = ids.filter((id) => !bank.has(id)).length;
    if (missing > 0) {
      throw new Error(
        `"${quiz.title}" uses ${missing} question(s) deleted from the bank. Build the quiz again in the Quiz builder.`,
      );
    }
    const questions = ids.flatMap((id) => {
      const q = bank.get(id);
      return q ? [{ id, text: q.text, answer: q.answer, difficulty: q.authorRating }] : [];
    });
    return { quiz, questions };
  }

  async function create() {
    const { quiz, questions } = await chooseQuiz();
    const event = await repo.events.save({
      id: newId(),
      updatedAt: new Date().toISOString(),
      quizId: quiz.id,
      venue: venue.trim(),
      date,
      status: 'live',
      rules: { allowNegativeTotal },
      quizSnapshot: quiz,
      questions,
    });
    onCreated(event.id);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    create().catch((err: unknown) => setError(errorMessage(err)));
  }

  return (
    <form onSubmit={submit} className="card form">
      <h2>New trivia night</h2>
      <label>
        Venue
        <input value={venue} onChange={(e) => setVenue(e.target.value)} required />
      </label>
      <label>
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label>
        Quiz
        <select value={quizChoice} onChange={(e) => setQuizChoice(e.target.value)}>
          <option value={QUICK}>Quick night (placeholder questions)</option>
          {savedQuizzes.map((quiz) => (
            <option key={quiz.id} value={quiz.id}>
              {quiz.title}
            </option>
          ))}
        </select>
      </label>
      {quizChoice === QUICK && (
        <>
          <label>
            Scoring
            <select value={preset} onChange={(e) => setPreset(e.target.value as PresetId)}>
              {(Object.keys(PRESET_LABELS) as PresetId[]).map((id) => (
                <option key={id} value={id}>
                  {PRESET_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
          <div className="row">
            <label>
              Rounds
              <input
                type="number"
                min={1}
                max={10}
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
              />
            </label>
            <label>
              Questions per round
              <input
                type="number"
                min={1}
                max={20}
                value={questionsPerRound}
                onChange={(e) => setQuestionsPerRound(Number(e.target.value))}
              />
            </label>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={withFinal}
              onChange={(e) => setWithFinal(e.target.checked)}
            />
            Add an all-or-nothing final question
          </label>
        </>
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={allowNegativeTotal}
          onChange={(e) => setAllowNegativeTotal(e.target.checked)}
        />
        Allow team totals to go below zero
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="primary">
        Start night
      </button>
    </form>
  );
}
