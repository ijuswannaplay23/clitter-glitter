import { cleanup, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach } from 'vitest';
import {
  createLocalRepository,
  newId,
  openDatabase,
  type ClitterDb,
  type Repository,
} from '../data';
import type { Entry } from '../domain';
import { buildQuiz, type QuizOptions } from './event-runner/presets';
import { RepositoryProvider } from './repository';

const opened: ClitterDb[] = [];

// Unmount before deleting the databases so live queries are not left running against a dead db.
afterEach(async () => {
  cleanup();
  await Promise.all(opened.splice(0).map((db) => db.delete()));
});

export function createTestRepository() {
  const db = openDatabase(`test-${newId()}`);
  opened.push(db);
  return createLocalRepository(db);
}

interface SeedOptions extends Partial<QuizOptions> {
  scoreboardRounds?: number | undefined;
  /** Also copy question text into the event ("Question 1" / "Answer 1", ...). */
  snapshotQuestions?: boolean;
}

/** Saves a quiz and a live event for it ("Test Bar") and returns both. */
export async function seedNight(repo: Repository, options: SeedOptions = {}) {
  const { scoreboardRounds, snapshotQuestions, ...quizOptions } = options;
  const quiz = await repo.quizzes.save(
    buildQuiz({
      preset: 'classic',
      rounds: 1,
      questionsPerRound: 2,
      withFinal: false,
      ...quizOptions,
    }),
  );
  const event = await repo.events.save({
    id: newId(),
    updatedAt: new Date().toISOString(),
    quizId: quiz.id,
    venue: 'Test Bar',
    date: '2026-01-01',
    status: 'live',
    rules: { allowNegativeTotal: true },
    scoreboardRounds,
    quizSnapshot: quiz,
    questions: snapshotQuestions
      ? quiz.rounds
          .flatMap((r) => r.questionIds)
          .map((id, i) => ({
            id,
            text: `Question ${i + 1}`,
            answer: `Answer ${i + 1}`,
            difficulty: 3,
          }))
      : undefined,
  });
  return { quiz, event };
}

export async function seedTheme(repo: Repository, name: string) {
  return repo.themes.save({ id: newId(), name, updatedAt: new Date().toISOString() });
}

export async function seedQuestion(
  repo: Repository,
  text: string,
  options: { answer?: string; rating?: number; themeIds?: string[] } = {},
) {
  return repo.questions.save({
    id: newId(),
    updatedAt: new Date().toISOString(),
    text,
    answer: options.answer ?? 'Answer',
    authorRating: options.rating ?? 3,
    themeIds: options.themeIds ?? [],
    status: 'approved',
  });
}

export async function seedTeam(repo: Repository, eventId: string, name: string) {
  return repo.teams.save({ id: newId(), eventId, name, updatedAt: new Date().toISOString() });
}

export async function seedGrade(
  repo: Repository,
  eventId: string,
  teamId: string,
  questionId: string,
  state: Entry['state'],
  wager?: number,
) {
  const now = new Date().toISOString();
  return repo.entries.save({
    id: newId(),
    eventId,
    teamId,
    questionId,
    state,
    wager,
    gradedAt: now,
    updatedAt: now,
  });
}

export function renderWithRepository(ui: ReactElement, repo = createTestRepository()) {
  return { repo, ...render(<RepositoryProvider repo={repo}>{ui}</RepositoryProvider>) };
}
