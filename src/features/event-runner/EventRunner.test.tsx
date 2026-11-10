import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createTestRepository, renderWithRepository, seedNight } from '../test-utils';
import { EventRunner } from './EventRunner';
import type { QuizOptions } from './presets';

async function startNight(options: Partial<QuizOptions> = {}) {
  const repo = createTestRepository();
  const { event } = await seedNight(repo, options);
  renderWithRepository(<EventRunner eventId={event.id} onExit={vi.fn()} />, repo);
  return { repo, eventId: event.id };
}

async function addTeam(name: string) {
  fireEvent.change(await screen.findByLabelText('Team name'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Add team' }));
  const grading = await screen.findByRole('table', { name: 'Grading' });
  await within(grading).findByRole('rowheader', { name: new RegExp(name) });
}

function standingsRow(name: string) {
  const table = screen.getByRole('table', { name: 'Standings' });
  return within(table).getByRole('rowheader', { name }).closest('tr') as HTMLElement;
}

const totalOf = (name: string) =>
  within(standingsRow(name)).getAllByRole('cell').at(-1)?.textContent;

describe('EventRunner', () => {
  it('adds a team, grades answers, and updates the standings', async () => {
    await startNight();
    await addTeam('Quiz Khalifa');

    fireEvent.click(screen.getByRole('button', { name: 'Quiz Khalifa Q1: Correct' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quiz Khalifa Q2: Wrong' }));

    await waitFor(() => expect(totalOf('Quiz Khalifa')).toBe('1'));
    expect(screen.getByRole('button', { name: 'Quiz Khalifa Q1: Correct' }).ariaPressed).toBe(
      'true',
    );
  });

  it('clicking the active grade again clears it', async () => {
    await startNight();
    await addTeam('Quiz Khalifa');

    const correct = () => screen.getByRole('button', { name: 'Quiz Khalifa Q1: Correct' });
    fireEvent.click(correct());
    await waitFor(() => expect(totalOf('Quiz Khalifa')).toBe('1'));

    fireEvent.click(correct());
    await waitFor(() => expect(totalOf('Quiz Khalifa')).toBe('0'));
    expect(correct().ariaPressed).toBe('false');
  });

  it('scores wagers and flags a wager outside the allowed values for review', async () => {
    await startNight({ preset: 'escalating', questionsPerRound: 3 });
    await addTeam('Quiz Khalifa');

    fireEvent.change(screen.getByLabelText('Quiz Khalifa Q1: wager'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Quiz Khalifa Q1: Correct' }));

    await waitFor(() => expect(totalOf('Quiz Khalifa')).toBe('9'));
    expect(await screen.findByText(/not one of the allowed values/)).toBeTruthy();
  });

  it('persists grades so reopening the night shows them', async () => {
    const { repo, eventId } = await startNight();
    await addTeam('Quiz Khalifa');
    fireEvent.click(screen.getByRole('button', { name: 'Quiz Khalifa Q1: Correct' }));
    await waitFor(() => expect(totalOf('Quiz Khalifa')).toBe('1'));

    const saved = await repo.entries.forEvent(eventId);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.state).toBe('correct');
  });
});

describe('scoreboard controls', () => {
  it('links to the projector window for this night', async () => {
    const { eventId } = await startNight();
    const link = await screen.findByRole('link', { name: 'Open projector window' });
    expect(link.getAttribute('href')).toBe(`?projector=${eventId}`);
  });

  it('saves what the projector should show and can return to live', async () => {
    const { repo, eventId } = await startNight({ rounds: 2 });
    const select = await screen.findByLabelText('Projector shows');
    const saved = () => repo.events.get(eventId).then((e) => e?.scoreboardRounds);

    fireEvent.change(select, { target: { value: '1' } });
    await waitFor(async () => expect(await saved()).toBe(1));

    fireEvent.change(select, { target: { value: '0' } });
    await waitFor(async () => expect(await saved()).toBe(0));

    fireEvent.change(select, { target: { value: 'live' } });
    await waitFor(async () => expect(await saved()).toBeUndefined());
  });

  it('offers "After" choices for every round except the last', async () => {
    await startNight({ rounds: 3 });
    const select = await screen.findByLabelText('Projector shows');
    const labels = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(labels).toEqual(['Live standings', 'Hidden', 'After Round 1', 'After Round 2']);
  });
});
