import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  createTestRepository,
  renderWithRepository,
  seedGrade,
  seedNight,
  seedTeam,
} from '../test-utils';
import { Projector } from './Projector';
import { roundsShown, scoreboardTitle } from './scoreboard';

/** Two rounds of one question. Ann is right in both, Bo only in round 1. */
async function twoRoundNight(scoreboardRounds?: number) {
  const repo = createTestRepository();
  const { quiz, event } = await seedNight(repo, {
    rounds: 2,
    questionsPerRound: 1,
    scoreboardRounds,
  });
  const ann = await seedTeam(repo, event.id, 'Ann');
  const bo = await seedTeam(repo, event.id, 'Bo');
  const [q1, q2] = quiz.rounds.map((r) => r.questionIds[0] ?? '');
  await seedGrade(repo, event.id, ann.id, q1 ?? '', 'correct');
  await seedGrade(repo, event.id, ann.id, q2 ?? '', 'correct');
  await seedGrade(repo, event.id, bo.id, q1 ?? '', 'correct');
  return { repo, event };
}

const board = async () => within(await screen.findByRole('list', { name: 'Standings' }));
const rowTexts = async () => (await board()).getAllByRole('listitem').map((li) => li.textContent);

describe('Projector', () => {
  it('shows the venue and live standings, best first', async () => {
    const { repo, event } = await twoRoundNight();
    renderWithRepository(<Projector eventId={event.id} />, repo);

    expect(await screen.findByRole('heading', { level: 1, name: 'Test Bar' })).toBeTruthy();
    expect(screen.getByText('Live standings')).toBeTruthy();
    expect(await rowTexts()).toEqual(['1Ann2', '2Bo1']);
  });

  it('counts only the chosen number of rounds', async () => {
    const { repo, event } = await twoRoundNight(1);
    renderWithRepository(<Projector eventId={event.id} />, repo);

    expect(await screen.findByText('Standings after Round 1')).toBeTruthy();
    expect(await rowTexts()).toEqual(['1Ann1', '1Bo1']);
  });

  it('hides scores completely until the host reveals them', async () => {
    const { repo, event } = await twoRoundNight(0);
    renderWithRepository(<Projector eventId={event.id} />, repo);

    expect(await screen.findByText('Scores are hidden until the reveal.')).toBeTruthy();
    expect(screen.queryByText('Ann')).toBeNull();
  });

  it('updates by itself when the host changes the scoreboard or grades', async () => {
    const { repo, event } = await twoRoundNight(0);
    renderWithRepository(<Projector eventId={event.id} />, repo);
    await screen.findByText('Scores are hidden until the reveal.');

    await repo.events.save({ ...event, scoreboardRounds: undefined });
    await waitFor(async () => expect(await rowTexts()).toEqual(['1Ann2', '2Bo1']));

    const [bo] = (await repo.teams.forEvent(event.id)).filter((t) => t.name === 'Bo');
    const q2 = event.quizSnapshot.rounds[1]?.questionIds[0] ?? '';
    await seedGrade(repo, event.id, bo?.id ?? '', q2, 'correct');
    await waitFor(async () => expect(await rowTexts()).toEqual(['1Ann2', '1Bo2']));
  });

  it('puts the chosen question on screen without its answer, then returns to the scores', async () => {
    const repo = createTestRepository();
    const { event } = await seedNight(repo, {
      rounds: 2,
      questionsPerRound: 2,
      snapshotQuestions: true,
    });
    const questionId = event.quizSnapshot.rounds[1]?.questionIds[1] ?? '';
    renderWithRepository(<Projector eventId={event.id} />, repo);
    await screen.findByText('Live standings');

    await repo.events.save({ ...event, projectorQuestionId: questionId });
    expect(await screen.findByText('Question 4')).toBeTruthy();
    expect(screen.getByText('Round 2 · Question 2 of 2')).toBeTruthy();
    expect(screen.queryByText('Answer 4')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Standings' })).toBeNull();

    await repo.events.save({ ...event, projectorQuestionId: undefined });
    expect(await screen.findByText('Live standings')).toBeTruthy();
    expect(screen.queryByText('Question 4')).toBeNull();
  });

  it('lists lettered choices under a multiple-choice question', async () => {
    const repo = createTestRepository();
    const { event } = await seedNight(repo, {
      rounds: 1,
      questionsPerRound: 1,
      snapshotQuestions: true,
    });
    const [question] = event.questions ?? [];
    await repo.events.save({
      ...event,
      projectorQuestionId: question?.id,
      questions: event.questions?.map((q) => ({
        ...q,
        answer: 'Rome',
        choices: ['Paris', 'Rome', 'Oslo'],
      })),
    });
    renderWithRepository(<Projector eventId={event.id} />, repo);

    const choices = within(await screen.findByRole('list', { name: 'Choices' }));
    expect(choices.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'AParis',
      'BRome',
      'COslo',
    ]);
  });

  it('keeps showing scores if the chosen question has no saved text', async () => {
    const repo = createTestRepository();
    const { event } = await seedNight(repo, { rounds: 1, questionsPerRound: 1 });
    const questionId = event.quizSnapshot.rounds[0]?.questionIds[0] ?? '';
    await repo.events.save({ ...event, projectorQuestionId: questionId });
    renderWithRepository(<Projector eventId={event.id} />, repo);
    expect(await screen.findByText('Live standings')).toBeTruthy();
  });

  it('says so when the night does not exist', async () => {
    renderWithRepository(<Projector eventId="missing" />);
    expect(await screen.findByText('This night was not found.')).toBeTruthy();
  });
});

describe('scoreboard helpers', () => {
  it('roundsShown caps at the round count and defaults to all', async () => {
    const repo = createTestRepository();
    const { event } = await seedNight(repo, { rounds: 3 });
    expect(roundsShown(event)).toBe(3);
    expect(roundsShown({ ...event, scoreboardRounds: 2 })).toBe(2);
    expect(roundsShown({ ...event, scoreboardRounds: 99 })).toBe(3);
  });

  it('titles the board by what it shows', async () => {
    const repo = createTestRepository();
    const { event } = await seedNight(repo, { rounds: 3 });
    expect(scoreboardTitle(event)).toBe('Live standings');
    expect(scoreboardTitle({ ...event, scoreboardRounds: 2 })).toBe('Standings after Round 2');
    expect(scoreboardTitle({ ...event, scoreboardRounds: 0 })).toBe('');
  });
});
