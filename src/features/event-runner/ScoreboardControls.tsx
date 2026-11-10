import { useState } from 'react';
import type { GameEvent } from '../../domain';
import { errorMessage, useRepository } from '../repository';

/** Lets the host decide what the projector shows, so results can be held back for the reveal. */
export function ScoreboardControls({ event }: { event: GameEvent }) {
  const repo = useRepository();
  const [error, setError] = useState<string>();
  const value = event.scoreboardRounds === undefined ? 'live' : String(event.scoreboardRounds);

  function change(next: string) {
    setError(undefined);
    const scoreboardRounds = next === 'live' ? undefined : Number(next);
    repo.events
      .save({ ...event, scoreboardRounds })
      .catch((err: unknown) => setError(errorMessage(err)));
  }

  return (
    <section className="card row" aria-label="Scoreboard">
      <label>
        Projector shows
        <select value={value} onChange={(e) => change(e.target.value)}>
          <option value="live">Live standings</option>
          <option value="0">Hidden</option>
          {event.quizSnapshot.rounds.slice(0, -1).map((round, i) => (
            <option key={round.id} value={i + 1}>
              After {round.title}
            </option>
          ))}
        </select>
      </label>
      <a className="button" href={`?projector=${event.id}`} target="clitter-glitter-projector">
        Open projector window
      </a>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
