# Clitter Glitter: data model, scoring and architecture spec (draft v0.2)

## 1. Scope

A **host tool** for running bar-style trivia nights. Teams answer on paper; the host enters wagers and grades answers; a projector view shows live standings. No team accounts, no phone submissions.

**v1:** scoring rules engine, event runner, projector scoreboard.
**Next:** question bank + quiz builder, printable sheets, cloud sync (Supabase), collaboration and multiple hosts.
**Non-goals:** auto-grading free text, team-facing apps, payments.

Design principles:

- **Scoring is data, not code.** Every rule is a field on a rules object, so presets are just saved rule sets.
- **Scores are derived, never stored.** The source of truth is the list of graded entries; totals are recomputed from them. Corrections fix themselves and a whole night is replayable in tests.
- **Offline-first.** The host's browser is the only device that matters during a night. Data lives locally and uploads later when a connection is available.
- **All maintenance happens through Claude Code.** The architecture must stay legible to an agent with no prior context: small modules, strict types, enforced boundaries, tests as the safety net (see §9).

## 2. Decisions made

| Question       | Decision                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------- |
| Wager scope    | **Per question** (v1). Per-round bets can be added later without changing the model.     |
| Joker          | **None.** Removed from v1.                                                               |
| Partial credit | **None.** An entry is correct, wrong, or blank.                                          |
| Pool wagers    | **Skipping a value is allowed.** Each value may be used at most once per round.          |
| Stack          | TypeScript + Vite + React, offline-first PWA, Supabase later for sync and collaboration. |

## 3. Entities

```
Host            id, name
Theme           id, name                          -- "90s movies", "Dirty trivia", ... (unique ignoring case)
Question        id, hostId, text, answer, choices?[2-6], themeIds[], authorRating(1-5),
                status(pending|approved), createdBy
Quiz            id, hostId, title, themeId?, rounds[]   -- a reusable template
QuizRound       id, quizId, order, kind(standard|final), title, rules: RoundRules | FinalRules,
                questions[](ordered Question refs)
Event           id, hostId, quizId, date, venue, status(setup|live|done),
                scoreboardRounds?(what the projector counts; unset = live, 0 = hidden), projectorQuestionId?(question on screen instead of the board),
                snapshot: Quiz + rules copied at start  -- later edits never rewrite history
Team            id, eventId, name
Entry           id, eventId, teamId, questionId, state(correct|wrong|blank),
                wager?(int), gradedAt                    -- one per team per question
```

Every stored row also carries `updatedAt` and `deletedAt?` (soft delete), so cloud sync later is a plain "send rows changed since last sync" and needs no model changes.

Derived (computed, never edited):

- `RoundScore(team, round)` and `Standing(team, afterRound)`, from the engine below.
- `QuestionStats(question)`: times asked, % of teams correct. Feeds observed difficulty in the quiz builder.

IDs are client-generated UUIDs so the offline host can create everything without a server.

## 4. Rules (the configurable part)

```ts
interface RoundRules {
  baseValue: number; // points per correct answer when no wager. default 1
  questionWeights?: number[]; // optional per-question multiplier, e.g. [1,1,2,2,3]
  wager:
    | { mode: 'none' }
    | { mode: 'range'; min: number; max: number } // any integer in range
    | { mode: 'pool'; values: number[] }; // each value usable once per round; may skip
  onWrong: 'zero' | 'loseWager' | 'loseHalfWager' | { flatPenalty: number };
}

interface EventRules {
  allowNegativeTotal: boolean; // if false, running total is clamped at 0 after each round
}

interface FinalRules {
  // used when QuizRound.kind === 'final'
  wagerCap: 'currentScore' | { fixed: number };
  allowOptOut: boolean; // team may wager 0
  onWrong: 'loseWager' | 'loseHalfWager';
}
```

Behaviors fixed for v1:

