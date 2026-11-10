import { fireEvent, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { App } from './App';
import { createTestRepository, renderWithRepository, seedNight } from './features/test-utils';

afterEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/');
});

it('shows the title and starts a night from the new-night form', async () => {
  renderWithRepository(<App />);
  expect(screen.getByRole('heading', { level: 1, name: 'Clitter Glitter' })).toBeTruthy();

  fireEvent.change(screen.getByLabelText('Venue'), { target: { value: 'Test Bar' } });
  fireEvent.click(screen.getByRole('button', { name: 'Start night' }));

  expect(await screen.findByRole('heading', { name: /Test Bar/ })).toBeTruthy();
  expect(screen.getByRole('navigation', { name: 'Rounds' })).toBeTruthy();
});

it('switches between nights and the question bank, keeping the open night', async () => {
  const repo = createTestRepository();
  const { event } = await seedNight(repo);
  localStorage.setItem('clitter-glitter.eventId', event.id);
  renderWithRepository(<App />, repo);

  expect(await screen.findByRole('heading', { name: /Test Bar/ })).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Question bank' }));
  expect(await screen.findByRole('heading', { name: 'Add a question' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: /Test Bar/ })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Nights' }));
  expect(await screen.findByRole('heading', { name: /Test Bar/ })).toBeTruthy();
});

it('renders only the answer sheets when the URL asks for them', async () => {
  const repo = createTestRepository();
  const { event } = await seedNight(repo);
  window.history.pushState({}, '', `/?sheets=${event.id}`);

  renderWithRepository(<App />, repo);

  expect(await screen.findByRole('heading', { name: 'Answer sheets' })).toBeTruthy();
  expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeNull();
});

it('renders only the projector view when the URL asks for it', async () => {
  const repo = createTestRepository();
  const { event } = await seedNight(repo);
  window.history.pushState({}, '', `/?projector=${event.id}`);

  renderWithRepository(<App />, repo);

  expect(await screen.findByRole('heading', { level: 1, name: 'Test Bar' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Clitter Glitter' })).toBeNull();
  expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeNull();
});
