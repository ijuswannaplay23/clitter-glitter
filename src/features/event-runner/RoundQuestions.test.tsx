import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createTestRepository, renderWithRepository, seedNight } from '../test-utils';
import { EventRunner } from './EventRunner';

it('shows the round’s questions with answers to the host, and switches with the round', async () => {
  const repo = createTestRepository();
  const { event } = await seedNight(repo, {
    rounds: 2,
    questionsPerRound: 2,
    snapshotQuestions: true,
  });
  renderWithRepository(<EventRunner eventId={event.id} onExit={vi.fn()} />, repo);

  const cue = await screen.findByText('Questions and answers (host only)');
  expect(cue).toBeTruthy();
  expect(screen.getByText('Question 1')).toBeTruthy();
  expect(screen.getByText('Answer 2')).toBeTruthy();
  expect(screen.queryByText('Question 3')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'R2' }));
  expect(await screen.findByText('Question 3')).toBeTruthy();
  expect(screen.queryByText('Question 1')).toBeNull();
});

it('puts a question on the projector, swaps to another, and takes it off again', async () => {
  const repo = createTestRepository();
  const { event } = await seedNight(repo, {
    rounds: 1,
    questionsPerRound: 2,
    snapshotQuestions: true,
  });
  const [first, second] = event.quizSnapshot.rounds[0]?.questionIds ?? [];
  renderWithRepository(<EventRunner eventId={event.id} onExit={vi.fn()} />, repo);

  fireEvent.click(await screen.findByRole('button', { name: 'Show question 1 on projector' }));
  await waitFor(async () =>
    expect((await repo.events.get(event.id))?.projectorQuestionId).toBe(first),
  );

  fireEvent.click(await screen.findByRole('button', { name: 'Show question 2 on projector' }));
  await waitFor(async () =>
    expect((await repo.events.get(event.id))?.projectorQuestionId).toBe(second),
  );

  fireEvent.click(
    await screen.findByRole('button', { name: 'Stop showing question 2 on projector' }),
  );
  await waitFor(async () =>
    expect((await repo.events.get(event.id))?.projectorQuestionId).toBeUndefined(),
  );
});

it('shows no cue card for a quick night with placeholder questions', async () => {
  const repo = createTestRepository();
  const { event } = await seedNight(repo);
  renderWithRepository(<EventRunner eventId={event.id} onExit={vi.fn()} />, repo);

  await screen.findByRole('navigation', { name: 'Rounds' });
  expect(screen.queryByText('Questions and answers (host only)')).toBeNull();
});
