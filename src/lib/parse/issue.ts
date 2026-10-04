import { capitalize, collapse, findDate, removeRange, tidy } from "./common";

export type IssuePriority = "high" | "medium" | "low";

export type IssueData = {
  summary: string;
  assignee: string | null;
  collaborators: string[];
  /** Only explicit forms; null lets the card fall back to the urgency signal. */
  priority: IssuePriority | null;
  due: Date | null;
  hasTime: boolean;
};

/** "@riya" but not "riya@acme.com": no letter, digit or dot right before the @. */
const MENTION_RE = /(?<![\w.])@([a-z][\w-]*)/gi;
/** Shared with the offline scorer so both read mentions the same way. */
export const hasMention = (text: string) => new RegExp(MENTION_RE.source, "i").test(text);
const CC_RE = /\bcc\b:?/i;
/** "assign it to @riya": the verb goes with the mention. */
const ASSIGN_LEAD = /\bassign(?:ed)?\s+(?:it\s+)?(?:to\s+)?(?=@)/gi;

const LEVEL: Record<string, IssuePriority> = {
  highest: "high",
  high: "high",
  medium: "medium",
  normal: "medium",
  low: "low",
  lowest: "low",
};
const LEVELS = Object.keys(LEVEL).join("|");

/** Explicit priority only. A bare "high" is too vague ("memory usage high on server"). */
const PRIORITY_RULES: [RegExp, (m: RegExpMatchArray) => IssuePriority][] = [
  [new RegExp(`\\b(${LEVELS})[\\s-]+(?:priority|prio)\\b`, "i"), (m) => LEVEL[m[1].toLowerCase()]],
  [new RegExp(`\\b(?:priority|prio)[\\s:]+(${LEVELS})\\b`, "i"), (m) => LEVEL[m[1].toLowerCase()]],
  [/\bp([0-4])\b/i, (m) => (m[1] <= "1" ? "high" : m[1] === "2" ? "medium" : "low")],
  [/\b(?:urgent|critical|blocker|asap)\b/i, () => "high"],
];

export const hasExplicitPriority = (text: string) => PRIORITY_RULES.some(([re]) => re.test(text));

/** Connectors that belong to the due date or the priority, peeled together with them. */
const DUE_LEAD = /\b(?:by|on|before|until|due(?:\s+(?:by|on))?)\s+$/i;
const PRIORITY_LEAD = /\s(?:as|since|because)\s+(?:it'?s|it\s+is)\s*$/i;

const REFERENCE_BEFORE = /\b(?:since|from|after)\s+$/i;

/** Compared by calendar day, so "today" (chrono's noon) still counts as due later today. */
function isPastDay(d: Date, ref: Date = new Date()) {
  const startOfToday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return d < startOfToday;
}

/** A leading type word is the issueType signal's job, not part of the summary. */
const TYPE_PREFIX = /^\s*(?:bug|story|task|feature)\b:?\s*/i;

export function parseIssue(text: string, ref?: Date): IssueData {
  let rest = ` ${collapse(text)} `;

  // 1. Due date. "since/from/after monday" and past days describe when something happened,
  // not when it's due, so they stay in the summary. A missing due date beats a wrong one.
  const date = findDate(rest, ref);
  const isDue = date && !REFERENCE_BEFORE.test(rest.slice(0, date.index)) && !isPastDay(date.start, ref);
  if (date && isDue) {
    // Take a connector right before the date with it, so "fix it by friday asap" doesn't leave "fix it by asap".
    const lead = rest.slice(0, date.index).match(DUE_LEAD);
    const start = date.index - (lead?.[0].length ?? 0);
    rest = removeRange(rest, start, date.index - start + date.text.length);
  }

  // 2. Mentions: the first one before "cc" is the assignee; everyone else collaborates.
  const cc = rest.search(CC_RE);
  let assignee: string | null = null;
  const collaborators: string[] = [];
  for (const m of rest.matchAll(MENTION_RE)) {
    const name = capitalize(m[1].toLowerCase());
    const afterCc = cc !== -1 && m.index > cc;
    if (!assignee && !afterCc) assignee = name;
    else if (name !== assignee && !collaborators.includes(name)) collaborators.push(name);
  }
  rest = rest.replace(ASSIGN_LEAD, " ").replace(MENTION_RE, " ").replace(CC_RE, " ");

  // 3. Priority.
  let priority: IssuePriority | null = null;
  for (const [re, level] of PRIORITY_RULES) {
    const m = rest.match(re);
    if (!m) continue;
    priority = level(m);
    // "as it's high priority": the lead-in goes with the priority.
    const before = rest.slice(0, m.index).replace(PRIORITY_LEAD, " ");
    rest = `${before} ${rest.slice((m.index ?? 0) + m[0].length)}`;
    break;
  }

  // 4. Summary is whatever is left.
  const summary = capitalize(tidy(rest.replace(TYPE_PREFIX, " ")));
  return { summary, assignee, collaborators, priority, due: isDue ? date.start : null, hasTime: isDue ? date.hasTime : false };
}

export function completeIssue(d: IssueData) {
  return (d.summary ? 0.5 : 0) + (d.assignee ? 0.25 : 0) + (d.due ? 0.15 : 0) + (d.priority ? 0.1 : 0);
}
