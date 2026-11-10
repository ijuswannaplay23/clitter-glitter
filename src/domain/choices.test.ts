import { describe, expect, it } from 'vitest';
import { QuestionSnapshotSchema } from './entities';

const base = { id: '5b0f3a1e-6a35-4f0e-9d63-2f6f2a1c9b10', text: 'Capital?', difficulty: 2 };

describe('question choices', () => {
  it('accepts open-ended questions and choices that contain the answer', () => {
    expect(QuestionSnapshotSchema.safeParse({ ...base, answer: 'Rome' }).success).toBe(true);
    expect(
      QuestionSnapshotSchema.safeParse({ ...base, answer: 'Rome', choices: ['Paris', 'Rome'] })
        .success,
    ).toBe(true);
  });

  it('rejects an answer that is not a choice, and too few or too many choices', () => {
    const parse = (choices: string[], answer = 'Rome') =>
      QuestionSnapshotSchema.safeParse({ ...base, answer, choices }).success;
    expect(parse(['Paris', 'Oslo'])).toBe(false);
    expect(parse(['Rome'])).toBe(false);
    expect(parse(['a', 'b', 'c', 'd', 'e', 'f', 'Rome'])).toBe(false);
    expect(parse(['Rome', ''])).toBe(false);
  });
});
