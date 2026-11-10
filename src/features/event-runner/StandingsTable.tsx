import type { Team } from '../../domain';
import type { TeamStanding } from '../../scoring';

interface Props {
  standings: TeamStanding[];
  teams: Team[];
  roundIndex: number;
  roundTitle: string;
}

export function StandingsTable({ standings, teams, roundIndex, roundTitle }: Props) {
  const names = new Map(teams.map((t) => [t.id, t.name]));

  return (
    <section className="card" aria-labelledby="standings-title">
      <h2 id="standings-title">Standings</h2>
      {standings.length === 0 ? (
        <p className="hint">Add teams to see standings.</p>
      ) : (
        <table aria-label="Standings">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Team</th>
              <th scope="col">{roundTitle}</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <tr key={s.teamId}>
                <td>{s.rank}</td>
                <th scope="row">{names.get(s.teamId)}</th>
                <td>{s.roundPoints[roundIndex] ?? 0}</td>
                <td className="total">{s.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <NeedsReview standings={standings} names={names} />
    </section>
  );
}

function NeedsReview({
  standings,
  names,
}: {
  standings: TeamStanding[];
  names: Map<string, string>;
}) {
  const flags = standings.flatMap((s) => s.flags);
  if (flags.length === 0) return null;
  return (
    <div className="review">
      <h3>Needs review</h3>
      <ul>
        {flags.map((f, i) => (
          <li key={`${f.kind}-${f.entryIds.join('-')}-${i}`}>
            <strong>{names.get(f.teamId) ?? 'Unknown team'}:</strong> {f.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
