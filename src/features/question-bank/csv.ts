import { MAX_CHOICES, MIN_CHOICES, type Question } from '../../domain';

export interface ImportRow {
  line: number;
  text: string;
  answer: string;
  choices?: string[] | undefined;
  difficulty: number;
  themes: string[];
}

export interface ImportError {
  line: number;
  message: string;
}

export interface ParsedQuestions {
  rows: ImportRow[];
  errors: ImportError[];
}

const DEFAULT_DIFFICULTY = 3;
const CHOICE_COLUMNS = Array.from({ length: MAX_CHOICES }, (_, i) => `choice${i + 1}`);

/** The answer may be a choice's text or its letter (A, B, ...); returns the choice's text. */
function checkChoices(choices: string[], answer: string): { answer: string } | { message: string } {
  if (choices.length < MIN_CHOICES)
    return { message: 'A multiple-choice question needs at least 2 choices.' };
  const key = (s: string) => s.trim().toLowerCase();
  if (new Set(choices.map(key)).size !== choices.length)
    return { message: 'Two choices are the same.' };
  const byText = choices.find((c) => key(c) === key(answer));
  const byLetter = choices[answer.trim().toUpperCase().charCodeAt(0) - 65];
  const match = byText ?? (answer.trim().length === 1 ? byLetter : undefined);
  return match === undefined
    ? { message: `The answer "${answer}" is not one of the choices.` }
    : { answer: match };
}

// A spreadsheet runs cells that start like a formula. Questions come from other people, so exported
// cells that could be read as one get a leading apostrophe; import removes it again.
const FORMULA_START = /^([=@]|[+-](?!\d))/;
const guard = (cell: string) => (FORMULA_START.test(cell) ? `'${cell}` : cell);
const unguard = (cell: string) =>
  cell.startsWith("'") && FORMULA_START.test(cell.slice(1)) ? cell.slice(1) : cell;

/** RFC 4180 style: quoted fields may hold commas, doubled quotes and line breaks. */
function parseCsv(input: string): { line: number; cells: string[] }[] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const records: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let startLine = 1;

  const endRecord = () => {
    cells.push(cell);
    if (cells.some((c) => c.trim() !== '')) records.push({ line: startLine, cells });
    cells = [];
    cell = '';
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (quoted) {
      if (ch === '"' && text.charAt(i + 1) === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        if (ch === '\n') line++;
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      cells.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text.charAt(i + 1) === '\n') i++;
      endRecord();
      line++;
      startLine = line;
    } else {
      cell += ch;
    }
  }
  endRecord();
  return records;
}

export function parseQuestionCsv(text: string): ParsedQuestions {
  const records = parseCsv(text);
  const header = records[0];
  if (!header) return { rows: [], errors: [{ line: 1, message: 'The file is empty.' }] };

  const columns = header.cells.map((c) => c.trim().toLowerCase());
  const col = (name: string) => columns.indexOf(name);
  const [question, answer, difficulty, themes] = ['question', 'answer', 'difficulty', 'themes'].map(
    col,
  );
  const choiceColumns = CHOICE_COLUMNS.map(col).filter((i) => i >= 0);
  if (question === undefined || question < 0 || answer === undefined || answer < 0) {
    return {
      rows: [],
      errors: [
        { line: header.line, message: 'The first row must have "question" and "answer" columns.' },
      ],
    };
  }

  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];
  for (const record of records.slice(1)) {
    const get = (index: number | undefined) =>
      index === undefined || index < 0 ? '' : unguard((record.cells[index] ?? '').trim());
    const rowText = get(question);
    const rowAnswer = get(answer);
    const rawDifficulty = get(difficulty);
    const rowDifficulty = rawDifficulty === '' ? DEFAULT_DIFFICULTY : Number(rawDifficulty);

    const rowChoices = choiceColumns.map(get).filter((c) => c !== '');
    const choiceProblem = rowChoices.length > 0 ? checkChoices(rowChoices, rowAnswer) : undefined;

    if (rowText === '') errors.push({ line: record.line, message: 'The question is empty.' });
    else if (rowAnswer === '') errors.push({ line: record.line, message: 'The answer is empty.' });
    else if (choiceProblem && 'message' in choiceProblem) {
      errors.push({ line: record.line, message: choiceProblem.message });
    } else if (!Number.isInteger(rowDifficulty) || rowDifficulty < 1 || rowDifficulty > 5) {
      errors.push({
        line: record.line,
        message: `Difficulty "${rawDifficulty}" must be a whole number from 1 to 5.`,
      });
    } else {
      const seen = new Set<string>();
      const rowThemes = get(themes)
        .split(';')
        .map((t) => t.trim())
        .filter((t) => t !== '' && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()));
      rows.push({
        line: record.line,
        text: rowText,
        answer: choiceProblem ? choiceProblem.answer : rowAnswer,
        choices: choiceProblem ? rowChoices : undefined,
        difficulty: rowDifficulty,
        themes: rowThemes,
      });
    }
  }
  return { rows, errors };
}

const escapeCell = (cell: string) =>
  /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;

export function questionsToCsv(
  questions: Question[],
  themeName: (id: string) => string | undefined,
): string {
  // Only as many choice columns as the widest question needs, so banks without any look as before.
  const columns = CHOICE_COLUMNS.slice(
    0,
    Math.max(0, ...questions.map((q) => q.choices?.length ?? 0)),
  );
  const lines = [['question', 'answer', 'difficulty', 'themes', ...columns]];
  for (const q of questions) {
    const names = q.themeIds.map(themeName).filter((n): n is string => n !== undefined);
    lines.push([
      guard(q.text),
      guard(q.answer),
      String(q.authorRating),
      names.map(guard).join(';'),
      ...columns.map((_, i) => guard(q.choices?.[i] ?? '')),
    ]);
  }
  return lines.map((cells) => cells.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}
