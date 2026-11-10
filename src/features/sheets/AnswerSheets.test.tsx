import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestRepository, renderWithRepository, seedNight, seedTeam } from '../test-utils';
import { AnswerSheets } from './AnswerSheets';

afterEach(() => {
  vi.restoreAllMocks();
});

async function setup(options: Parameters<typeof seedNight>[1] = {}, teams: string[] = []) {
  const repo = createTestRepository();
  const { event } = await seedNight(repo, {
    rounds: 2,
    questionsPerRound: 3,
    preset: 'escalating',
    withFinal: true,
    snapshotQuestions: true,
    ...options,
  });
  for (const name of teams) await seedTeam(repo, event.id, name);
  renderWithRepository(<AnswerSheets eventId={event.id} />, repo);
  return { repo, event };
}

const sheets = () => screen.getAllByRole('region');

describe('AnswerSheets', () => {
  it('prints 8 blank sets by default: one page per round plus the final', async () => {
    await setup();
    await screen.findByRole('heading', { name: 'Answer sheets' });
    expect(sheets()).toHaveLength(24);
    expect(screen.getByRole('button', { name: 'Print 24 pages' })).toBeTruthy();
  });

  it('lets the host change how many blank sets to print', async () => {
    await setup();
    fireEvent.change(await screen.findByLabelText('Blank sets to print'), {
      target: { value: '3' },
    });
    expect(sheets()).toHaveLength(9);
  });

  it('shows the venue, date, a team-name line, and the wager values to cross off', async () => {
    await setup();
    const [first] = await screen.findAllByRole('region', { name: 'Round 1 sheet' });
    const page = within(first as HTMLElement);
    expect(page.getByText('Test Bar')).toBeTruthy();
    expect(page.getByText(/2026-01-01/)).toBeTruthy();
    expect(page.getByText('Team name')).toBeTruthy();
    expect(page.getByText(/Wager values/)).toBeTruthy();
    expect(page.getAllByText(/^[1-3]$/, { selector: '.pool-chip' })).toHaveLength(3);
    expect(page.getAllByText('Answer')).toHaveLength(1);
    expect(page.getAllByText('Wager')).toHaveLength(1);
  });

  it('omits the wager column on a round with no wagers', async () => {
    await setup({ preset: 'classic', withFinal: false });
    const [first] = await screen.findAllByRole('region', { name: 'Round 1 sheet' });
    expect(within(first as HTMLElement).queryByText('Wager')).toBeNull();
  });

  it('prefills the team names already added and prints one set each', async () => {
    await setup({}, ['Quiz Khalifa', 'Les Quizerables']);
    fireEvent.click(await screen.findByLabelText(/Fill in the 2 team names/));

    expect(screen.queryByLabelText('Blank sets to print')).toBeNull();
    expect(sheets()).toHaveLength(6);
    expect(
      screen.getAllByRole('region', { name: 'Round 1 sheet for Les Quizerables' }),
    ).toHaveLength(1);
    expect(
      screen.getByRole('region', { name: 'Final question sheet for Quiz Khalifa' }),
    ).toBeTruthy();
  });

  it('orders pages by team or by round', async () => {
    await setup({ withFinal: false }, ['Ann', 'Bo']);
    fireEvent.click(await screen.findByLabelText(/Fill in the 2 team names/));
    const labels = () => sheets().map((s) => s.getAttribute('aria-label'));

    expect(labels()).toEqual([
      'Round 1 sheet for Ann',
      'Round 2 sheet for Ann',
      'Round 1 sheet for Bo',
      'Round 2 sheet for Bo',
    ]);
    fireEvent.change(screen.getByLabelText('Order'), { target: { value: 'round' } });
    expect(labels()).toEqual([
      'Round 1 sheet for Ann',
      'Round 1 sheet for Bo',
      'Round 2 sheet for Ann',
      'Round 2 sheet for Bo',
    ]);
  });

  it('prints question text on request but never the answers', async () => {
    await setup();
    await screen.findByRole('heading', { name: 'Answer sheets' });
    expect(screen.queryByText('Question 1')).toBeNull();

    fireEvent.click(screen.getByLabelText(/Print the question text/));
    expect(screen.getAllByText('Question 1').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('Answer 1');
  });

  it('disables the question-text option for a quick night', async () => {
    await setup({ snapshotQuestions: false });
    const box = await screen.findByLabelText(/Print the question text/);
    expect((box as HTMLInputElement).disabled).toBe(true);
  });

  it('opens the print dialog from the button', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    await setup();
    fireEvent.click(await screen.findByRole('button', { name: /^Print \d+ pages$/ }));
    expect(print).toHaveBeenCalledOnce();
  });

  it('says so when the night does not exist', async () => {
    renderWithRepository(<AnswerSheets eventId="missing" />);
    expect(await screen.findByText('This night was not found.')).toBeTruthy();
  });
});
