import { z } from 'zod';
import { EventRulesSchema, FinalRulesSchema, RoundRulesSchema } from './rules';

// Every stored row carries updatedAt/deletedAt so cloud sync is "send rows changed since X".
const row = {
  id: z.uuid(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().optional(),
};

export const ThemeSchema = z.object({
  ...row,
  name: z.string().min(1),
});

export const MIN_CHOICES = 2;
export const MAX_CHOICES = 6;

// Absent for an open-ended question. When present, `answer` is the text of exactly one choice.
const choices = z.array(z.string().min(1)).min(MIN_CHOICES).max(MAX_CHOICES).optional();
const answerIsAChoice = (q: { answer: string; choices?: string[] | undefined }) =>
  q.choices === undefined || q.choices.includes(q.answer);
const answerIsAChoiceMessage = { message: 'The answer must be one of the choices.' };

export const QuestionSchema = z
  .object({
    ...row,
    text: z.string().min(1),
    answer: z.string().min(1),
    choices,
    themeIds: z.array(z.uuid()),
    authorRating: z.number().int().min(1).max(5),
    status: z.enum(['pending', 'approved']),
  })
  .refine(answerIsAChoice, answerIsAChoiceMessage);

export const QuizRoundSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('standard'),
    id: z.uuid(),
    title: z.string(),
    rules: RoundRulesSchema,
    questionIds: z.array(z.uuid()),
  }),
  z.object({
    kind: z.literal('final'),
    id: z.uuid(),
    title: z.string(),
    rules: FinalRulesSchema,
    questionIds: z.array(z.uuid()).length(1),
  }),
]);

export const QuizSchema = z.object({
  ...row,
  title: z.string().min(1),
  rounds: z.array(QuizRoundSchema),
});

// Question text copied into a night when it starts, so later bank edits or deletions never
// change what was asked.
export const QuestionSnapshotSchema = z
  .object({
    id: z.uuid(),
    text: z.string().min(1),
    answer: z.string().min(1),
    choices,
    difficulty: z.number().int().min(1).max(5),
  })
  .refine(answerIsAChoice, answerIsAChoiceMessage);

export const EventSchema = z.object({
  ...row,
  quizId: z.uuid(),
  venue: z.string(),
  date: z.iso.date(),
  status: z.enum(['setup', 'live', 'done']),
  rules: EventRulesSchema,
  // How many rounds the projector counts. Undefined = live (everything graded); 0 = hidden.
  scoreboardRounds: z.number().int().min(0).optional(),
  // Question the host has put on the projector; while set it replaces the scoreboard.
  projectorQuestionId: z.uuid().optional(),
  // Copy taken at start so later edits to the quiz never rewrite a past night.
  quizSnapshot: QuizSchema,
  // Absent for quick nights, whose questions are read from the host's own source.
  questions: z.array(QuestionSnapshotSchema).optional(),
});

export const TeamSchema = z.object({
  ...row,
  eventId: z.uuid(),
  name: z.string().min(1),
});

export const EntrySchema = z.object({
  ...row,
  eventId: z.uuid(),
  teamId: z.uuid(),
  questionId: z.uuid(),
  state: z.enum(['correct', 'wrong', 'blank']),
  wager: z.number().int().min(0).optional(),
  gradedAt: z.iso.datetime(),
});

export type QuestionSnapshot = z.infer<typeof QuestionSnapshotSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type QuizRound = z.infer<typeof QuizRoundSchema>;
export type Quiz = z.infer<typeof QuizSchema>;
export type GameEvent = z.infer<typeof EventSchema>;
export type Team = z.infer<typeof TeamSchema>;
export type Entry = z.infer<typeof EntrySchema>;
