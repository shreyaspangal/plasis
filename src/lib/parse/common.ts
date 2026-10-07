import * as chrono from "chrono-node";

export const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const titleCase = (s: string) =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => capitalize(w))
    .join(" ");

export const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/** Strip dangling connector words left behind after removing a phrase. */
export function tidy(s: string) {
  let out = collapse(s.replace(/[,;]+\s*$/g, "").replace(/^\s*[,;:-]+/g, ""));
  const dangling = /\s+(on|at|by|for|with|to|in|and|the|this|next|from|every)$/i;
  const leading = /^(on|at|by|for|and|the|to)\s+/i;
  for (let i = 0; i < 4; i++) {
    const next = out.replace(dangling, "").replace(leading, "");
    if (next === out) break;
    out = next;
  }
  return out.trim();
}

export type Currency = "₹" | "$" | "€" | "£";
export const DEFAULT_CURRENCY: Currency = "₹";

export function detectCurrency(text: string): Currency {
  if (/\$|\busd\b|dollars?\b/i.test(text)) return "$";
  if (/€|\beur(os?)?\b/i.test(text)) return "€";
  if (/£|\bgbp\b|pounds? sterling/i.test(text)) return "£";
  return DEFAULT_CURRENCY;
}

export const AMOUNT_RE = /(?:₹|rs\.?|inr|\$|€|£)?\s?(\d[\d,]*(?:\.\d+)?)\s?(k\b)?/i;

export function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

/** Find the first money-like amount in the text. */
export function findAmount(text: string): { value: number; index: number; length: number } | null {
  const re = new RegExp(AMOUNT_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = toNumber(m[1]);
    if (!Number.isFinite(n)) continue;
    return { value: m[2] ? n * 1000 : n, index: m.index, length: m[0].length };
  }
  return null;
}

export type DateHit = {
  start: Date;
  end: Date | null;
  hasTime: boolean;
  text: string;
  index: number;
};

/** Misspellings of "tomorrow" chrono doesn't know ("tommorow", "tomorow", "2moro"). The real word is left to chrono. */
const TOMORROW_TYPO = /\b(?!tomorrow\b)(?:tom+or+ow|2mor+ow?)\b/i;

// A custom parser reports its own index and text, so callers can still cut the date out cleanly.
const dates = chrono.casual.clone();
dates.parsers.push({
  pattern: () => TOMORROW_TYPO,
  extract: (context) => {
    const d = new Date(context.refDate);
    d.setDate(d.getDate() + 1);
    return context.createParsingComponents({ day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() }).imply("hour", 12);
  },
});

export function findDate(text: string, ref: Date = new Date()): DateHit | null {
  const results = dates.parse(text, ref, { forwardDate: true });
  if (!results.length) return null;
  const r = results[0];
  // chrono is happy to read a bare number as a date; require something date-like.
  if (/^\d+$/.test(r.text.trim())) return null;
  return {
    start: r.start.date(),
    end: r.end ? r.end.date() : null,
    hasTime: r.start.isCertain("hour"),
    text: r.text,
    index: r.index,
  };
}

export function removeRange(text: string, index: number, length: number) {
  return text.slice(0, index) + " " + text.slice(index + length);
}

export function formatAmount(n: number, currency: Currency = DEFAULT_CURRENCY) {
  const locale = currency === "₹" ? "en-IN" : "en-US";
  const rounded = Math.round(n * 100) / 100;
  return (
    currency +
    rounded.toLocaleString(locale, {
      minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * A value the parser noticed but won't set on its own. Accepting rewrites the text
 * (the text stays the source of truth), so the parser then reads it for certain.
 */
export type Suggestion = { id: string; start: number; end: number; from: string; to: string };

export function applySuggestion(text: string, s: Suggestion): string {
  return text.slice(0, s.start) + s.to + text.slice(s.end);
}

/**
 * Type a snippet at the end of one span of the line, leaving the rest as is. A trailing "?"
 * stays last: "pizza or burgers?" + " or " → "pizza or burgers or ?". `caret` lands after the snippet.
 */
export function appendAt(text: string, end: number, snippet: string): { text: string; caret: number } {
  const head = text.slice(0, end).trimEnd();
  const joined = head.endsWith("?") ? `${head.slice(0, -1).trimEnd()}${snippet}?` : `${head}${snippet}`;
  return { text: joined + text.slice(end), caret: head.endsWith("?") ? joined.length - 1 : joined.length };
}
