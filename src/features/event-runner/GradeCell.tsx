import { useRef } from 'react';
import type { Entry } from '../../domain';

type State = Entry['state'];

const CHOICES: { state: State; symbol: string; name: string }[] = [
  { state: 'correct', symbol: '✓', name: 'Correct' },
  { state: 'wrong', symbol: '✗', name: 'Wrong' },
  { state: 'blank', symbol: '–', name: 'No answer' },
];

interface Props {
  label: string;
  state: State | undefined;
  wager: number | undefined;
  showWager: boolean;
  /** `null` clears the grade. `wager` is whatever is typed in the box right now. */
  onGrade: (state: State | null, wager: number | undefined) => void;
  onWager: (wager: number | undefined) => void;
}

/**
 * The wager box is uncontrolled: it keeps its own text while typing, because the saved value
 * only arrives back from the database a moment later and would drop fast keystrokes.
 */
export function GradeCell({ label, state, wager, showWager, onGrade, onWager }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const typed = (): number | undefined => {
    const text = input.current?.value ?? '';
    return text === '' ? undefined : Number(text);
  };

  return (
    <div className="cell">
      {showWager && (
        <input
          ref={input}
          type="number"
          min={0}
          inputMode="numeric"
          className="wager"
          aria-label={`${label}: wager`}
          defaultValue={wager ?? ''}
          onChange={() => {
            if (state !== undefined) onWager(typed());
          }}
        />
      )}
      <div className="grades">
        {CHOICES.map((choice) => (
          <button
            key={choice.state}
            type="button"
            className={`grade ${choice.state}`}
            aria-pressed={state === choice.state}
            aria-label={`${label}: ${choice.name}`}
            onClick={() => onGrade(state === choice.state ? null : choice.state, typed())}
          >
            {choice.symbol}
          </button>
        ))}
      </div>
    </div>
  );
}
