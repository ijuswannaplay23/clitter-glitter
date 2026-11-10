import { useCallback } from 'react';
import type { Entry, GameEvent, Team } from '../../domain';
import { useObserve } from '../repository';

export type Night =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; event: GameEvent | undefined; teams: Team[]; entries: Entry[] };

/** Live view of one night, shared by the host's runner and the projector window. */
export function useNight(eventId: string): Night {
  const event = useObserve(useCallback((r) => r.events.get(eventId), [eventId]));
  const teams = useObserve(useCallback((r) => r.teams.forEvent(eventId), [eventId]));
  const entries = useObserve(useCallback((r) => r.entries.forEvent(eventId), [eventId]));

  if (event.status === 'error') return event;
  if (teams.status === 'error') return teams;
  if (entries.status === 'error') return entries;
  if (event.status !== 'ready' || teams.status !== 'ready' || entries.status !== 'ready') {
    return { status: 'loading' };
  }
  return { status: 'ready', event: event.value, teams: teams.value, entries: entries.value };
}
