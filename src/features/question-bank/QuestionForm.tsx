import { useState, type FormEvent } from 'react';
import { MAX_CHOICES, MIN_CHOICES, type Question, type Theme } from '../../domain';
import { errorMessage } from '../repository';
import type { QuestionDraft } from './actions';
import { choiceLetter } from './choices';
import { DIFFICULTIES, difficultyLabel } from './difficulty';

const blankChoices = () => ['', '', '', ''];

interface Props {
  themes: Theme[];
  initial?: Question | undefined;
  onSave: (draft: QuestionDraft) => Promise<void>;
  onCancel?: (() => void) | undefined;
}

export function QuestionForm({ themes, initial, onSave, onCancel }: Props) {
  const [text, setText] = useState(initial?.text ?? '');
  const [answer, setAnswer] = useState(initial?.answer ?? '');
  const [multipleChoice, setMultipleChoice] = useState(initial?.choices !== undefined);
  const [choices, setChoices] = useState<string[]>(initial?.choices ?? blankChoices());
  const [correct, setCorrect] = useState<number | undefined>(() => {
    const index = initial?.choices?.indexOf(initial.answer);
    return index === undefined || index < 0 ? undefined : index;
  });
  const [difficulty, setDifficulty] = useState(initial?.authorRating ?? 3);
  const [themeIds, setThemeIds] = useState<string[]>(initial?.themeIds ?? []);
  const [newThemes, setNewThemes] = useState('');
  const [error, setError] = useState<string>();

  const toggleTheme = (id: string) =>
    setThemeIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));

  const editChoice = (index: number, value: string) =>
    setChoices((all) => all.map((c, i) => (i === index ? value : c)));

  function removeChoice(index: number) {
    setChoices((all) => all.filter((_, i) => i !== index));
    setCorrect((c) => (c === undefined || c === index ? undefined : c > index ? c - 1 : c));
  }

  async function save() {
    await onSave({
      text,
      answer,
      choices: multipleChoice ? choices : undefined,
      correctIndex: correct,
      difficulty,
      themeIds,
      newThemeNames: newThemes.split(',').map((n) => n.trim()),
    });
    if (!initial) {
      // Keep the difficulty, themes and question type: questions are usually entered in batches of one kind.
      setText('');
      setAnswer('');
      setChoices(blankChoices());
      setCorrect(undefined);
      setNewThemes('');
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    save().catch((err: unknown) => setError(errorMessage(err)));
  }

  return (
    <form onSubmit={submit} className="card form">
      <h2>{initial ? 'Edit question' : 'Add a question'}</h2>
      <label>
        Question
        <textarea value={text} onChange={(e) => setText(e.target.value)} required rows={2} />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={multipleChoice}
          onChange={(e) => setMultipleChoice(e.target.checked)}
        />
        Multiple choice
      </label>
      {multipleChoice ? (
        <fieldset>
          <legend>Choices (select the correct one)</legend>
          {choices.map((choice, i) => (
            <div key={i} className="row choice-row">
              <input
                type="radio"
                name="correct-choice"
                aria-label={`Choice ${choiceLetter(i)} is correct`}
                checked={correct === i}
                onChange={() => setCorrect(i)}
              />
              <span className="choice-letter">{choiceLetter(i)}</span>
              <input
                aria-label={`Choice ${choiceLetter(i)}`}
                value={choice}
                onChange={(e) => editChoice(i, e.target.value)}
                required
              />
              {choices.length > MIN_CHOICES && (
                <button
                  type="button"
                  className="link"
                  aria-label={`Remove choice ${choiceLetter(i)}`}
                  onClick={() => removeChoice(i)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {choices.length < MAX_CHOICES && (
            <div>
              <button type="button" onClick={() => setChoices((all) => [...all, ''])}>
                Add a choice
              </button>
            </div>
          )}
        </fieldset>
      ) : (
        <label>
          Answer
          <input value={answer} onChange={(e) => setAnswer(e.target.value)} required />
        </label>
      )}
      <label>
        Difficulty
        <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d} · {difficultyLabel(d)}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Themes</legend>
        {themes.length === 0 && <p className="hint">No themes yet. Add one below.</p>}
        <div className="chips">
          {themes.map((theme) => (
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
        <label>
          New themes (separate with commas)
          <input value={newThemes} onChange={(e) => setNewThemes(e.target.value)} />
        </label>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <div className="row">
        <button type="submit" className="primary">
          {initial ? 'Save changes' : 'Add question'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
