import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestRepository, renderWithRepository, seedQuestion, seedTheme } from '../test-utils';
import { QuestionBank } from './QuestionBank';

afterEach(() => {
  vi.restoreAllMocks();
});

const table = async () => within(await screen.findByRole('table', { name: 'Questions' }));
const rowTexts = async () =>
  (await table())
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.textContent);

describe('adding and editing', () => {
  it('adds a question with a new theme and a difficulty, and saves it', async () => {
    const repo = createTestRepository();
    renderWithRepository(<QuestionBank />, repo);

    fireEvent.change(await screen.findByLabelText('Question'), {
      target: { value: 'Who directed Jaws?' },
    });
    fireEvent.change(screen.getByLabelText('Answer'), { target: { value: 'Steven Spielberg' } });
    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('New themes (separate with commas)'), {
      target: { value: 'Movies, 70s' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add question' }));

    const row = await (await table()).findByRole('row', { name: /Jaws/ });
    expect(row.textContent).toContain('Steven Spielberg');
    expect(row.textContent).toContain('Hard');
    expect(row.textContent).toContain('Movies');
    expect(row.textContent).toContain('70s');

    const [saved] = await repo.questions.list();
    expect(saved).toMatchObject({
      text: 'Who directed Jaws?',
      authorRating: 4,
      status: 'approved',
    });
    expect((await repo.themes.list()).map((t) => t.name).sort()).toEqual(['70s', 'Movies']);
    expect(screen.getByLabelText<HTMLTextAreaElement>('Question').value).toBe('');
  });

  it('reuses an existing theme typed in a different case instead of duplicating it', async () => {
    const repo = createTestRepository();
    await seedTheme(repo, 'Movies');
    renderWithRepository(<QuestionBank />, repo);

    fireEvent.change(await screen.findByLabelText('Question'), { target: { value: 'Q' } });
    fireEvent.change(screen.getByLabelText('Answer'), { target: { value: 'A' } });
    fireEvent.change(screen.getByLabelText('New themes (separate with commas)'), {
      target: { value: 'movies' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add question' }));

    await (await table()).findByRole('row', { name: /Movies/ });
    expect(await repo.themes.list()).toHaveLength(1);
  });

  it('edits a question in place', async () => {
    const repo = createTestRepository();
    await seedQuestion(repo, 'Capital of France?', { answer: 'Lyon' });
    renderWithRepository(<QuestionBank />, repo);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit: Capital of France?' }));
    expect(screen.getByRole('heading', { name: 'Edit question' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Answer'), { target: { value: 'Paris' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(async () => expect((await rowTexts()).join()).toContain('Paris'));
    expect(screen.getByRole('heading', { name: 'Add a question' })).toBeTruthy();
    expect(await repo.questions.list()).toHaveLength(1);
  });

  it('deletes a question after confirming', async () => {
    const repo = createTestRepository();
    await seedQuestion(repo, 'Doomed question');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithRepository(<QuestionBank />, repo);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete: Doomed question' }));

    await waitFor(async () => expect(await repo.questions.list()).toEqual([]));
    expect(await screen.findByText(/No questions yet/)).toBeTruthy();
  });

  it('keeps the question when the delete is not confirmed', async () => {
    const repo = createTestRepository();
    await seedQuestion(repo, 'Safe question');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWithRepository(<QuestionBank />, repo);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete: Safe question' }));
    expect(await repo.questions.list()).toHaveLength(1);
  });
});

describe('browsing', () => {
  async function seeded() {
    const repo = createTestRepository();
    const movies = await seedTheme(repo, 'Movies');
    const music = await seedTheme(repo, 'Music');
    await seedQuestion(repo, 'Hard movie', { rating: 5, themeIds: [movies.id], answer: 'X' });
    await seedQuestion(repo, 'Easy movie', { rating: 1, themeIds: [movies.id], answer: 'Y' });
    await seedQuestion(repo, 'Medium song', { rating: 3, themeIds: [music.id], answer: 'Z' });
    renderWithRepository(<QuestionBank />, repo);
    await table();
    return repo;
  }

  it('lists questions easiest first', async () => {
    await seeded();
    const texts = await rowTexts();
    expect(texts[0]).toContain('Easy movie');
    expect(texts[1]).toContain('Medium song');
    expect(texts[2]).toContain('Hard movie');
  });

  it('filters by theme, difficulty and search text (question or answer)', async () => {
    await seeded();

    fireEvent.change(screen.getByLabelText('Filter by theme'), {
      target: { value: screen.getByRole('option', { name: 'Movies' }).getAttribute('value') },
    });
    await waitFor(async () => expect(await rowTexts()).toHaveLength(2));

    fireEvent.change(screen.getByLabelText('Filter by difficulty'), { target: { value: '5' } });
    await waitFor(async () => expect((await rowTexts()).join()).toContain('Hard movie'));
    expect(await rowTexts()).toHaveLength(1);
  });

  it('searches the answer text too and says when nothing matches', async () => {
    await seeded();
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'z' } });
    await waitFor(async () => expect(await rowTexts()).toHaveLength(1));

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'nothing like this' } });
    expect(await screen.findByText('No questions match these filters.')).toBeTruthy();
  });
});

describe('themes', () => {
  it('renames a theme and refuses a name that already exists', async () => {
    const repo = createTestRepository();
    const movies = await seedTheme(repo, 'Movies');
    await seedTheme(repo, 'Music');
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Films');
    renderWithRepository(<QuestionBank />, repo);

    fireEvent.click(await screen.findByRole('button', { name: 'Rename Movies' }));
    await waitFor(async () => expect((await repo.themes.get(movies.id))?.name).toBe('Films'));

    prompt.mockReturnValue('music');
    fireEvent.click(await screen.findByRole('button', { name: 'Rename Films' }));
    expect(await screen.findByText('A theme named "Music" already exists.')).toBeTruthy();
    expect((await repo.themes.get(movies.id))?.name).toBe('Films');
  });

  it('deleting a theme also takes it off its questions', async () => {
    const repo = createTestRepository();
    const movies = await seedTheme(repo, 'Movies');
    const question = await seedQuestion(repo, 'Hard movie', { themeIds: [movies.id] });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithRepository(<QuestionBank />, repo);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete theme Movies' }));

    await waitFor(async () => expect(await repo.themes.list()).toEqual([]));
    expect((await repo.questions.get(question.id))?.themeIds).toEqual([]);
  });
});

describe('import and export', () => {
  const csv =
    'question,answer,difficulty,themes\n' +
    'Capital of France?,Paris,1,Geography\n' +
    'Boiling point of water in C?,100,2,Science;Geography\n' +
    ',Missing question,1,\n';

  const upload = (content: string) =>
    fireEvent.change(screen.getByLabelText('Import CSV'), {
      target: { files: [new File([content], 'questions.csv', { type: 'text/csv' })] },
    });

  it('imports valid rows, creates their themes, and reports the bad row', async () => {
    const repo = createTestRepository();
    renderWithRepository(<QuestionBank />, repo);
    await screen.findByLabelText('Import CSV');

    upload(csv);

    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('Added 2 questions');
    expect(status.textContent).toContain('1 row(s) had problems');
    expect(status.textContent).toContain('Line 4: The question is empty.');
    expect((await repo.themes.list()).map((t) => t.name).sort()).toEqual(['Geography', 'Science']);
    expect(await repo.questions.list()).toHaveLength(2);
  });

  it('skips questions already in the bank on a second import', async () => {
    const repo = createTestRepository();
    renderWithRepository(<QuestionBank />, repo);
    await screen.findByLabelText('Import CSV');

    upload(csv);
    await screen.findByText(/Added 2 questions/);
    upload(csv);

    expect((await screen.findByRole('status')).textContent).toContain(
      'Added 0 questions, skipped 2',
    );
    expect(await repo.questions.list()).toHaveLength(2);
  });

  it('exports every question as CSV with theme names', async () => {
    const repo = createTestRepository();
    const geography = await seedTheme(repo, 'Geography');
    await seedQuestion(repo, 'Capital of France?', {
      answer: 'Paris',
      rating: 1,
      themeIds: [geography.id],
    });
    const createObjectURL = vi.fn(() => 'blob:test');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderWithRepository(<QuestionBank />, repo);

    const button = await screen.findByRole('button', { name: 'Export CSV' });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);

    expect(click).toHaveBeenCalledOnce();
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    expect(await blob.text()).toBe(
      'question,answer,difficulty,themes\r\nCapital of France?,Paris,1,Geography\r\n',
    );
  });
});
