import { useMemo, useState } from 'react';
import type { GameEvent } from '../../domain';
import { useNight } from '../event-runner/useNight';
import { errorMessage } from '../repository';
import {
  arrangeSheets,
  hasCrowdedText,
  sheetTemplates,
  type Arrangement,
  type SheetPage,
} from './layout';

const MAX_COPIES = 60;

/** Print view: opened in its own window from the runner. Everything outside the sheets is hidden when printing. */
export function AnswerSheets({ eventId }: { eventId: string }) {
  const night = useNight(eventId);
  const [copies, setCopies] = useState(8);
  const [useTeamNames, setUseTeamNames] = useState(false);
  const [arrangement, setArrangement] = useState<Arrangement>('packet');
  const [includeText, setIncludeText] = useState(false);

  const event = night.status === 'ready' ? night.event : undefined;
  const teams = night.status === 'ready' ? night.teams : undefined;
  const hasText = (event?.questions?.length ?? 0) > 0;

  const { pages, crowded } = useMemo(() => {
    if (!event || !teams) return { pages: [], crowded: false };
    const names =
      useTeamNames && teams.length > 0
        ? [...teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => t.name)
        : Array.from({ length: copies }, () => '');
    const templates = sheetTemplates(event, includeText && hasText);
    return {
      pages: arrangeSheets(templates, names, arrangement),
      crowded: hasCrowdedText(templates),
    };
  }, [event, teams, useTeamNames, copies, arrangement, includeText, hasText]);

  if (night.status === 'error') return <p role="alert">{errorMessage(night.error)}</p>;
  if (night.status === 'loading') return <p>Loading…</p>;
  if (!event || !teams) return <p>This night was not found.</p>;

  return (
    <div className="sheets-view">
      <div className="card form no-print">
        <h1>Answer sheets</h1>
        <p className="hint">
          One page per round plus the final, each with a team-name line so pages can be collected
          separately. Answers are never printed. In the print dialog, choose Letter paper and turn
          off headers and footers.
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={useTeamNames}
            disabled={teams.length === 0}
            onChange={(e) => setUseTeamNames(e.target.checked)}
          />
          Fill in the {teams.length} team name{teams.length === 1 ? '' : 's'} already added
          {teams.length === 0 && ' (add teams in the runner first)'}
        </label>
        {!(useTeamNames && teams.length > 0) && (
          <label>
            Blank sets to print
            <input
              type="number"
              min={1}
              max={MAX_COPIES}
              value={copies}
              onChange={(e) =>
                setCopies(
                  Math.min(MAX_COPIES, Math.max(1, Math.floor(Number(e.target.value)) || 1)),
                )
              }
            />
          </label>
        )}
        <label>
          Order
          <select
            value={arrangement}
            onChange={(e) => setArrangement(e.target.value as Arrangement)}
          >
            <option value="packet">By team: each team's pages together (staple a packet)</option>
            <option value="round">
              By round: all copies of a round together (hand out one round at a time)
            </option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={includeText && hasText}
            disabled={!hasText}
            onChange={(e) => setIncludeText(e.target.checked)}
          />
          Print the question text on each sheet
          {!hasText && ' (quick nights have no question text)'}
        </label>
        {crowded && (
          <p role="note" className="crowded-note">
            Some rounds have many questions and long text, so a question may be cut off on paper.
            Check the pages below before printing, or leave the question text off.
          </p>
        )}
        <div className="row">
          <button type="button" className="primary" onClick={() => window.print()}>
            Print {pages.length} page{pages.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>

      <div className="sheets">
        {pages.map((page) => (
          <Sheet key={page.key} page={page} event={event} />
        ))}
      </div>
    </div>
  );
}

function Sheet({ page, event }: { page: SheetPage; event: GameEvent }) {
  const { template, teamName } = page;
  const wagered = template.wager.kind !== 'none';
  const showText = template.rows.some((r) => r.text !== undefined);

  return (
    <section
      className={`sheet${wagered ? ' wagered' : ''}${showText ? ' with-text' : ''}`}
      aria-label={`${template.title} sheet${teamName ? ` for ${teamName}` : ''}`}
    >
      <header>
        <h2>{event.venue}</h2>
        <p>
          {event.date} · <strong>{template.title}</strong>
        </p>
      </header>
      <div className="team-line">
        <span>Team name</span>
        {teamName ? <strong>{teamName}</strong> : <span className="blank-line" />}
      </div>
      <p className="rules">{template.rules}</p>
      {template.wager.kind === 'pool' && (
        <p className="pool">
          Wager values (cross off as you use them):{' '}
          {template.wager.values.map((v) => (
            <span key={v} className="pool-chip">
              {v}
            </span>
          ))}
        </p>
      )}
      <div className="sheet-rows">
        <div className="sheet-row head" aria-hidden="true">
          <span>#</span>
          <span>{showText ? 'Question' : ''}</span>
          <span>Answer</span>
          {wagered && <span>Wager</span>}
        </div>
        {template.rows.map((row) => (
          <div key={row.number} className="sheet-row">
            <span className="num">{row.number}</span>
            <span className="q">{row.text}</span>
            <span className="answer-line" />
            {wagered && <span className="wager-box" />}
          </div>
        ))}
      </div>
      <footer>Clitter Glitter</footer>
    </section>
  );
}
