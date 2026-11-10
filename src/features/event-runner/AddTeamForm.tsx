import { useState, type FormEvent } from 'react';

export function AddTeamForm({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed === '') return;
    onAdd(trimmed);
    setName('');
  }

  return (
    <form onSubmit={submit} className="row add-team">
      <label>
        Team name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button type="submit" className="primary">
        Add team
      </button>
    </form>
  );
}
