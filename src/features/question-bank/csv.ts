import type { Question } from '../../domain';

export interface ImportRow {
  line: number;
  text: string;
  answer: string;
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

    if (rowText === '') errors.push({ line: record.line, message: 'The question is empty.' });
    else if (rowAnswer === '') errors.push({ line: record.line, message: 'The answer is empty.' });
    else if (!Number.isInteger(rowDifficulty) || rowDifficulty < 1 || rowDifficulty > 5) {
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
        answer: rowAnswer,
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
  const lines = [['question', 'answer', 'difficulty', 'themes']];
  for (const q of questions) {
    const names = q.themeIds.map(themeName).filter((n): n is string => n !== undefined);
    lines.push([
      guard(q.text),
      guard(q.answer),
      String(q.authorRating),
      names.map(guard).join(';'),
    ]);
  }
  return lines.map((cells) => cells.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}