- A wagered question's wager **replaces** `baseValue`; it is not added on top.
- **Blank answers never cost points**, even if a wager was written down.
- A wager outside the configured range/pool, or a pool value reused, is **flagged**, not rejected. Paper is messy, so the host decides (override or correct).
- Other flagged-not-rejected cases: an answered question with no wager written, a final wager above the cap or a 0 wager when opting out is disallowed, and a question graded twice (the most recently updated entry is used). Flagged entries are scored as written, so the host must resolve flags before reading the standings as final.
- Blank answers are never validated: they score 0 whatever was written beside them.
- Ranking is competition style: ties share a rank and the next rank is skipped (1, 1, 3).

## 5. Scoring algorithm

Per entry:

```
points(entry, rules, questionIndex):
  if entry.state == blank:  return 0

  value = rules.wager.mode == 'none'
            ? rules.baseValue * (rules.questionWeights?.[questionIndex] ?? 1)
            : entry.wager

  if entry.state == correct: return +value

  // wrong
  switch rules.onWrong:
    'zero':          return 0
    'loseWager':     return rules.wager.mode == 'none' ? 0 : -entry.wager
    'loseHalfWager': return rules.wager.mode == 'none' ? 0 : -floor(entry.wager / 2)
    {flatPenalty n}: return -n
```

Per round and running total:

```
roundScore(team, round) = sum(points(e) for e in team's entries in round)

total_after(round_k) = clamp?( total_after(round_k-1) + roundScore(round_k) )
                       // clamp at 0 only when EventRules.allowNegativeTotal is false
```

Final question:

```
cap = FinalRules.wagerCap == 'currentScore' ? max(0, total_before_final) : fixed
valid wager: 0 <= wager <= cap
correct -> +wager;  wrong -> loseWager: -wager, loseHalfWager: -floor(wager/2)
```

A team at 0 or below can only wager 0 on a `currentScore` final. The projector view should say so explicitly so it doesn't read as a bug.

## 6. Presets (just saved rule sets)

| Preset               | Rounds                                                                                   | Notes                          |
| -------------------- | ---------------------------------------------------------------------------------------- | ------------------------------ |
| **Classic**          | `baseValue 1`, no wager, `onWrong zero`                                                  | Standard pub quiz.             |
| **Escalating wager** | R1 pool `[1..5]`, R2 pool `[5,6,...]`, and so on; `onWrong loseWager`; negatives allowed | The format the host remembers. |
| **Classic + final**  | Classic rounds, then a final with `wagerCap currentScore`, `loseWager`                   | All-or-nothing finish.         |
| **Custom**           | Every field editable                                                                     | Host-built.                    |

Presets are copied into the Event snapshot at start, so editing a preset never changes a past night.

## 7. Tests to write first

The engine is pure functions over `(entries, rules)`, so these are plain unit tests:

| Case                                                  | Expectation                |
| ----------------------------------------------------- | -------------------------- |
| Classic, 8 questions, 5 correct                       | 5                          |
| Pool `[1..5]`, 3 correct (wagers 5, 3, 1)             | +9                         |
| Same pool, 2 wrong (wagers 4, 2), `loseWager`         | -6                         |
| Pool with a skipped value (only 1, 2, 4 used)         | valid, no flag             |
| Pool value used twice in a round                      | flagged, still scored      |
| Wager outside range                                   | flagged, still scored      |
| `loseHalfWager`, wrong with wager 5                   | -2 (floor)                 |
| Blank with wager written                              | 0                          |
| `allowNegativeTotal: false`, total 3 then round of -6 | 0, not -3                  |
| Final, `currentScore`, team on 7, wager 7, correct    | 14                         |
| Final, team on -2, any wager above 0                  | flagged invalid            |
| Edit a past entry (wrong to correct)                  | all later totals recompute |

Add **golden-night tests** as real events happen: store the entries and expected standings from an actual night as fixtures, so any future change that alters history fails loudly.

## 8. Offline and sync

