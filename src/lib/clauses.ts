/**
 * Two requests in one line: "lunch friday 1pm and remind me to book a table".
 * Code only finds where a line *could* break; the classifier decides whether
 * both halves really are cards.
 */
export type Clauses = { first: string; second: string };

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
    const first = before.trim();
    const second = text.slice(m.index + m[0].length).trim();
    if (first.length >= 2 && second.length >= 2) return { first, second };
  }
  return null;
}
