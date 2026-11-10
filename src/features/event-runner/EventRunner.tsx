import { useMemo, useState } from 'react';
import { newId } from '../../data';
import type { Entry, Team } from '../../domain';
import { standings as computeStandings } from '../../scoring';
import { errorMessage, useRepository } from '../repository';
import { AddTeamForm } from './AddTeamForm';
import { GradeCell } from './GradeCell';
import { describeRound } from './presets';
import { RoundQuestions } from './RoundQuestions';
import { ScoreboardControls } from './ScoreboardControls';
import { StandingsTable } from './StandingsTable';
import { useNight } from './useNight';

export function EventRunner({ eventId, onExit }: { eventId: string; onExit: () => void }) {
  const repo = useRepository();
  const night = useNight(eventId);
  const [roundIndex, setRoundIndex] = useState(0);
  const [actionError, setActionError] = useState<string>();

  const eventRow = night.status === 'ready' ? night.event : undefined;
  const teamRows = night.status === 'ready' ? night.teams : undefined;
  const entryRows = night.status === 'ready' ? night.entries : undefined;

  const standings = useMemo(
    () =>
      eventRow && teamRows && entryRows
        ? computeStandings({
            teamIds: [...teamRows].sort((a, b) => a.name.localeCompare(b.name)).map((t) => t.id),
            rounds: eventRow.quizSnapshot.rounds,
            entries: entryRows,
            rules: eventRow.rules,
          })
        : [],
    [eventRow, teamRows, entryRows],
  );

  if (night.status === 'error') return <p role="alert">{errorMessage(night.error)}</p>;
  if (night.status === 'loading' || !teamRows || !entryRows) return <p>Loading…</p>;
  if (!eventRow) {
    return (
      <p>
        That night was not found. <button onClick={onExit}>Back to events</button>
      </p>
    );
  }

  const rounds = eventRow.quizSnapshot.rounds;
  const round = rounds[roundIndex] ?? rounds[0];
  const teamList = [...teamRows].sort((a, b) => a.name.localeCompare(b.name));
  const entryFor = (teamId: string, questionId: string) =>
    entryRows.find((e) => e.teamId === teamId && e.questionId === questionId);

  function run(action: Promise<unknown>) {
    setActionError(undefined);
    action.catch((err: unknown) => setActionError(errorMessage(err)));
  }

  async function grade(
    team: Team,
    questionId: string,
    state: Entry['state'] | null,
    wager: number | undefined,
  ) {
    const existing = await repo.entries.findFor(team.id, questionId);
    if (state === null) {
      if (existing) await repo.entries.remove(existing.id);
      return;
    }
    const now = new Date().toISOString();
    await repo.entries.save({
      id: existing?.id ?? newId(),
      eventId,
      teamId: team.id,
      questionId,
      state,
      wager: wager ?? existing?.wager,
      gradedAt: now,
      updatedAt: now,
    });
  }

  async function setWager(team: Team, questionId: string, wager: number | undefined) {
    const existing = await repo.entries.findFor(team.id, questionId);
    if (existing) await repo.entries.save({ ...existing, wager });
  }

  async function addTeam(name: string) {
    await repo.teams.save({
      id: newId(),
      eventId,
      name,
      updatedAt: new Date().toISOString(),
    });
  }

  function removeTeam(team: Team) {
    if (window.confirm(`Remove ${team.name} from tonight?`)) run(repo.teams.remove(team.id));
  }

  if (!round) return <p>This night has no rounds.</p>;
  const showWager = round.kind === 'final' || round.rules.wager.mode !== 'none';

  return (
    <div className="runner">
      <div className="bar">
        <button onClick={onExit}>← Events</button>
        <h2>
          {eventRow.venue} · {eventRow.date}
        </h2>
        <a className="button" href={`?sheets=${eventId}`} target="clitter-glitter-sheets">
          Print answer sheets
        </a>
      </div>

      <nav aria-label="Rounds" className="tabs">
        {rounds.map((r, i) => (
          <button
            key={r.id}
            aria-current={i === roundIndex ? 'true' : undefined}
            onClick={() => setRoundIndex(i)}
          >
            {r.kind === 'final' ? 'Final' : `R${i + 1}`}
          </button>
        ))}
      </nav>

      <ScoreboardControls event={eventRow} />

      {actionError && <p role="alert">{actionError}</p>}

      <section className="card" aria-labelledby="grading-title">
        <h2 id="grading-title">{round.title}</h2>
        <p className="hint">{describeRound(round)}</p>
        <RoundQuestions
          round={round}
          questions={eventRow.questions}
          projectedId={eventRow.projectorQuestionId}
          onProject={(projectorQuestionId) =>
            run(repo.events.save({ ...eventRow, projectorQuestionId }))
          }
        />
        {teamList.length === 0 ? (
          <p className="hint">Add your first team below.</p>
        ) : (
          <div className="scroll">
            <table aria-label="Grading">
              <thead>
                <tr>
                  <th scope="col">Team</th>
                  {round.questionIds.map((id, i) => (
                    <th scope="col" key={id}>
                      Q{i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamList.map((team) => (
                  <tr key={team.id}>
                    <th scope="row">
                      {team.name}{' '}
                      <button
                        className="link"
                        aria-label={`Remove ${team.name}`}
                        onClick={() => removeTeam(team)}
                      >
                        ✕
                      </button>
                    </th>
                    {round.questionIds.map((qid, i) => {
                      const entry = entryFor(team.id, qid);
                      return (
                        <td key={qid}>
                          <GradeCell
                            label={`${team.name} Q${i + 1}`}
                            state={entry?.state}
                            wager={entry?.wager}
                            showWager={showWager}
                            onGrade={(state, wager) => run(grade(team, qid, state, wager))}
                            onWager={(wager) => run(setWager(team, qid, wager))}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AddTeamForm onAdd={(name) => run(addTeam(name))} />
      </section>

      <StandingsTable
        standings={standings}
        teams={teamRows}
        roundIndex={roundIndex}
        roundTitle={round.title}
      />
    </div>
  );
}
