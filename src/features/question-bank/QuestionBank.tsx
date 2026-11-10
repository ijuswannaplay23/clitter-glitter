import { useCallback, useMemo, useState } from 'react';
import type { Question } from '../../domain';
import { errorMessage, useObserve, useRepository } from '../repository';
import { saveQuestionDraft, type QuestionDraft } from './actions';
import { DIFFICULTIES, difficultyLabel } from './difficulty';
import { ImportExport } from './ImportExport';
import { QuestionForm } from './QuestionForm';
import { ThemeList } from './ThemeList';

export function QuestionBank() {
  const repo = useRepository();
  const questions = useObserve(useCallback((r) => r.questions.list(), []));
  const themes = useObserve(useCallback((r) => r.themes.list(), []));
  const [editing, setEditing] = useState<Question>();
  const [search, setSearch] = useState('');
  const [themeFilter, setThemeFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [actionError, setActionError] = useState<string>();

  const questionRows = questions.status === 'ready' ? questions.value : undefined;
  const themeRows = themes.status === 'ready' ? themes.value : undefined;

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (questionRows ?? [])
      .filter((q) => themeFilter === 'all' || q.themeIds.includes(themeFilter))
      .filter((q) => difficultyFilter === 'all' || q.authorRating === Number(difficultyFilter))
      .filter((q) => needle === '' || `${q.text} ${q.answer}`.toLowerCase().includes(needle))
      .sort((a, b) => a.authorRating - b.authorRating || a.text.localeCompare(b.text));
  }, [questionRows, search, themeFilter, difficultyFilter]);

  const failed = [questions, themes].find((o) => o.status === 'error');
  if (failed?.status === 'error') return <p role="alert">{errorMessage(failed.error)}</p>;
  if (!questionRows || !themeRows) return <p>Loading…</p>;

  const themeNames = new Map(themeRows.map((t) => [t.id, t.name]));

  async function save(draft: QuestionDraft) {
    await saveQuestionDraft(repo, draft, editing);
    setEditing(undefined);
  }

  function remove(question: Question) {
    if (!window.confirm(`Delete this question?\n\n${question.text}`)) return;
    setActionError(undefined);
    repo.questions.remove(question.id).catch((err: unknown) => setActionError(errorMessage(err)));
  }

  return (
    <div className="bank">
      <QuestionForm
        key={editing?.id ?? 'new'}
        themes={themeRows}
        initial={editing}
        onSave={save}
        onCancel={editing ? () => setEditing(undefined) : undefined}
      />

      <section className="card" aria-labelledby="questions-title">
        <h2 id="questions-title">
          Questions <span className="hint">({questionRows.length})</span>
        </h2>
        <div className="row filters">
          <label>
            Search
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label>
            Filter by theme
            <select value={themeFilter} onChange={(e) => setThemeFilter(e.target.value)}>
              <option value="all">All themes</option>
              {[...themeRows]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Filter by difficulty
            <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)}>
              <option value="all">Any</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d} · {difficultyLabel(d)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {actionError && <p role="alert">{actionError}</p>}
        {questionRows.length === 0 ? (
          <p className="hint">No questions yet. Add one above or import a CSV.</p>
        ) : visible.length === 0 ? (
          <p className="hint">No questions match these filters.</p>
        ) : (
          <div className="scroll">
            <table aria-label="Questions">
              <thead>
                <tr>
                  <th scope="col">Question</th>
                  <th scope="col">Answer</th>
                  <th scope="col">Difficulty</th>
                  <th scope="col">Themes</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((q) => (
                  <tr key={q.id}>
                    <th scope="row" className="plain">
                      {q.text}
                    </th>
                    <td>{q.answer}</td>
                    <td>{difficultyLabel(q.authorRating)}</td>
                    <td>
                      <span className="chips">
                        {q.themeIds.map((id) => {
                          const name = themeNames.get(id);
                          return name ? (
                            <span key={id} className="chip">
                              {name}
                            </span>
                          ) : null;
                        })}
                      </span>
                    </td>
                    <td className="actions">
                      <button
                        type="button"
                        aria-label={`Edit: ${q.text}`}
                        onClick={() => setEditing(q)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete: ${q.text}`}
                        onClick={() => remove(q)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ThemeList themes={themeRows} questions={questionRows} />
      <ImportExport questions={questionRows} themes={themeRows} />
    </div>
  );
}
