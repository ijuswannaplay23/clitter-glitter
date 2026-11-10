import { z } from 'zod';

export const WagerRulesSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('none') }),
  z
    .object({
      mode: z.literal('range'),
      min: z.number().int().min(0),
      max: z.number().int().min(0),
    })
    .refine((r) => r.min <= r.max, { message: 'min must be <= max' }),
  z.object({
    mode: z.literal('pool'),
    values: z.array(z.number().int().positive()).min(1),
  }),
]);

export const OnWrongSchema = z.union([
  z.enum(['zero', 'loseWager', 'loseHalfWager']),
  z.object({ flatPenalty: z.number().int().positive() }),
]);

export const RoundRulesSchema = z.object({
  baseValue: z.number().int().min(0),
  questionWeights: z.array(z.number().positive()).optional(),
  wager: WagerRulesSchema,
  onWrong: OnWrongSchema,
});

export const FinalRulesSchema = z.object({
  wagerCap: z.union([z.literal('currentScore'), z.object({ fixed: z.number().int().min(0) })]),
  allowOptOut: z.boolean(),
  onWrong: z.enum(['loseWager', 'loseHalfWager']),
});

export const EventRulesSchema = z.object({
  allowNegativeTotal: z.boolean(),
});

export type WagerRules = z.infer<typeof WagerRulesSchema>;
export type OnWrong = z.infer<typeof OnWrongSchema>;
export type RoundRules = z.infer<typeof RoundRulesSchema>;
export type FinalRules = z.infer<typeof FinalRulesSchema>;
export type EventRules = z.infer<typeof EventRulesSchema>;
