import { useState } from 'react';
import type { Question, Theme } from '../../domain';
import { errorMessage, useRepository } from '../repository';
import { importQuestionRows } from './actions';
import { parseQuestionCsv, questionsToCsv, type ImportError } from './csv';

interface Summary {
  added: number;
  skipped: number;
  errors: ImportError[];
}

export function ImportExport({ questions, themes }: { questions: Question[]; themes: Theme[] }) {
  const repo = useRepository();
  const [summary, setSummary] = useState<Summary>();
  const [error, setError] = useState<string>();

  function exportCsv() {
    const names = new Map(themes.map((t) => [t.id, t.name]));
    const csv = questionsToCsv(questions, (id) => names.get(id));
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'clitter-glitter-questions.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function importFile(file: File) {
    const parsed = parseQuestionCsv(await file.text());
    const { added, skipped } = await importQuestionRows(repo, parsed.rows);
    setSummary({ added, skipped, errors: parsed.errors });
  }

  return (
    <section className="card" aria-labelledby="transfer-title">
      <h2 id="transfer-title">Import and export</h2>
      <p className="hint">
        CSV with the columns <code>question, answer, difficulty, themes</code>. Difficulty is 1 to 5
        (3 if left out); separate several themes with <code>;</code>. Export is also your backup
        until cloud sync exists.
      </p>
      <div className="row">
        <label className="button">
          Import CSV
          <input
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              setError(undefined);
              setSummary(undefined);
              if (file) importFile(file).catch((err: unknown) => setError(errorMessage(err)));
              e.target.value = '';
            }}
          />
        </label>
        <button type="button" onClick={exportCsv} disabled={questions.length === 0}>
          Export CSV
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {summary && (
        <div role="status">
          <p>
            Added {summary.added} question{summary.added === 1 ? '' : 's'}
            {summary.skipped > 0 && `, skipped ${summary.skipped} already in the bank`}
            {summary.errors.length > 0 && `, ${summary.errors.length} row(s) had problems`}.
          </p>
          {summary.errors.length > 0 && (
            <ul>
              {summary.errors.map((e) => (
                <li key={`${e.line}-${e.message}`}>
                  Line {e.line}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
