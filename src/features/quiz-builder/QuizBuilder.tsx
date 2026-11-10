import { useCallback, useState } from 'react';
import type { Question, Quiz } from '../../domain';
import { assembleQuiz, PRESET_LABELS, type PresetId } from '../event-runner/presets';
import { difficultyLabel } from '../question-bank/difficulty';
import { errorMessage, useObserve, useRepository } from '../repository';
import {
  CURVE_LABELS,
  draftQuiz,
  eligibleQuestions,
  swapCandidate,
  type Curve,
  type Draft,
} from './draft';

export function QuizBuilder() {
  const repo = useRepository();
  const questions = useObserve(useCallback((r) => r.questions.list(), []));
  const themes = useObserve(useCallback((r) => r.themes.list(), []));
  const quizzes = useObserve(useCallback((r) => r.quizzes.list(), []));

  const [title, setTitle] = useState('Trivia night');
  const [themeIds, setThemeIds] = useState<string[]>([]);
  const [rounds, setRounds] = useState(5);
  const [questionsPerRound, setQuestionsPerRound] = useState(5);
  const [withFinal, setWithFinal] = useState(true);
  const [curve, setCurve] = useState<Curve>('rising');
  const [preset, setPreset] = useState<PresetId>('classic');
  const [draft, setDraft] = useState<Draft>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const failed = [questions, themes, quizzes].find((o) => o.status === 'error');
  if (failed?.status === 'error') return <p role="alert">{errorMessage(failed.error)}</p>;
  if (questions.status !== 'ready' || themes.status !== 'ready' || quizzes.status !== 'ready') {
    return <p>Loading…</p>;
  }

  const bank = questions.value;
  const byId = new Map(bank.map((q) => [q.id, q]));
  const eligible = eligibleQuestions(bank, themeIds).length;
  const needed = rounds * questionsPerRound + (withFinal ? 1 : 0);

  const toggleTheme = (id: string) =>
    setThemeIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));

  function generate() {
    setError(undefined);
    setMessage(undefined);
    const result = draftQuiz(bank, { themeIds, rounds, questionsPerRound, withFinal, curve });
    if (result.ok) setDraft(result.draft);
    else {
      setDraft(undefined);
      setError(
        `Not enough questions: this quiz needs ${result.needed} but only ${result.available} match. Add questions, pick more themes, or shrink the quiz.`,
      );
    }
  }

  function swap(slot: { round: number; index: number } | 'final') {
    if (!draft) return;
    const id = slot === 'final' ? draft.finalQuestionId : draft.rounds[slot.round]?.[slot.index];
    const current = id ? byId.get(id) : undefined;
    if (!current) return;
    const used = new Set([...draft.rounds.flat(), draft.finalQuestionId ?? '']);
    const next = swapCandidate(bank, themeIds, current, used);
    if (!next) {
      setError('No other unused question is available for this slot.');
      return;
    }
    setError(undefined);
    setDraft(
      slot === 'final'
        ? { ...draft, finalQuestionId: next.id }
        : {
            ...draft,
            rounds: draft.rounds.map((ids, r) =>
              r === slot.round
                ? ids.map((existing, i) => (i === slot.index ? next.id : existing))
                : ids,
            ),
          },
    );
  }

  async function save() {
    if (!draft) return;
    const ids = [...draft.rounds.flat(), ...(draft.finalQuestionId ? [draft.finalQuestionId] : [])];
    const missing = ids.filter((id) => !byId.has(id)).length;
    if (missing > 0) {
      throw new Error(
        `${missing} question(s) in this draft were deleted from the bank. Draft again.`,
      );
    }
    const quiz = await repo.quizzes.save(
      assembleQuiz({
        title: title.trim() || 'Untitled quiz',
        preset,
        rounds: draft.rounds,
        finalQuestionId: draft.finalQuestionId,
      }),
    );
    setDraft(undefined);
    setMessage(`Saved "${quiz.title}". Pick it when you start a night.`);
  }

  function run(action: Promise<unknown>) {
    setError(undefined);
    action.catch((err: unknown) => setError(errorMessage(err)));
  }

  function removeQuiz(quiz: Quiz) {
    if (
      window.confirm(`Delete the quiz "${quiz.title}"? Nights already played keep their own copy.`)
    ) {
      run(repo.quizzes.remove(quiz.id));
    }
  }

  const sortedThemes = [...themes.value].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="builder">
      <section className="card form" aria-labelledby="builder-title">
        <h2 id="builder-title">Build a quiz</h2>
        <label>
          Quiz title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <fieldset>
          <legend>Themes (none picked = every theme)</legend>
          {sortedThemes.length === 0 && (
            <p className="hint">No themes yet. Add some in the question bank.</p>
          )}
          <div className="chips">
            {sortedThemes.map((theme) => (
              <label key={theme.id} className="check chip-option">
                <input
                  type="checkbox"
                  checked={themeIds.includes(theme.id)}
                  onChange={() => toggleTheme(theme.id)}
                />
                {theme.name}
              </label>
            ))}
          </div>
        </fieldset>
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
          End with an all-or-nothing final question (the hardest one)
        </label>
        <label>
          Difficulty curve
          <select value={curve} onChange={(e) => setCurve(e.target.value as Curve)}>
            {(Object.keys(CURVE_LABELS) as Curve[]).map((id) => (
              <option key={id} value={id}>
                {CURVE_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
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
        <p className="hint">
          Needs {needed} questions; {eligible} in the bank match.
        </p>
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        <div className="row">
          <button type="button" className="primary" onClick={generate}>
            {draft ? 'Redraft' : 'Draft quiz'}
          </button>
        </div>
      </section>

      {draft && (
        <section className="card" aria-labelledby="draft-title">
          <h2 id="draft-title">Draft</h2>
          {draft.rounds.map((ids, r) => (
            <div key={r}>
              <h3>Round {r + 1}</h3>
              <ol className="draft-list">
                {ids.map((id, index) => (
                  <DraftRow
                    key={id}
                    question={byId.get(id)}
                    onSwap={() => swap({ round: r, index })}
                  />
                ))}
              </ol>
            </div>
          ))}
          {draft.finalQuestionId && (
            <div>
              <h3>Final question</h3>
              <ol className="draft-list">
                <DraftRow question={byId.get(draft.finalQuestionId)} onSwap={() => swap('final')} />
              </ol>
            </div>
          )}
          <button type="button" className="primary" onClick={() => run(save())}>
            Save quiz
          </button>
        </section>
      )}

      <section className="card" aria-labelledby="saved-title">
        <h2 id="saved-title">Saved quizzes</h2>
        {quizzes.value.length === 0 ? (
          <p className="hint">Nothing saved yet.</p>
        ) : (
          <ul className="events">
            {quizzes.value.map((quiz) => (
              <li key={quiz.id} className="row">
                <span>
                  {quiz.title}{' '}
                  <span className="hint">
                    ({quiz.rounds.filter((r) => r.kind === 'standard').length} rounds,{' '}
                    {quiz.rounds.reduce((n, r) => n + r.questionIds.length, 0)} questions)
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Delete quiz ${quiz.title}`}
                  onClick={() => removeQuiz(quiz)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DraftRow({ question, onSwap }: { question: Question | undefined; onSwap: () => void }) {
  if (!question) return <li className="hint">(question no longer in the bank)</li>;
  return (
    <li>
      <span>{question.text}</span> <strong>{question.answer}</strong>{' '}
      <span className="chip">{difficultyLabel(question.authorRating)}</span>{' '}
      <button type="button" aria-label={`Swap: ${question.text}`} onClick={onSwap}>
        Swap
      </button>
    </li>
  );
}