- **Storage:** IndexedDB via Dexie, behind a `Repository` interface (see §9). v1 ships only the local implementation.
- **Upload later:** a sync layer pushes rows with `updatedAt` newer than the last successful sync and pulls remote changes. Last-write-wins per row is enough, because a given event is edited by one host.
- **Auth and identity** arrive with Supabase; until then there is one implicit local host.
- **Projector window:** a second browser window on the same machine. Both windows share one origin, so the projector reads the same IndexedDB through `Repository.observe` (Dexie live queries, which also notify other windows). No network is needed. Cross-window delivery is untested in CI but was verified by hand in a real browser (two tabs, same origin: grading in one updated the other with no reload), so no `BroadcastChannel` is needed.
- **Projector controls:** the host picks what the projector shows (live, hidden, or standings after round N) so results can be held back for the reveal. The projector window is `/?projector=<eventId>`: read-only, always dark, sized to the screen, no flags or grading controls. Tied teams are listed alphabetically.
- **Question bank (v1):** add, edit and delete questions (text, answer, difficulty 1 to 5, any number of themes); filter by theme, difficulty and text; rename or delete themes (deleting also removes the theme from its questions). New themes are created on the fly and matched case-insensitively. Everything is entered as `approved`; `pending` is reserved for collaborative submissions. Difficulty is the author's rating; observed difficulty (from graded entries) comes later.
- **Multiple choice:** a question may carry 2 to 6 `choices`; `answer` is the text of exactly one of them (enforced by the schema). The host still grades right or wrong, so scoring is unchanged. The form has a "Multiple choice" switch, a radio to mark the correct choice, and add/remove choice buttons. Choices are lettered A to F, copied into the night's question snapshot, shown on the cue card (answer as "B. Rome"), on the projector under the question, and appended to the question text on answer sheets when that option is on.
- **CSV choices:** optional columns `choice1` to `choice6` (export adds only as many as needed). The `answer` cell may be a choice's text (any case) or its letter; import rejects an answer that matches no choice, a single choice, or duplicates.
- **CSV import and export:** columns `question, answer, difficulty, themes` (themes separated by `;`). Import skips questions already in the bank, reports bad rows by line number, and defaults difficulty to 3. Export doubles as a backup. Exported cells that a spreadsheet could read as a formula get a leading apostrophe, which import removes again; negative numbers like `-273` are left alone.
- **Quiz builder:** the host picks themes (none = all), rounds, questions per round, whether to end with a final, a difficulty curve, and a scoring preset, then drafts a quiz from the bank. **Rising** spreads difficulty 1 to 5 across the whole night; **Ramp** climbs easy to hard inside every round. The final is always the hardest available question and is chosen first so earlier slots cannot use it up. Each slot takes the unused question nearest its target difficulty, with ties broken at random. Only `approved` questions are eligible. If the bank is too small the builder says how many are needed and how many match. Each question can be swapped for a different unused one of the nearest difficulty. Saving stores a reusable quiz (question ids plus per-round rules).
- **Starting a night from a quiz:** the night copies the quiz and each question's text, answer and difficulty into the event (`Event.questions`), so later bank edits never change a night in progress or a past one. The runner shows the round's questions and answers on a host-only cue card. Each question has a "Show on projector" button that sets `Event.projectorQuestionId`; while set, the projector shows that question's text (round, number, text; never the answer) instead of the scoreboard, and pressing the button again returns to the scores. Only one question is shown at a time, and nothing is shown if the text was not saved with the night. Starting is refused if the quiz uses a question deleted from the bank. Quick nights (placeholder questions) do not create a saved quiz.
- **Printable answer sheets:** `/?sheets=<eventId>`, opened from "Print answer sheets" in the runner. One Letter page per round plus the final, each with the venue, date, a team-name line, the rules sentence, an answer line per question and (on wagered rounds) a wager box; pool rounds also list the wager values to cross off. Blank sets (default 8) or one set per team already added with names filled in; ordered by team (a stapled packet) or by round (hand out one at a time). Question text is optional (off by default, since questions are read aloud) and **answers are never printed**. Rounds are capped at 20 questions per page, and a warning appears when many long questions might be cut off. Verified by printing to PDF in a headless browser: the page count matched exactly (one page per sheet) and a 20-question round fits. Printer margins vary; in the print dialog choose Letter and turn off headers and footers.
- **Data layer:** `src/data` exposes a `Repository` (events, quizzes, questions, teams, entries). Writes are validated with the Zod schemas and stamped with `updatedAt`; reads are validated too and throw `StoredDataError` on a bad row; deletes are soft. Sync will add `Table.changedSince` consumers, not new storage.
- **Installable:** PWA (`vite-plugin-pwa`, Workbox precache of the whole app shell, manifest, generated icons). The projector URL is the same shell, so it works offline too. Verified by hand: with the server stopped, the app and `/?projector=<id>` both loaded and showed saved data. Not verified: the browser's install prompt and iOS "Add to Home Screen".
- **Updates never interrupt a night:** a new version waits until every window of the app is closed, then applies on the next launch. There is deliberately no auto-reload.
- **Hosting assumption:** `start_url` and scope are `/`, so the app must be served from the domain root. Serving it from a sub-path (e.g. GitHub Pages project sites) needs Vite's `base` and the manifest paths changed.

