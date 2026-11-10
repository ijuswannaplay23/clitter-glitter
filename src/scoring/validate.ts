import type { Entry, FinalRules, RoundRules } from '../domain';

export type FlagKind =
  | 'missing-wager'
  | 'wager-out-of-range'
  | 'wager-not-in-pool'
  | 'wager-reused'
  | 'wager-exceeds-cap'
  | 'opt-out-not-allowed'
  | 'duplicate-entry';

/** A problem the host should look at. Flagged entries are still scored as written. */
export interface Flag {
  kind: FlagKind;
  teamId: string;
  entryIds: string[];
  message: string;
}

function flag(kind: FlagKind, entries: Entry[], message: string): Flag {
  const first = entries[0];
  return { kind, teamId: first?.teamId ?? '', entryIds: entries.map((e) => e.id), message };
}

/** Blank answers are skipped: they score 0 whatever was written beside them. */
export function validateRoundWagers(entries: Entry[], rules: RoundRules): Flag[] {
  const { wager } = rules;
  if (wager.mode === 'none') return [];

  const flags: Flag[] = [];
  const byValue = new Map<number, Entry[]>();

  for (const e of entries) {
    if (e.state === 'blank') continue;
    if (e.wager === undefined) {
      flags.push(flag('missing-wager', [e], 'Answered question has no wager written down.'));
      continue;
    }
    if (wager.mode === 'range' && (e.wager < wager.min || e.wager > wager.max)) {
      flags.push(
        flag('wager-out-of-range', [e], `Wager ${e.wager} is outside ${wager.min}-${wager.max}.`),
      );
    }
    if (wager.mode === 'pool') {
      if (!wager.values.includes(e.wager)) {
        flags.push(
          flag('wager-not-in-pool', [e], `Wager ${e.wager} is not one of the allowed values.`),
        );
      }
      byValue.set(e.wager, [...(byValue.get(e.wager) ?? []), e]);
    }
  }

  for (const [value, group] of byValue) {
    if (group.length > 1) {
      flags.push(flag('wager-reused', group, `Wager ${value} was used ${group.length} times.`));
    }
  }
  return flags;
}

export function validateFinalWager(
  entries: Entry[],
  rules: FinalRules,
  scoreBefore: number,
): Flag[] {
  const cap = rules.wagerCap === 'currentScore' ? Math.max(0, scoreBefore) : rules.wagerCap.fixed;
  const flags: Flag[] = [];

  for (const e of entries) {
    if (e.state === 'blank') continue;
    const wager = e.wager ?? 0;
    if (wager > cap) {
      flags.push(flag('wager-exceeds-cap', [e], `Wager ${wager} is above the cap of ${cap}.`));
    }
    if (wager === 0 && !rules.allowOptOut) {
      flags.push(flag('opt-out-not-allowed', [e], 'A wager of 0 is not allowed on the final.'));
    }
  }
  return flags;
}
