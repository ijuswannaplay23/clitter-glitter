import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createTestRepository, renderWithRepository, seedQuestion } from '../test-utils';
import { NewEventForm } from './NewEventForm';
import { assembleQuiz } from './presets';

async function savedQuiz() {
  const repo = createTestRepository();
  const a = await seedQuestion(repo, 'Capital of France?', { answer: 'Paris', rating: 1 });
  const b = await seedQuestion(repo, 'Capital of Peru?', { answer: 'Lima', rating: 2 });
  const c = await seedQuestion(repo, 'Capital of Mali?', { answer: 'Bamako', rating: 4 });
  const quiz = await repo.quizzes.save(
    assembleQuiz({
      title: 'Capitals night',
      preset: 'classic',
      rounds: [[a.id, b.id]],
      finalQuestionId: c.id,
    }),
  );
  return { repo, quiz, questions: [a, b, c] };
}

function start(venue: string, quizId?: string) {
  fireEvent.change(screen.getByLabelText('Venue'), { target: { value: venue } });
  if (quizId) fireEvent.change(screen.getByLabelText('Quiz'), { target: { value: quizId } });
  fireEvent.click(screen.getByRole('button', { name: 'Start night' }));
}

it('lists saved quizzes and hides the quick-night options when one is chosen', async () => {
  const { repo, quiz } = await savedQuiz();
  renderWithRepository(<NewEventForm onCreated={vi.fn()} />, repo);

  expect(await screen.findByRole('option', { name: 'Capitals night' })).toBeTruthy();
  expect(screen.getByLabelText('Rounds')).toBeTruthy();

  fireEvent.change(screen.getByLabelText('Quiz'), { target: { value: quiz.id } });
  expect(screen.queryByLabelText('Rounds')).toBeNull();
});

it('starts a night from a saved quiz and copies the question text into it', async () => {
  const { repo, quiz } = await savedQuiz();
  const onCreated = vi.fn();
  renderWithRepository(<NewEventForm onCreated={onCreated} />, repo);
  await screen.findByRole('option', { name: 'Capitals night' });

  start('Test Bar', quiz.id);

  await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
  const event = await repo.events.get(onCreated.mock.calls[0]?.[0] as string);
  expect(event?.quizSnapshot.title).toBe('Capitals night');
  expect(event?.questions?.map((q) => [q.text, q.answer, q.difficulty])).toEqual([
    ['Capital of France?', 'Paris', 1],
    ['Capital of Peru?', 'Lima', 2],
    ['Capital of Mali?', 'Bamako', 4],
  ]);
});

it('keeps the night’s own copy when the bank is edited afterwards', async () => {
  const { repo, quiz, questions } = await savedQuiz();
  const onCreated = vi.fn();
  renderWithRepository(<NewEventForm onCreated={onCreated} />, repo);
  await screen.findByRole('option', { name: 'Capitals night' });
  start('Test Bar', quiz.id);
  await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());

  await repo.questions.save({ ...(questions[0] as (typeof questions)[number]), answer: 'Lyon' });
  const event = await repo.events.get(onCreated.mock.calls[0]?.[0] as string);
  expect(event?.questions?.[0]?.answer).toBe('Paris');
});

it('refuses to start when the quiz uses a question deleted from the bank', async () => {
  const { repo, quiz, questions } = await savedQuiz();
  await repo.questions.remove((questions[1] as (typeof questions)[number]).id);
  const onCreated = vi.fn();
  renderWithRepository(<NewEventForm onCreated={onCreated} />, repo);
  await screen.findByRole('option', { name: 'Capitals night' });

  start('Test Bar', quiz.id);

  expect((await screen.findByRole('alert')).textContent).toContain('uses 1 question(s) deleted');
  expect(onCreated).not.toHaveBeenCalled();
  expect(await repo.events.list()).toEqual([]);
});

it('a quick night does not add a quiz to the saved list', async () => {
  const repo = createTestRepository();
  const onCreated = vi.fn();
  renderWithRepository(<NewEventForm onCreated={onCreated} />, repo);

  start('Test Bar');

  await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
  expect(await repo.quizzes.list()).toEqual([]);
  const event = await repo.events.get(onCreated.mock.calls[0]?.[0] as string);
  expect(event?.questions).toBeUndefined();
});
