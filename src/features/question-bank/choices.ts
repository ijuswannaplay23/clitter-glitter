export const choiceLetter = (index: number) => String.fromCharCode(65 + index);

/** The answer as the host reads it out: "B. Rome" for multiple choice, the plain answer otherwise. */
export const answerLabel = (q: { answer: string; choices?: string[] | undefined }) => {
  const index = q.choices?.indexOf(q.answer) ?? -1;
  return index < 0 ? q.answer : `${choiceLetter(index)}. ${q.answer}`;
};

/** "A. Paris   B. Rome" for places that show choices on one line. */
export const choicesLine = (choices: string[]) =>
  choices.map((c, i) => `${choiceLetter(i)}. ${c}`).join('   ');
