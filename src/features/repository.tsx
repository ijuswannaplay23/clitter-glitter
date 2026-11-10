import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Repository } from '../data';

const RepositoryContext = createContext<Repository | null>(null);

export function RepositoryProvider({ repo, children }: { repo: Repository; children: ReactNode }) {
  return <RepositoryContext.Provider value={repo}>{children}</RepositoryContext.Provider>;
}

export function useRepository(): Repository {
  const repo = useContext(RepositoryContext);
  if (!repo) throw new Error('useRepository must be used inside <RepositoryProvider>');
  return repo;
}

export type Observed<T> =
  { status: 'loading' } | { status: 'ready'; value: T } | { status: 'error'; error: unknown };

/** Live query. `query` must be memoized (useCallback) or the subscription restarts every render. */
export function useObserve<T>(query: (repo: Repository) => Promise<T>): Observed<T> {
  const repo = useRepository();
  const [state, setState] = useState<Observed<T>>({ status: 'loading' });

  useEffect(
    () =>
      repo.observe(
        query,
        (value) => setState({ status: 'ready', value }),
        (error) => setState({ status: 'error', error }),
      ),
    [repo, query],
  );

  return state;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
