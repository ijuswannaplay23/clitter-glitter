import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeClock, makeEntry, makeEvent, makeQuestion, makeTeam } from './fixtures';
import { newId } from './ids';
import { createLocalRepository, openDatabase, type ClitterDb } from './local';
import { StoredDataError } from './repository';

const opened: ClitterDb[] = [];

function setup() {
  const db = openDatabase(`test-${newId()}`);
  opened.push(db);
  return { db, repo: createLocalRepository(db, fakeClock()) };
}

afterEach(async () => {
  await Promise.all(opened.splice(0).map((db) => db.delete()));
});

describe('save and get', () => {
  it('stamps updatedAt from the clock, returns the stored row, and round-trips', async () => {
    const { repo } = setup();
    const event = makeEvent();
    const saved = await repo.events.save(event);
    expect(saved.updatedAt).toBe('2026-01-01T00:01:40.000Z');
    expect(await repo.events.get(event.id)).toEqual(saved);
  });

  it('save is an upsert: a second save replaces the row and advances updatedAt', async () => {
    const { repo } = setup();
    const team = await repo.teams.save(makeTeam(newId()));
    const renamed = await repo.teams.save({ ...team, name: 'Renamed' });
    expect(renamed.updatedAt > team.updatedAt).toBe(true);
    expect(await repo.teams.list()).toEqual([renamed]);
  });

  it('rejects an invalid row and stores nothing', async () => {
    const { repo } = setup();
    await expect(repo.teams.save({ ...makeTeam(newId()), name: '' })).rejects.toThrow();
    expect(await repo.teams.list()).toEqual([]);
  });

  it('returns undefined for an unknown id', async () => {
    const { repo } = setup();
    expect(await repo.questions.get(newId())).toBeUndefined();
  });
});

describe('soft delete', () => {
  it('hides a removed row from get and list but keeps it for sync', async () => {
    const { repo } = setup();
    const question = await repo.questions.save(makeQuestion());
    await repo.questions.remove(question.id);

    expect(await repo.questions.get(question.id)).toBeUndefined();
    expect(await repo.questions.list()).toEqual([]);

    const changed = await repo.questions.changedSince('2000-01-01T00:00:00.000Z');
    expect(changed).toHaveLength(1);
    expect(changed[0]?.deletedAt).toBeDefined();
    expect(changed[0]?.updatedAt).toBe(changed[0]?.deletedAt);
  });

  it('removing a missing or already-deleted id is a no-op', async () => {
    const { repo } = setup();
    await repo.questions.remove(newId());
    const question = await repo.questions.save(makeQuestion());
    await repo.questions.remove(question.id);
    const [first] = await repo.questions.changedSince('2000-01-01T00:00:00.000Z');
    await repo.questions.remove(question.id);
    const [second] = await repo.questions.changedSince('2000-01-01T00:00:00.000Z');
    expect(second?.updatedAt).toBe(first?.updatedAt);
  });
});

describe('changedSince', () => {
  it('returns only rows updated strictly after the given time', async () => {
    const { repo } = setup();
    const first = await repo.questions.save(makeQuestion());
    const second = await repo.questions.save(makeQuestion());
    const changed = await repo.questions.changedSince(first.updatedAt);
    expect(changed.map((r) => r.id)).toEqual([second.id]);
  });
});

describe('event-scoped tables', () => {
  it("forEvent returns only that event's live rows", async () => {
    const { repo } = setup();
    const [a, b] = [newId(), newId()];
    const mine = await repo.teams.save(makeTeam(a, 'Mine'));
    const removed = await repo.teams.save(makeTeam(a, 'Removed'));
    await repo.teams.save(makeTeam(b, 'Other event'));
    await repo.teams.remove(removed.id);

    expect(await repo.teams.forEvent(a)).toEqual([mine]);
  });

  it('entries.findFor returns the live entry for a team and question', async () => {
    const { repo } = setup();
    const [eventId, teamId, questionId] = [newId(), newId(), newId()];
    const saved = await repo.entries.save(makeEntry(eventId, teamId, questionId, 'wrong'));
    await repo.entries.save(makeEntry(eventId, teamId, newId()));

    expect(await repo.entries.findFor(teamId, questionId)).toEqual(saved);
    expect(await repo.entries.findFor(teamId, newId())).toBeUndefined();
  });

  it('entries.findFor prefers the most recently updated duplicate and skips deleted ones', async () => {
    const { repo } = setup();
    const [eventId, teamId, questionId] = [newId(), newId(), newId()];
    await repo.entries.save(makeEntry(eventId, teamId, questionId, 'wrong'));
    const newer = await repo.entries.save(makeEntry(eventId, teamId, questionId, 'correct'));
    const newest = await repo.entries.save(makeEntry(eventId, teamId, questionId, 'blank'));

    expect((await repo.entries.findFor(teamId, questionId))?.id).toBe(newest.id);
    await repo.entries.remove(newest.id);
    expect((await repo.entries.findFor(teamId, questionId))?.id).toBe(newer.id);
  });
});

describe('validation on read', () => {
  it('throws StoredDataError when a stored row does not match the schema', async () => {
    const { db, repo } = setup();
    await db.teams.put({ id: 'not-a-uuid', eventId: 'x', name: '', updatedAt: 'nope' });
    await expect(repo.teams.list()).rejects.toBeInstanceOf(StoredDataError);
  });
});

describe('observe', () => {
  it('re-emits when observed data changes and stops after unsubscribe', async () => {
    const { repo } = setup();
    const eventId = newId();
    const seen: number[] = [];
    const errors: unknown[] = [];

    const stop = repo.observe(
      (r) => r.teams.forEvent(eventId),
      (rows) => seen.push(rows.length),
      (e) => errors.push(e),
    );
    await vi.waitFor(() => expect(seen.at(-1)).toBe(0));

    await repo.teams.save(makeTeam(eventId));
    await vi.waitFor(() => expect(seen.at(-1)).toBe(1));

    stop();
    const emitted = seen.length;
    await repo.teams.save(makeTeam(eventId, 'Late team'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(seen).toHaveLength(emitted);
    expect(errors).toEqual([]);
  });
});
