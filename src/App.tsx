import { useState } from 'react';
import { EventList } from './features/event-runner/EventList';
import { EventRunner } from './features/event-runner/EventRunner';
import { NewEventForm } from './features/event-runner/NewEventForm';
import { Projector } from './features/projector/Projector';
import { QuestionBank } from './features/question-bank/QuestionBank';
import { QuizBuilder } from './features/quiz-builder/QuizBuilder';
import { AnswerSheets } from './features/sheets/AnswerSheets';

const STORAGE_KEY = 'clitter-glitter.eventId';

const SECTIONS = [
  { id: 'nights', label: 'Nights' },
  { id: 'questions', label: 'Question bank' },
  { id: 'builder', label: 'Quiz builder' },
] as const;

function readSavedEventId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveEventId(id: string | null) {
  try {
    if (id === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private windows can block storage; the app still works, it just forgets the open night.
  }
}

export function App() {
  const [eventId, setEventId] = useState<string | null>(readSavedEventId);
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const projectorEventId = params.get('projector');
  const sheetsEventId = params.get('sheets');

  function open(id: string | null) {
    setEventId(id);
    saveEventId(id);
  }

  const [view, setView] = useState<(typeof SECTIONS)[number]['id']>('nights');

  if (projectorEventId) return <Projector eventId={projectorEventId} />;
  if (sheetsEventId) return <AnswerSheets eventId={sheetsEventId} />;

  return (
    <main>
      <h1>Clitter Glitter</h1>
      <nav aria-label="Sections" className="tabs">
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            aria-current={view === id ? 'true' : undefined}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {view === 'questions' ? (
        <QuestionBank />
      ) : view === 'builder' ? (
        <QuizBuilder />
      ) : eventId ? (
        <EventRunner eventId={eventId} onExit={() => open(null)} />
      ) : (
        <>
          <EventList onOpen={open} />
          <NewEventForm onCreated={open} />
        </>
      )}
    </main>
  );
}
