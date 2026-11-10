import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../domain';
import { createTestRepository, seedNight } from '../test-utils';
import { arrangeSheets, hasCrowdedText, sheetTemplates } from './layout';

async function night(options: Parameters<typeof seedNight>[1] = {}): Promise<GameEvent> {
  const { event } = await seedNight(createTestRepository(), {
    rounds: 2,
    questionsPerRound: 3,
    preset: 'escalating',
    withFinal: true,
    snapshotQuestions: true,
    ...options,
  });
  return event;
}

describe('sheetTemplates', () => {
  it('makes one page per round plus the final, with a row per question', async () => {
    const templates = sheetTemplates(await night(), false);
    expect(templates.map((t) => [t.title, t.rows.length])).toEqual([
      ['Round 1', 3],
      ['Round 2', 3],
      ['Final question', 1],
    ]);
    expect(templates[0]?.rows.map((r) => r.number)).toEqual([1, 2, 3]);
  });

  it('describes the wager box for each kind of round', async () => {
    const wagered = sheetTemplates(await night(), false);
    expect(wagered[0]?.wager).toEqual({ kind: 'pool', values: [1, 2, 3] });
    expect(wagered[1]?.wager).toEqual({ kind: 'pool', values: [2, 3, 4] });
    expect(wagered[2]?.wager).toEqual({ kind: 'final' });

    const plain = sheetTemplates(await night({ preset: 'classic', withFinal: false }), false);
    expect(plain[0]?.wager).toEqual({ kind: 'none' });
  });

  it('carries the player-facing rules sentence', async () => {
    const [first] = sheetTemplates(await night(), false);
    expect(first?.rules).toBe(
      'Wager each of 1, 2, 3 at most once; skipping a value is fine. Wrong loses the wager.',
    );
  });

  it('prints question text only when asked, and never an answer', async () => {
    const event = await night();
    const without = sheetTemplates(event, false);
    expect(without.flatMap((t) => t.rows).every((r) => r.text === undefined)).toBe(true);

    const withText = sheetTemplates(event, true);
    expect(withText[0]?.rows.map((r) => r.text)).toEqual([
      'Question 1',
      'Question 2',
      'Question 3',
    ]);
    expect(JSON.stringify(withText)).not.toContain('Answer');
  });

  it('leaves text empty for a quick night that has no question text', async () => {
    const event = await night({ snapshotQuestions: false });
    expect(sheetTemplates(event, true)[0]?.rows.every((r) => r.text === undefined)).toBe(true);
  });
});

describe('hasCrowdedText', () => {
  const template = (rows: number, length: number) => ({
    roundId: 'r',
    title: 'Round 1',
    rules: '',
    wager: { kind: 'none' as const },
    rows: Array.from({ length: rows }, (_, i) => ({ number: i + 1, text: 'x'.repeat(length) })),
  });

  it('flags many rows with long text, but not short text or few rows', () => {
    expect(hasCrowdedText([template(15, 200)])).toBe(true);
    expect(hasCrowdedText([template(15, 40)])).toBe(false);
    expect(hasCrowdedText([template(5, 200)])).toBe(false);
  });
});

describe('arrangeSheets', () => {
  it('packet: every page of one team together, then the next team', async () => {
    const templates = sheetTemplates(await night({ withFinal: false }), false);
    const pages = arrangeSheets(templates, ['Ann', 'Bo'], 'packet');
    expect(pages.map((p) => `${p.teamName}:${p.template.title}`)).toEqual([
      'Ann:Round 1',
      'Ann:Round 2',
      'Bo:Round 1',
      'Bo:Round 2',
    ]);
  });

  it('round: all copies of a round together so each round can be handed out at once', async () => {
    const templates = sheetTemplates(await night({ withFinal: false }), false);
    const pages = arrangeSheets(templates, ['Ann', 'Bo'], 'round');
    expect(pages.map((p) => `${p.teamName}:${p.template.title}`)).toEqual([
      'Ann:Round 1',
      'Bo:Round 1',
      'Ann:Round 2',
      'Bo:Round 2',
    ]);
  });

  it('gives blank sheets empty names and unique keys', async () => {
    const templates = sheetTemplates(await night(), false);
    const pages = arrangeSheets(templates, ['', '', ''], 'packet');
    expect(pages).toHaveLength(9);
    expect(pages.every((p) => p.teamName === '')).toBe(true);
    expect(new Set(pages.map((p) => p.key)).size).toBe(9);
  });
});
