import Dexie from 'dexie';
import { afterEach, expect, it } from 'vitest';
import { makeQuestion, makeTheme } from './fixtures';
import { newId } from './ids';
import { createLocalRepository, openDatabase, type ClitterDb } from './local';

const opened: Dexie[] = [];

afterEach(async () => {
  await Promise.all(opened.splice(0).map((db) => db.delete()));
});

it('upgrades a version 1 database without losing rows and adds the themes table', async () => {
  const name = `test-${newId()}`;

  // Exactly the schema shipped as version 1, before themes existed.
  const old = new Dexie(name);
  old.version(1).stores({
    events: 'id, updatedAt, status',
    quizzes: 'id, updatedAt',
    questions: 'id, updatedAt, status',
    teams: 'id, eventId, updatedAt',
    entries: 'id, eventId, teamId, [teamId+questionId], updatedAt',
  });
  const question = makeQuestion();
  await old.table('questions').put(question);
  old.close();

  const db: ClitterDb = openDatabase(name);
  opened.push(db);
  const repo = createLocalRepository(db);

  expect(await repo.questions.list()).toEqual([question]);
  const theme = await repo.themes.save(makeTheme('Movies'));
  expect(await repo.themes.get(theme.id)).toEqual(theme);
});
