import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestRepository, renderWithRepository, seedQuestion, seedTheme } from '../test-utils';
import { QuizBuilder } from './QuizBuilder';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Four questions at each difficulty 1..5 = 20, split over two themes. */
async function seededBank() {
  const repo = createTestRepository();
  const movies = await seedTheme(repo, 'Movies');
  const music = await seedTheme(repo, 'Music');
  for (let rating = 1; rating <= 5; rating++) {
    for (let n = 1; n <= 4; n++) {
      await seedQuestion(repo, `Q${rating}-${n}`, {
        answer: `A${rating}-${n}`,
        rating,
        themeIds: [n % 2 === 0 ? movies.id : music.id],
      });
    }
  }
  return { repo, movies, music };
}

function configure(rounds: number, perRound: number, withFinal = true) {
  fireEvent.change(screen.getByLabelText('Rounds'), { target: { value: String(rounds) } });
  fireEvent.change(screen.getByLabelText('Questions per round'), {
    target: { value: String(perRound) },
  });
  const checkbox = screen.getByLabelText(/End with an all-or-nothing final/);
  if ((checkbox as HTMLInputElement).checked !== withFinal) fireEvent.click(checkbox);
}

const draftQuestions = () =>
  within(screen.getByRole('region', { name: 'Draft' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent ?? '');

describe('QuizBuilder', () => {
  it('drafts rounds and a hardest-last final from the bank', async () => {
    const { repo } = await seededBank();
    renderWithRepository(<QuizBuilder />, repo);
    await screen.findByText(/Needs 6 questions|Needs \d+ questions/);

    configure(2, 2);
    fireEvent.click(screen.getByRole('button', { name: 'Draft quiz' }));

    expect(await screen.findByRole('heading', { name: 'Round 2' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Final question' })).toBeTruthy();
    const items = draftQuestions();
    expect(items).toHaveLength(5);
    expect(items.at(-1)).toContain('Very hard');
    expect(screen.getByRole('button', { name: 'Redraft' })).toBeTruthy();
  });

  it('only uses questions from the chosen themes', async () => {
    const { repo, movies } = await seededBank();
    renderWithRepository(<QuizBuilder />, repo);
    await screen.findByLabelText('Movies');

    fireEvent.click(screen.getByLabelText('Movies'));
    expect(await screen.findByText(/10 in the bank match/)).toBeTruthy();
    configure(2, 2);
    fireEvent.click(screen.getByRole('button', { name: 'Draft quiz' }));
    await screen.findByRole('region', { name: 'Draft' });

    const ids = new Set(
      (await repo.questions.list())
        .filter((q) => q.themeIds.includes(movies.id))
        .map((q) => q.text),
    );
    for (const text of draftQuestions().map((t) => t.split(' ')[0] ?? '')) {
      expect(ids.has(text)).toBe(true);
    }
  });

  it('explains how many questions are missing when the bank is too small', async () => {
    const repo = createTestRepository();
    await seedQuestion(repo, 'Only one');
    renderWithRepository(<QuizBuilder />, repo);
    await screen.findByText(/in the bank match/);

    fireEvent.click(screen.getByRole('button', { name: 'Draft quiz' }));

    expect((await screen.findByRole('alert')).textContent).toContain('needs 26 but only 1 match');
    expect(screen.queryByRole('region', { name: 'Draft' })).toBeNull();
  });

  it('swaps one question for a different unused one', async () => {
    const { repo } = await seededBank();
    renderWithRepository(<QuizBuilder />, repo);
    await screen.findByLabelText('Rounds');
    configure(2, 2, false);
    fireEvent.click(screen.getByRole('button', { name: 'Draft quiz' }));
    await screen.findByRole('region', { name: 'Draft' });

    const before = draftQuestions().map((t) => t.split(' ')[0]);
    const target = screen.getAllByRole('button', { name: /^Swap:/ })[1] as HTMLElement;
    fireEvent.click(target);

    await waitFor(() => {
      const after = draftQuestions().map((t) => t.split(' ')[0]);
      expect(after.filter((text, i) => text !== before[i])).toHaveLength(1);
      expect(new Set(after).size).toBe(after.length);
    });
  });

  it('saves the draft as a quiz with the chosen scoring and lists it', async () => {
    const { repo } = await seededBank();
    renderWithRepository(<QuizBuilder />, repo);
    await screen.findByLabelText('Quiz title');

    fireEvent.change(screen.getByLabelText('Quiz title'), { target: { value: 'Friday mix' } });
    fireEvent.change(screen.getByLabelText('Scoring'), { target: { value: 'escalating' } });
    configure(2, 3);
    fireEvent.click(screen.getByRole('button', { name: 'Draft quiz' }));
    await screen.findByRole('region', { name: 'Draft' });
    fireEvent.click(screen.getByRole('button', { name: 'Save quiz' }));

    expect((await screen.findByRole('status')).textContent).toContain('Saved "Friday mix"');
    expect(screen.queryByRole('region', { name: 'Draft' })).toBeNull();

    const [quiz] = await repo.quizzes.list();
    expect(quiz?.title).toBe('Friday mix');
    expect(quiz?.rounds.map((r) => r.kind)).toEqual(['standard', 'standard', 'final']);
    const first = quiz?.rounds[0];
    expect(first?.kind === 'standard' && first.rules.wager).toEqual({
      mode: 'pool',
      values: [1, 2, 3],
    });
    expect(screen.getByText(/Friday mix/, { selector: '#saved-title ~ ul *' })).toBeTruthy();
  });

  it('deletes a saved quiz after confirming', async () => {
    const { repo } = await seededBank();
    renderWithRepository(<QuizBuilder />, repo);
    await screen.findByLabelText('Quiz title');
    configure(1, 2, false);
    fireEvent.click(screen.getByRole('button', { name: 'Draft quiz' }));
    await screen.findByRole('region', { name: 'Draft' });
    fireEvent.click(screen.getByRole('button', { name: 'Save quiz' }));
    await screen.findByRole('status');

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete quiz Trivia night' }));

    await waitFor(async () => expect(await repo.quizzes.list()).toEqual([]));
  });
});
