import type { Entry, GameEvent, Question, Quiz, Team, Theme } from '../domain';

export interface Row {
  id: string;
  updatedAt: string;
  deletedAt?: string | undefined;
}

/** A stored row failed validation on read. Surfaced loudly so bad data never reaches a scoreboard. */
export class StoredDataError extends Error {
  constructor(table: string, id: string, detail: string) {
    super(`Stored ${table} row ${id} is invalid:\n${detail}`);
    this.name = 'StoredDataError';
  }
}

/** Soft-deleting tables: `list` and `get` hide deleted rows; `changedSince` keeps them for sync. */
export interface Table<T extends Row> {
  get(id: string): Promise<T | undefined>;
  list(): Promise<T[]>;
  /** Validates the row, stamps `updatedAt` with the current time, stores it, and returns it. */
  save(row: T): Promise<T>;
  /** Soft delete. A missing or already-deleted id is a no-op. */
  remove(id: string): Promise<void>;
  /** Rows (including deleted) with `updatedAt` strictly after `since`. */
  changedSince(since: string): Promise<T[]>;
}

export interface EventScopedTable<T extends Row & { eventId: string }> extends Table<T> {
  forEvent(eventId: string): Promise<T[]>;
}

export interface EntryTable extends EventScopedTable<Entry> {
  /** The live entry for a team on a question. If duplicates exist, the most recently updated. */
  findFor(teamId: string, questionId: string): Promise<Entry | undefined>;
}

export interface Repository {
  events: Table<GameEvent>;
  quizzes: Table<Quiz>;
  questions: Table<Question>;
  themes: Table<Theme>;
  teams: EventScopedTable<Team>;
  entries: EntryTable;
  /**
   * Re-runs `query` whenever the data it read changes, including changes made from another window
   * of the app. Returns an unsubscribe function.
   */
  observe<T>(
    query: (repo: Repository) => Promise<T>,
    next: (value: T) => void,
    error: (error: unknown) => void,
  ): () => void;
}
