import { useMemo } from 'react';
import { standings as computeStandings } from '../../scoring';
import { useNight } from '../event-runner/useNight';
import { choiceLetter } from '../question-bank/choices';
import { errorMessage } from '../repository';
import { projectedQuestion, roundsShown, scoreboardTitle } from './scoreboard';

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen();
}

/** Read-only scoreboard for the room's screen. Opened in its own window from the runner. */
export function Projector({ eventId }: { eventId: string }) {
  const night = useNight(eventId);
  const event = night.status === 'ready' ? night.event : undefined;
  const teams = night.status === 'ready' ? night.teams : undefined;
  const entries = night.status === 'ready' ? night.entries : undefined;
  const shown = event ? roundsShown(event) : 0;

  const rows = useMemo(
    () =>
      event && teams && entries && shown > 0
        ? computeStandings({
            // Ties keep this order, so sort by name to keep the board stable between refreshes.
            teamIds: [...teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => t.id),
            rounds: event.quizSnapshot.rounds,
            entries,
            rules: event.rules,
            roundsCounted: shown,
          })
        : [],
    [event, teams, entries, shown],
  );

  if (night.status === 'error') {
    return (
      <main className="projector">
        <p role="alert">{errorMessage(night.error)}</p>
      </main>
    );
  }
  if (night.status === 'loading') {
    return (
      <main className="projector">
        <p>Loading…</p>
      </main>
    );
  }
  if (!event || !teams) {
    return (
      <main className="projector">
        <p>This night was not found.</p>
      </main>
    );
  }

  const names = new Map(teams.map((t) => [t.id, t.name]));
  const question = projectedQuestion(event);

  if (question) {
    return (
      <main className="projector">
        <header>
          <h1>{event.venue}</h1>
          <p className="subtitle">
            {question.roundTitle} · Question {question.number} of {question.of}
          </p>
        </header>
        <p className="question" aria-label="Question">
          {question.text}
        </p>
        {question.choices && (
          <ol className="choices" aria-label="Choices">
            {question.choices.map((choice, i) => (
              <li key={i}>
                <span className="letter">{choiceLetter(i)}</span>
                {choice}
              </li>
            ))}
          </ol>
        )}
        <button type="button" className="fullscreen" onClick={toggleFullscreen}>
          Fullscreen
        </button>
      </main>
    );
  }

  return (
    <main className="projector">
      <header>
        <h1>{event.venue}</h1>
        <p className="subtitle">{scoreboardTitle(event)}</p>
      </header>
      {shown === 0 ? (
        <p className="message">Scores are hidden until the reveal.</p>
      ) : rows.length === 0 ? (
        <p className="message">Waiting for teams…</p>
      ) : (
        <ol className="board" aria-label="Standings">
          {rows.map((row) => (
            <li key={row.teamId} data-rank={row.rank}>
              <span className="rank">{row.rank}</span>
              <span className="name">{names.get(row.teamId)}</span>
              <span className="score">{row.total}</span>
            </li>
          ))}
        </ol>
      )}
      <button type="button" className="fullscreen" onClick={toggleFullscreen}>
        Fullscreen
      </button>
    </main>
  );
}
