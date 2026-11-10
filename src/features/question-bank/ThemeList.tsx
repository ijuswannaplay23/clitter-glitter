import { useState } from 'react';
import type { Question, Theme } from '../../domain';
import { errorMessage, useRepository } from '../repository';
import { deleteTheme, renameTheme } from './actions';

export function ThemeList({ themes, questions }: { themes: Theme[]; questions: Question[] }) {
  const repo = useRepository();
  const [error, setError] = useState<string>();

  function run(action: Promise<unknown>) {
    setError(undefined);
    action.catch((err: unknown) => setError(errorMessage(err)));
  }

  function rename(theme: Theme) {
    const name = window.prompt('Rename theme', theme.name)?.trim();
    if (name && name !== theme.name) run(renameTheme(repo, theme, name));
  }

  function remove(theme: Theme, uses: number) {
    const effect =
      uses > 0 ? ` It will be taken off ${uses} question${uses === 1 ? '' : 's'}.` : '';
    if (window.confirm(`Delete the theme "${theme.name}"?${effect}`)) run(deleteTheme(repo, theme));
  }

  if (themes.length === 0) return null;
  const sorted = [...themes].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="card" aria-labelledby="themes-title">
      <h2 id="themes-title">Themes</h2>
      {error && <p role="alert">{error}</p>}
      <ul className="events">
        {sorted.map((theme) => {
          const uses = questions.filter((q) => q.themeIds.includes(theme.id)).length;
          return (
            <li key={theme.id} className="row">
              <span>
                {theme.name} <span className="hint">({uses})</span>
              </span>
              <button
                type="button"
                aria-label={`Rename ${theme.name}`}
                onClick={() => rename(theme)}
              >
                Rename
              </button>
              <button
                type="button"
                aria-label={`Delete theme ${theme.name}`}
                onClick={() => remove(theme, uses)}
              >
                Delete
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
