import { useCallback } from 'react';
import { errorMessage, useObserve } from '../repository';

export function EventList({ onOpen }: { onOpen: (eventId: string) => void }) {
  const events = useObserve(useCallback((r) => r.events.list(), []));

  if (events.status === 'error') return <p role="alert">{errorMessage(events.error)}</p>;
  if (events.status === 'loading') return <p>Loading…</p>;
  if (events.value.length === 0) return null;

  const sorted = [...events.value].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="card" aria-labelledby="events-title">
      <h2 id="events-title">Your nights</h2>
      <ul className="events">
        {sorted.map((e) => (
          <li key={e.id}>
            <button onClick={() => onOpen(e.id)}>
              {e.venue} · {e.date}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
