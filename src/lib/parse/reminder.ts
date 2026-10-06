import { capitalize, collapse, findDate, removeRange, tidy } from "./common";

export type ReminderData = { task: string; when: Date | null; hasTime: boolean; isDeadline: boolean };

/** "before fri 1pm" is a deadline, not the moment to be nudged. */
const BEFORE_LEAD = /\sbefore\s+$/i;

export function parseReminder(text: string, ref?: Date): ReminderData {
  let rest = ` ${collapse(text)} `;
  rest = rest.replace(/\s(?:please\s+)?(?:remind me(?:\s+to)?|reminder:?|don'?t forget(?:\s+to)?|remember to)\s/i, " ");
  rest = rest.replace(/\s(?:urgent(?:ly)?|asap|important|!+)(?=\s|$)/gi, " ");
  const date = findDate(rest, ref);
  const lead = date ? rest.slice(0, date.index).match(BEFORE_LEAD) : null;
  if (date) {
    // Take "before" out with its date, so the task isn't "Book a table before".
    const start = date.index - (lead?.[0].length ?? 0);
    rest = removeRange(rest, start, date.index - start + date.text.length);
  }
  return { task: capitalize(tidy(rest)), when: date?.start ?? null, hasTime: date?.hasTime ?? false, isDeadline: Boolean(lead) };
}

export function completeReminder(d: ReminderData) {
  return (d.task ? 0.55 : 0) + (d.when ? 0.3 : 0) + (d.hasTime ? 0.15 : 0);
}
