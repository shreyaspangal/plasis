import { findDate } from "@/lib/parse/common";

/**
 * Two requests in one line: "lunch friday 1pm and remind me to book a table".
 * Code only finds where a line *could* break; the classifier decides whether
 * both halves really are cards. `firstAt` / `secondAt` say where each half starts in the
 * line, so a card can write into its own half.
 */
export type Clauses = { first: string; second: string; firstAt: number; secondAt: number };

const JOIN = new RegExp(
  [
    // A reminder trigger starts the second request, so it stays with it: "… and remind me to book a table".
    String.raw`\s+and\s+(?=(?:please\s+)?(?:remind me|don['’]?t forget|remember to)\b)`,
    // Words that only join; they belong to neither request.
    String.raw`\s+(?:and also|and then|oh and|after that|then)\s+`,
    String.raw`\s*;\s+`,
    String.raw`\.\s+`,
  ].join("|"),
  "gi",
);

/** "Dr. Rao", "5 p.m. with sam": a period after words like these doesn't end a sentence. */
const ABBREVIATION = /(?:^|\s)(?:[a-z]|mr|mrs|ms|dr|st|vs|etc|no|approx|[a-z]\.[a-z])$/i;

/** The first place the line breaks into two requests, or null for one request. */
export function findClauses(text: string): Clauses | null {
  for (const m of text.matchAll(JOIN)) {
    const before = text.slice(0, m.index);
    if (m[0].startsWith(".") && ABBREVIATION.test(before)) continue;
    const after = text.slice(m.index + m[0].length);
    const first = before.trim();
    const second = after.trim();
    const firstAt = before.length - before.trimStart().length;
    const secondAt = m.index + m[0].length + (after.length - after.trimStart().length);
    if (first.length >= 2 && second.length >= 2) return { first, second, firstAt, secondAt };
  }
  return null;
}

/**
 * The deadline a reminder half with no date could borrow from its sibling, in the user's own words:
 * "lunch friday 1pm" + "remind me to book a table" → "remind me to book a table before friday 1pm".
 * Only ever offered: the halves may be unrelated ("…and remind me to pay rent"), F-037.
 */
export function borrowDate(text: string, sibling: string, ref?: Date): string {
  if (findDate(text, ref)) return text;
  const date = findDate(sibling, ref);
  return date ? `${text} before ${date.text.replace(/^on\s+/i, "")}` : text;
}
