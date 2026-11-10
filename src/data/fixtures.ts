import type { Entry, GameEvent, Question, Quiz, Team, Theme } from '../domain';
import { newId } from './ids';

const STAMP = '2026-01-01T00:00:00.000Z';

/** Strictly increasing timestamps, one second apart, so ordering assertions are deterministic. */
export function fakeClock(startSeconds = 100) {
  let t = startSeconds;
  return () => new Date(Date.UTC(2026, 0, 1, 0, 0, t++)).toISOString();
}

export function makeQuiz(): Quiz {
  return { id: newId(), updatedAt: STAMP, title: 'Test quiz', rounds: [] };
}

export function makeEvent(): GameEvent {
  const quiz = makeQuiz();
  return {
    id: newId(),
    updatedAt: STAMP,
    quizId: quiz.id,
    venue: 'Test bar',
    date: '2026-01-01',
    status: 'setup',
    rules: { allowNegativeTotal: true },
    quizSnapshot: quiz,
  };
}

export function makeQuestion(): Question {
  return {
    id: newId(),
    updatedAt: STAMP,
    text: 'What is 2 + 2?',
    answer: '4',
    themeIds: [],
    authorRating: 1,
    status: 'approved',
  };
}

export function makeTheme(name = 'Movies'): Theme {
  return { id: newId(), updatedAt: STAMP, name };
}

export function makeTeam(eventId: string, name = 'Quiz Khalifa'): Team {
  return { id: newId(), updatedAt: STAMP, eventId, name };
}

export function makeEntry(
  eventId: string,
  teamId: string,
  questionId: string,
  state: Entry['state'] = 'correct',
  wager?: number,
): Entry {
  return {
    id: newId(),
    updatedAt: STAMP,
    eventId,
    teamId,
    questionId,
    state,
    wager,
    gradedAt: STAMP,
  };
}
