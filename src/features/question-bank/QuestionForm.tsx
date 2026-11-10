import { useState, type FormEvent } from 'react';
import type { Question, Theme } from '../../domain';
import { errorMessage } from '../repository';
import type { QuestionDraft } from './actions';
import { DIFFICULTIES, difficultyLabel } from './difficulty';

interface Props {
  themes: Theme[];
  initial?: Question | undefined;
  onSave: (draft: QuestionDraft) => Promise<void>;
  onCancel?: (() => void) | undefined;
}

export function QuestionForm({ themes, initial, onSave, onCancel }: Props) {
  const [text, setText] = useState(initial?.text ?? '');
  const [answer, setAnswer] = useState(initial?.answer ?? '');
  const [difficulty, setDifficulty] = useState(initial?.authorRating ?? 3);
  const [themeIds, setThemeIds] = useState<string[]>(initial?.themeIds ?? []);
  const [newThemes, setNewThemes] = useState('');
  const [error, setError] = useState<string>();

  const toggleTheme = (id: string) =>
    setThemeIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));

  async function save() {
    await onSave({
      text,
      answer,
      difficulty,
      themeIds,
      newThemeNames: newThemes.split(',').map((n) => n.trim()),
    });
    if (!initial) {
      // Keep the difficulty and themes: questions are usually entered in batches of one kind.
      setText('');
      setAnswer('');
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
      <label>
        Answer
        <input value={answer} onChange={(e) => setAnswer(e.target.value)} required />
      </label>
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
