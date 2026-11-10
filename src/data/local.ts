import Dexie, { liveQuery, type Table as DexieTable } from 'dexie';
import { z } from 'zod';
import {
  EntrySchema,
  EventSchema,
  QuestionSchema,
  QuizSchema,
  TeamSchema,
  ThemeSchema,
  type Entry,
  type GameEvent,
  type Question,
  type Quiz,
  type Team,
  type Theme,
} from '../domain';
import {
  StoredDataError,
  type EntryTable,
  type EventScopedTable,
  type Repository,
  type Row,
  type Table,
} from './repository';

export type Clock = () => string;
const systemClock: Clock = () => new Date().toISOString();

export class ClitterDb extends Dexie {
  declare events: DexieTable<GameEvent, string>;
  declare quizzes: DexieTable<Quiz, string>;
  declare questions: DexieTable<Question, string>;
  declare themes: DexieTable<Theme, string>;
  declare teams: DexieTable<Team, string>;
  declare entries: DexieTable<Entry, string>;

  constructor(name: string) {
    super(name);
    // Only indexed fields are listed. `updatedAt` powers sync's "changed since" query.
    this.version(1).stores({
      events: 'id, updatedAt, status',
      quizzes: 'id, updatedAt',
      questions: 'id, updatedAt, status',
      teams: 'id, eventId, updatedAt',
      entries: 'id, eventId, teamId, [teamId+questionId], updatedAt',
    });
    // Never edit a shipped version: nights are stored on real laptops. Add a new version instead.
    this.version(2).stores({ themes: 'id, updatedAt' });
  }
}

export function openDatabase(name = 'clitter-glitter'): ClitterDb {
  return new ClitterDb(name);
}

const isLive = (row: Row) => row.deletedAt === undefined;

function reader<T extends Row>(schema: z.ZodType<T>, label: string): (raw: T) => T {
  return (raw) => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new StoredDataError(label, String(raw.id), z.prettifyError(parsed.error));
    }
    return parsed.data;
  };
}

function makeTable<T extends Row>(
  table: DexieTable<T, string>,
  schema: z.ZodType<T>,
  label: string,
  now: Clock,
): Table<T> {
  const read = reader(schema, label);

  return {
    async get(id) {
      const raw = await table.get(id);
      return raw && isLive(raw) ? read(raw) : undefined;
    },
    async list() {
      return (await table.toArray()).filter(isLive).map(read);
    },
    async save(row) {
      const stamped = schema.parse({ ...row, updatedAt: now() });
      await table.put(stamped);
      return stamped;
    },
    async remove(id) {
      const existing = await table.get(id);
      if (!existing || !isLive(existing)) return;
      const stamp = now();
      await table.put({ ...existing, deletedAt: stamp, updatedAt: stamp });
    },
    async changedSince(since) {
      return (await table.where('updatedAt').above(since).toArray()).map(read);
    },
  };
}

function makeEventScoped<T extends Row & { eventId: string }>(
  table: DexieTable<T, string>,
  schema: z.ZodType<T>,
  label: string,
  now: Clock,
): EventScopedTable<T> {
  const read = reader(schema, label);
  return {
    ...makeTable(table, schema, label, now),
    async forEvent(eventId) {
      const raw = await table.where('eventId').equals(eventId).toArray();
      return raw.filter(isLive).map(read);
    },
  };
}

export function createLocalRepository(db: ClitterDb, now: Clock = systemClock): Repository {
  const readEntry = reader(EntrySchema, 'entry');
  const entries: EntryTable = {
    ...makeEventScoped(db.entries, EntrySchema, 'entry', now),
    async findFor(teamId, questionId) {
      const rows = await db.entries
        .where('[teamId+questionId]')
        .equals([teamId, questionId])
        .toArray();
      const latest = rows.filter(isLive).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      return latest ? readEntry(latest) : undefined;
    },
  };

  const repo: Repository = {
    events: makeTable(db.events, EventSchema, 'event', now),
    quizzes: makeTable(db.quizzes, QuizSchema, 'quiz', now),
    questions: makeTable(db.questions, QuestionSchema, 'question', now),
    themes: makeTable(db.themes, ThemeSchema, 'theme', now),
    teams: makeEventScoped(db.teams, TeamSchema, 'team', now),
    entries,
    observe(query, next, error) {
      const subscription = liveQuery(() => query(repo)).subscribe({ next, error });
      return () => subscription.unsubscribe();
    },
  };
  return repo;
}
