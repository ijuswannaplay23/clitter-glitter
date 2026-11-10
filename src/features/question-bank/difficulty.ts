export const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Very easy',
  2: 'Easy',
  3: 'Medium',
  4: 'Hard',
  5: 'Very hard',
};

export const DIFFICULTIES = [1, 2, 3, 4, 5];

export const difficultyLabel = (rating: number) => DIFFICULTY_LABELS[rating] ?? String(rating);