## 9. Stack and architecture (built to be maintained by Claude Code)

**Stack:** TypeScript (strict) · Vite · React · React Router · Dexie (+ `dexie-react-hooks` for live queries) · Zod (validates rules, presets and stored data) · Vitest · Playwright · Tailwind · `vite-plugin-pwa`. Supabase added at the sync phase. No global state library; Dexie live queries plus derived selectors cover it.

**Layout (dependencies only point downward):**

```
src/
  domain/      types + Zod schemas (no logic, no imports from below)
  scoring/     pure functions: points, roundScore, standings, validation   ← imports domain only
  data/        Repository interface; LocalRepository (Dexie); SyncRepository later
  features/    event-runner/ projector/ question-bank/ quiz-builder/ sheets/
  ui/          shared components
docs/
  SPEC.md      this file (source of truth for behavior)
  adr/         one short file per architectural decision
CLAUDE.md      rules for any agent working in the repo
```

**Guardrails that make agent-only maintenance safe:**

1. **One command, `npm run check`**, runs typecheck, lint, unit tests, and build. A change is not done until it passes.
2. **Enforced boundaries.** An ESLint import rule fails the build if `scoring/` imports React, storage, or `features/`. The most important code cannot be tangled up with UI.
3. **Tests are the spec.** The §7 table becomes the unit suite; one Playwright test runs a whole fake night end to end; golden-night fixtures accumulate over time.
4. **`CLAUDE.md` in the repo** states the layout, the boundaries, the `check` command, "scores are derived, never stored," and "update SPEC.md and add an ADR when behavior changes."
5. **Schema validation at the edges.** Zod parses anything read from storage or the network, so a bad row fails visibly instead of corrupting a scoreboard.
6. **Few dependencies, pinned versions,** plus Dependabot or Renovate PRs so upgrades stay small and routine.
7. **Work in small PRs** from Claude Code, one feature per branch, with CI running `npm run check` on every push.
8. **Static hosting** (Cloudflare Pages, Netlify, or GitHub Pages) deploys from the main branch, so shipping is a merge.

## 10. Remaining open items

1. Pool wager mechanics beyond v1 (e.g. a "must use all values" option). Defer until a host asks.
2. Per-round wagers, joker, and partial credit are explicitly **out** for now; the rules object is the place to add them.
3. Hosting provider and whether the repo lives on GitHub (CI and Dependabot assume it does).

## 11. Build order

1. Scaffold: repo, tooling, `CLAUDE.md`, `npm run check`, CI
2. `scoring/` module + tests from §7 (no UI)
3. Event runner: teams, wagers, grading, standings
4. Projector view
5. PWA install and offline verification
6. Question bank, themes, difficulty, quiz builder
7. Printable answer sheets
8. Supabase sync, then collaborative submissions and multiple hosts
