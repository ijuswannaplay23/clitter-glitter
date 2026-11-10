import { describe, expect, it } from 'vitest';
import type { Question } from '../../domain';
import { parseQuestionCsv, questionsToCsv } from './csv';

const question = (text: string, answer: string, rating = 3, themeIds: string[] = []): Question => ({
  id: 'id',
  updatedAt: '2026-01-01T00:00:00.000Z',
  text,
  answer,
  authorRating: rating,
  themeIds,
  status: 'approved',
});

describe('multiple-choice CSV', () => {
  const header = 'question,answer,difficulty,themes,choice1,choice2,choice3,choice4\n';

  it('reads choices and accepts the answer as text (any case) or as a letter', () => {
    const { rows, errors } = parseQuestionCsv(
      `${header}Capital?,rome,,,Paris,Rome,Oslo,\nCapital?2,C,,,Paris,Rome,Oslo,\n`,
    );
    expect(errors).toEqual([]);
    expect(rows.map((r) => [r.answer, r.choices])).toEqual([
      ['Rome', ['Paris', 'Rome', 'Oslo']],
      ['Oslo', ['Paris', 'Rome', 'Oslo']],
    ]);
  });

  it('rejects an answer that is not a choice, one choice, and repeated choices', () => {
    const { rows, errors } = parseQuestionCsv(
      `${header}A?,Berlin,,,Paris,Rome,,\nB?,Paris,,,Paris,,,\nC?,Paris,,,Paris,paris,,\n`,
    );
    expect(rows).toEqual([]);
    expect(errors.map((e) => e.message)).toEqual([
      'The answer "Berlin" is not one of the choices.',
      'A multiple-choice question needs at least 2 choices.',
      'Two choices are the same.',
    ]);
  });

  it('leaves questions without choice cells open-ended', () => {
    const { rows } = parseQuestionCsv(`${header}Q?,A,,,,,,\n`);
    expect(rows[0]?.choices).toBeUndefined();
  });

  it('round-trips choices through export and import', () => {
    const q = { ...question('Capital?', 'Rome'), choices: ['Paris', 'Rome', '=Oslo'] };
    const csv = questionsToCsv([q], () => undefined);
    const { rows, errors } = parseQuestionCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ answer: 'Rome', choices: ['Paris', 'Rome', '=Oslo'] });
  });
});

describe('parseQuestionCsv', () => {
  it('reads rows with difficulty and ";" separated themes', () => {
    const { rows, errors } = parseQuestionCsv(
      'question,answer,difficulty,themes\nCapital of France?,Paris,1,Geography; Europe\n',
    );
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        line: 2,
        text: 'Capital of France?',
        answer: 'Paris',
        difficulty: 1,
        themes: ['Geography', 'Europe'],
      },
    ]);
  });

  it('handles quoted commas, doubled quotes, line breaks inside quotes, CRLF and a BOM', () => {
    const csv =
      '﻿Question,Answer\r\n"Name this, if you can","He said ""hi"""\r\n"Two\nlines",Yes\r\n';
    const { rows, errors } = parseQuestionCsv(csv);
    expect(errors).toEqual([]);
    expect(rows.map((r) => [r.text, r.answer])).toEqual([
      ['Name this, if you can', 'He said "hi"'],
      ['Two\nlines', 'Yes'],
    ]);
  });

  it('defaults difficulty to 3, accepts any column order, and ignores blank lines', () => {
    const { rows } = parseQuestionCsv('answer,question\n\nParis,Capital of France?\n\n');
    expect(rows).toEqual([
      { line: 3, text: 'Capital of France?', answer: 'Paris', difficulty: 3, themes: [] },
    ]);
  });

  it('collapses repeated themes ignoring case', () => {
    const { rows } = parseQuestionCsv('question,answer,themes\nQ,A,Movies;movies; MOVIES ;Music\n');
    expect(rows[0]?.themes).toEqual(['Movies', 'Music']);
  });

  it('reports bad rows with their line number and keeps the good ones', () => {
    const { rows, errors } = parseQuestionCsv(
      'question,answer,difficulty\nGood,Yes,2\n,No answer text,1\nNo answer,,1\nBad level,Yes,9\nWord level,Yes,hard\n',
    );
    expect(rows.map((r) => r.text)).toEqual(['Good']);
    expect(errors).toEqual([
      { line: 3, message: 'The question is empty.' },
      { line: 4, message: 'The answer is empty.' },
      { line: 5, message: 'Difficulty "9" must be a whole number from 1 to 5.' },
      { line: 6, message: 'Difficulty "hard" must be a whole number from 1 to 5.' },
    ]);
  });

  it('rejects a file without the required columns', () => {
    expect(parseQuestionCsv('foo,bar\n1,2\n').errors[0]?.message).toContain(
      '"question" and "answer"',
    );
    expect(parseQuestionCsv('').errors[0]?.message).toBe('The file is empty.');
  });
});

describe('questionsToCsv', () => {
  it('writes a header, quotes cells that need it, and uses theme names', () => {
    const csv = questionsToCsv(
      [question('Name this, if you can', 'He said "hi"', 4, ['t1', 't2', 'gone'])],
      (id) => ({ t1: 'Movies', t2: 'Music' })[id],
    );
    expect(csv).toBe(
      'question,answer,difficulty,themes\r\n"Name this, if you can","He said ""hi""",4,Movies;Music\r\n',
    );
  });

  it('round-trips through the parser, including multi-line text', () => {
    const original = [question('Line one\nLine two, with comma', 'Answer "quoted"', 5, ['t1'])];
    const { rows } = parseQuestionCsv(questionsToCsv(original, () => 'Movies'));
    expect(rows[0]).toMatchObject({
      text: 'Line one\nLine two, with comma',
      answer: 'Answer "quoted"',
      difficulty: 5,
      themes: ['Movies'],
    });
  });

  it('defuses spreadsheet formulas on export and restores them on import, but leaves negative numbers alone', () => {
    const csv = questionsToCsv(
      [
        question('=HYPERLINK("http://x")', '-273', 2),
        question('@cmd', '+cmd', 2),
        question('-x', '5', 2),
      ],
      () => undefined,
    );
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).toContain(',-273,');
    expect(csv).toContain("'@cmd");
    expect(csv).toContain("'+cmd");

    const { rows } = parseQuestionCsv(csv);
    expect(rows.map((r) => [r.text, r.answer])).toEqual([
      ['=HYPERLINK("http://x")', '-273'],
      ['@cmd', '+cmd'],
      ['-x', '5'],
    ]);
  });
});
