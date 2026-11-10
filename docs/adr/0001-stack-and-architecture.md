# 0001: Stack and architecture

Status: accepted (2026-11-09)

## Decision

TypeScript (strict), Vite, React. Offline-first: data in IndexedDB (Dexie) behind a `Repository` interface, installable as a PWA, projector scoreboard in a second window via `BroadcastChannel`. Supabase is added later for sync and collaboration. Scoring is a pure module driven by a rules object; scores are derived from graded entries.

## Why

- The host runs a night from one laptop in a bar with unreliable wifi, so nothing may depend on the network during play.
- The owner maintains the code only through Claude Code, so structure is enforced by tooling (strict types, lint-enforced layering, one `check` command, tests as the spec) rather than by convention.
- Hosts score differently; rules-as-data lets presets and new variations ship without touching the engine.

## Consequences

- Sync is deferred but cheap: rows carry `updatedAt`/`deletedAt` from day one, conflict policy is last-write-wins per row.
- Dependencies are added only when a feature needs them.
