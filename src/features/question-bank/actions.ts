import { newId, type Repository } from '../../data';
import type { Question, Theme } from '../../domain';
import type { ImportRow } from './csv';

export interface QuestionDraft {
  text: string;
  answer: string;
  difficulty: number;
  themeIds: string[];
  /** Names typed by the host; created as themes if they do not exist yet. */
  newThemeNames: string[];
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const nowIso = () => new Date().toISOString();

/** Finds each theme by name (ignoring case and spacing), creating the ones that are missing. */
export async function resolveThemes(repo: Repository, names: string[]): Promise<Theme[]> {
  const byName = new Map((await repo.themes.list()).map((t) => [normalize(t.name), t]));
  const resolved: Theme[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (name === '') continue;
    let theme = byName.get(normalize(name));
    if (!theme) {
      theme = await repo.themes.save({ id: newId(), name, updatedAt: nowIso() });
      byName.set(normalize(name), theme);
    }
    if (!resolved.includes(theme)) resolved.push(theme);
  }
  return resolved;
}

export async function saveQuestionDraft(
  repo: Repository,
  draft: QuestionDraft,
  existing?: Question,
): Promise<Question> {
  const created = await resolveThemes(repo, draft.newThemeNames);
  return repo.questions.save({
    id: existing?.id ?? newId(),
    updatedAt: nowIso(),
    text: draft.text.trim(),
    answer: draft.answer.trim(),
    authorRating: draft.difficulty,
    themeIds: [...new Set([...draft.themeIds, ...created.map((t) => t.id)])],
    status: existing?.status ?? 'approved',
  });
}

/** Adds rows whose question text is not already in the bank (or earlier in the same file). */
export async function importQuestionRows(
  repo: Repository,
  rows: ImportRow[],
): Promise<{ added: number; skipped: number }> {
  const known = new Set((await repo.questions.list()).map((q) => normalize(q.text)));
  const themes = await resolveThemes(
    repo,
    rows.flatMap((r) => r.themes),
  );
  const idByName = new Map(themes.map((t) => [normalize(t.name), t.id]));

  let added = 0;
  let skipped = 0;
  for (const row of rows) {
    const key = normalize(row.text);
    if (known.has(key)) {
      skipped++;
      continue;
    }
    known.add(key);
    await repo.questions.save({
      id: newId(),
      updatedAt: nowIso(),
      text: row.text,
      answer: row.answer,
      authorRating: row.difficulty,
      themeIds: row.themes
        .map((name) => idByName.get(normalize(name)))
        .filter((id): id is string => id !== undefined),
      status: 'approved',
    });
    added++;
  }
  return { added, skipped };
}

export async function renameTheme(repo: Repository, theme: Theme, name: string): Promise<void> {
  const clash = (await repo.themes.list()).find(
    (t) => t.id !== theme.id && normalize(t.name) === normalize(name),
  );
  if (clash) throw new Error(`A theme named "${clash.name}" already exists.`);
  await repo.themes.save({ ...theme, name: name.trim() });
}

/** Removes the theme and takes it off every question that used it. */
export async function deleteTheme(repo: Repository, theme: Theme): Promise<void> {
  const users = (await repo.questions.list()).filter((q) => q.themeIds.includes(theme.id));
  for (const q of users) {
    await repo.questions.save({ ...q, themeIds: q.themeIds.filter((id) => id !== theme.id) });
  }
  await repo.themes.remove(theme.id);
}
