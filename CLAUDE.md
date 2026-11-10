# Clitter Glitter

Offline-first host tool for running bar trivia nights. Behavior is defined in `docs/SPEC.md`; read it before changing scoring or the data model. The owner does not write code: every change goes through Claude Code, so keep the repo legible to an agent with no prior context.

## Commands

- `npm run check` runs typecheck, lint, format check, tests, and build. **A change is not done until it passes.**
- `npm run dev` starts Vite. `npm run test:watch` for TDD. `npm run format` fixes formatting.

## Layout and import rules

Dependencies point downward only; ESLint fails the build if violated (`eslint.config.js`).

```
src/domain/    types + Zod schemas. Imports zod only.
src/scoring/   pure functions. Imports domain only. No React, no storage, no I/O.
src/data/      Repository interface + Dexie implementation (`createLocalRepository`); Supabase sync later.
               Features read through `repo.observe(...)`; save entries via `entries.findFor` then `save` to keep one per team+question.
src/features/  event-runner, projector, question-bank, quiz-builder, sheets.
src/ui/        shared presentation components.
```

## Non-negotiables

- **Scores are derived, never stored.** The source of truth is the graded entries; totals are recomputed.
- **Scoring is data.** New scoring behavior is a new field on a rules object in `domain/rules.ts`, not a code branch on a preset name.
- **Validate at the edges.** Parse anything read from storage or the network with the Zod schemas in `domain/`.
- **Every stored row has `updatedAt` and optional `deletedAt`** (soft delete) so sync stays a plain "changed since" query.
- **Never edit a shipped Dexie `version()`.** Nights live on real laptops: add `version(n+1).stores({...})` for the changed tables only, and cover it in `src/data/migration.test.ts`.
- Rows use client-generated UUIDs; the app must work with no network.
- v1 has per-question wagers only. No joker, no partial credit (decided; see SPEC §2).

## Offline and PWA

- The service worker exists only in the production build. To test offline: `npm run build`, `npm run preview`, load the app once, then stop the server and reload. `npm run dev` never registers one.
- Icons are generated: edit and run `node scripts/generate-icons.mjs`; don't hand-edit `public/icons/`.
- Updates are `registerType: 'prompt'` on purpose (no mid-night reload). Don't switch to `autoUpdate`.

## Print layout

- Sheet styling lives in `src/styles.css` (`.sheet*`, `@media print`). Unit tests cannot see paper: after changing it, print to PDF in a headless browser over DevTools (the page count must equal the number of sheets) and look at the rendered pages. A page that overflows silently prints extra pages.
- Sheets are always black on white, ignoring the dark theme, and must never contain answers.

## Working style

- One feature per branch, small PRs, `npm run check` green before merge.
- Write the test first for anything in `scoring/`; the SPEC §7 table is the starting suite.
- When behavior changes, update `docs/SPEC.md` and add a short file in `docs/adr/` for any architectural decision.
- Add dependencies only when a feature needs them (planned: React Router, Tailwind, `vite-plugin-pwa`, Playwright, `dexie-react-hooks` or a small `observe` hook, Supabase). Versions are pinned (`save-exact`).
- Comments only when the code cannot say it: a non-obvious value, ordering, or a browser/IndexedDB/PWA quirk and its workaround. No narration of how a change came about.
